import express from 'express';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================== 【設定エリア】 ==================
const CHATWORK_API_TOKEN = "47f3a071fe49e7259100d70071c986b7";
const CHATWORK_ROOM_ID = "440162416"; 

// 🔥 3つのURLリスト
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
  console.log(`[${new Date().toLocaleString("ja-JP")}] サブ垢3つの無限粘り＆リトライ検証を開始します...`);
  
  currentPingTime = ""; 

  // 遅いとき、応答がないときに最大3回まで叩き直す関数
  const fetchWithRetry = async (baseUrl, attempt = 1) => {
    const maxAttempts = 3;
    const controller = new AbortController();
    // ⚡ Vercelを卒業したので、1回あたり「30秒」までじっくり待ちます
    const timeoutId = setTimeout(() => controller.abort(), 30000); 

    try {
      console.log(`📡 [${baseUrl}] 通信試行中... (回数: ${attempt}/${maxAttempts})`);
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

      // 【判定1】 直接200 OK
      if (res.status === 200) {
        console.log(`🟢 [${baseUrl}] 直接200 OKを検出！ (${pingMs}ms)`);
        return { baseUrl, pingMs, reason: `Direct OK (${attempt}回目で成功)` };
      }

      // 【判定2】 200以外の場合、HTML中身チェック
      const rawText = await res.text();

      if (rawText.includes("proceed to preview") || rawText.includes("Yes, proceed") || rawText.includes("sandbox was sleeping")) {
        console.log(`🟢 [${baseUrl}] 本物の生存クッション画面を検出！ (${pingMs}ms)`);
        return { baseUrl, pingMs, reason: `Preview Alive (${attempt}回目で成功)` };
      }

      // クレジット切れなどの場合はリトライせず即時NG
      if (rawText.includes("Limit Exceeded") || rawText.includes("Upgrade your plan") || rawText.includes("Credit Expired")) {
        console.log(`❌ [${baseUrl}] クレジット切れを検出したため、リトライせず終了。`);
        return null;
      }

      throw new Error(`想定外のステータス: ${res.status}`);

    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        console.log(`⏳ [${baseUrl}] 30秒経っても反応なし（タイムアウト）`);
      } else {
        console.log(`⚠️ [${baseUrl}] 通信エラー: ${err.message}`);
      }

      // 🔄 回数が残っていれば、その場ですぐにもう一度叩き直す！
      if (attempt < maxAttempts) {
        console.log(`🔄 [${baseUrl}] 反応が遅い、またはエラーのため、再度ノックを叩き直します...`);
        return await fetchWithRetry(baseUrl, attempt + 1);
      }

      console.log(`❌ [${baseUrl}] ${maxAttempts}回叩き直しましたが、完全に沈黙しています。`);
      return null;
    }
  };

  const raceTask = async (url) => {
    const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    return await fetchWithRetry(baseUrl);
  };

  // 3つ同時に粘り込みレース開始
  const tasks = SANDBOX_URLS.map(url => raceTask(url));
  const results = await Promise.all(tasks);

  // 生存判定をパスしたやつだけを抽出
  const validResults = results.filter(r => r !== null);

  if (validResults.length > 0) {
    validResults.sort((a, b) => {
      if (a.reason.includes("Direct OK") && !b.reason.includes("Direct OK")) return -1;
      if (!a.reason.includes("Direct OK") && b.reason.includes("Direct OK")) return 1;
      return a.pingMs - b.pingMs;
    });
    
    latestAvailableUrl = validResults[0].baseUrl;
    currentPingTime = ` (判定: ${validResults[0].reason})`;
    console.log("🟢 案内対象に決定したURL:", latestAvailableUrl);
  } else {
    latestAvailableUrl = "⚠️ すべてのサブ垢のクレジットが切れているか、停止しています。";
    currentPingTime = "";
    console.log("❌ 生きているアカウントが一つも見つかりませんでした。");
  }
}

// 🌐 サイトのトップページ（ / ）にアクセスがあった時の処理
app.get('/', async (req, res) => {
  const nowStr = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  console.log(`[${nowStr}] 常駐サーバーにアクセスを受信`);

  try {
    await checkAllInstances();

    const replyMessage = 
`📺 自作YouTubeサイト案内Bot (自動巡回完了)

現在クレジットが残っていて快適に動くURLはこちらです！
👇
${latestAvailableUrl}${currentPingTime}`;

    await sendChatworkMessage(replyMessage);

    res.status(200).send(`巡回完了。最新URL: ${latestAvailableUrl}`);

  } catch (error) {
    console.error("エラー発生:", error);
    res.status(500).send(`エラーが発生しました:\n${error.message}`);
  }
});

// 🚀 Zeabur/Glitch等の常駐サーバー配信用ポート待ち受けを追加
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Bot server successfully running on port ${PORT} 🎉`);
});

export default app;
