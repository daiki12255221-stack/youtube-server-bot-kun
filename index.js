import express from 'express';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================== 【設定エリア】 ==================
const CHATWORK_API_TOKEN = "47f3a071fe49e7259100d70071c986b7";
const CHATWORK_ROOM_ID = "440162416"; 

// 🔥 前の2つ＋今回のテスト用を合わせた合計3つのURLリスト
const SANDBOX_URLS = [
  "https://jhsnlx-8080.csb.app",
  "https://v52l6d-8080.csb.app/",
  "https://znpf9v-3000.csb.app/"
];
// ===================================================

let latestAvailableUrl = "現在、利用可能なサーバーがありません。";
let currentPingTime = ""; 

async function sendChatworkMessage(message) {
  const res = await fetch(
    `https://api.chatwork.com/v2/rooms/${CHATWORK_ROOM_ID}/messages`,
    {
      method: "POST",
      headers: {
        "X-ChatWorkToken": CHATWORK_API_TOKEN,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ body: message }),
    }
  );
  if (!res.ok) {
    console.log("❌ Chatwork送信エラー:", await res.text());
  } else {
    console.log("🚀 Chatworkへの自動通知に成功しました！");
  }
}

// 🛠️ 全サブ垢の生存確認を厳密に行う関数
async function checkAllInstances() {
  console.log(`[${new Date().toLocaleString("ja-JP")}] サブ垢3つの選別生存確認レースを開始します（鉄壁ホワイトリスト版）...`);
  
  currentPingTime = ""; 

  const raceTask = async (url) => {
    const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const controller = new AbortController();
    
    // ⚡ Vercelの上限ギリギリの9秒まで粘る
    const timeoutId = setTimeout(() => controller.abort(), 9000); 

    try {
      const startTime = performance.now();

      const res = await fetch(`${baseUrl}/api/ping`, {
        signal: controller.signal,
        headers: { 
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });
      clearTimeout(timeoutId);

      const endTime = performance.now();
      const pingMs = Math.round(endTime - startTime);

      // 【判定1】 直接200 OKが返ってきたら完璧な生存！
      if (res.status === 200) {
        console.log(`🟢 [${baseUrl}] 直接200 OKを検出！`);
        return { baseUrl, pingMs, reason: "Direct OK" };
      }

      // 【判定2】 200以外だった場合、HTMLの中身をチェック
      const rawText = await res.text();

      // ⭕ 【ホワイトリスト検証】 使えるクッション画面特有のキーワードが「確実に含まれている場合だけ」生存と認める！
      if (rawText.includes("proceed to preview") || rawText.includes("Yes, proceed") || rawText.includes("sandbox was sleeping")) {
        console.log(`🟢 [${baseUrl}] 本物の「生存クッション画面」を検出しました。`);
        return { baseUrl, pingMs, reason: "Preview Alive" };
      }

      // 🚨 上記の安全なキーワードが1つも入っていないHTMLは、すべて「死んでいる（クレジット切れなど）」と判定して即除外！
      console.log(`❌ [${baseUrl}] 警告：有効なクッション画面キーワードがありません。クレジット切れ、または別のエラーと判断し除外します。`);
      throw new Error("Not a valid preview screen (Maybe Credit Expired)");

    } catch (err) {
      clearTimeout(timeoutId);
      console.log(`❌ [${baseUrl}] 停止または無効: ${err.message}`);
      return null; 
    }
  };

  // 3つ同時にチェック開始
  const tasks = SANDBOX_URLS.map(url => raceTask(url));
  const results = await Promise.all(tasks);

  // 生存判定をパスしたやつだけを抽出
  const validResults = results.filter(r => r !== null);

  if (validResults.length > 0) {
    // 優先順位：①Direct OK ＞ ②Preview Alive（その中なら応答が速い順）
    validResults.sort((a, b) => {
      if (a.reason === "Direct OK" && b.reason !== "Direct OK") return -1;
      if (a.reason !== "Direct OK" && b.reason === "Direct OK") return 1;
      return a.pingMs - b.pingMs;
    });
    
    latestAvailableUrl = validResults[0].baseUrl;
    currentPingTime = ` (判定: ${validResults[0].reason})`;
    console.log("🟢 案内対象に決定した最速URL:", latestAvailableUrl);
  } else {
    latestAvailableUrl = "⚠️ すべてのサブ垢のクレジットが切れているか、停止しています。";
    currentPingTime = "";
    console.log("❌ 生きているアカウントが一つも見つかりませんでした。");
  }
}

// 🌐 サイトのトップページ（ / ）にアクセスがあった時の処理
app.get('/', async (req, res) => {
  const nowStr = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  console.log(`[${nowStr}] 巡回アクセスを受信（3面待ち選別モード）`);

  try {
    await checkAllInstances();

    const replyMessage = 
`📺 自作YouTubeサイト案内Bot (自動巡回完了)

現在クレジットが残っていて快適に動くURLはこちらです！
👇
${latestAvailableUrl}${currentPingTime}`;

    await sendChatworkMessage(replyMessage);

    res.status(200).send(`3面巡回＆Chatworkへの投稿が完了しました。最新URL: ${latestAvailableUrl}`);

  } catch (error) {
    console.error("処理中でエラー発生:", error);
    res.status(500).send(`エラーが発生しました:\n${error.message}`);
  }
});

export default app;
