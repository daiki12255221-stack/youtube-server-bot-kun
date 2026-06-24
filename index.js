import express from 'express';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================== 【設定エリア】 ==================
const CHATWORK_API_TOKEN = "47f3a071fe49e7259100d70071c986b7";
const CHATWORK_ROOM_ID = "440162416"; 

// 【あなたの量産したサブ垢のCodeSandbox URLリスト】
const SANDBOX_URLS = [
  "https://jhsnlx-8080.csb.app/",
  ""
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

// 🛠️ 全サブ垢の生存確認レースを行う関数
async function checkAllInstances() {
  console.log(`[${new Date().toLocaleString("ja-JP")}] 全サブ垢の一斉生存確認レース（確認画面スキップ版）を開始します...`);
  
  currentPingTime = ""; 

  const raceTask = async (url) => {
    const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const controller = new AbortController();
    
    // 【9秒待ち】Vercelの上限ギリギリまで寝坊助コンテナを待つ
    const timeoutId = setTimeout(() => controller.abort(), 9000); 

    try {
      const startTime = performance.now();

      // 🚀 Fetchの通信に「確認画面をスキップするヘッダー」を搭載！
      const res = await fetch(`${baseUrl}/api/ping`, {
        signal: controller.signal,
        headers: { 
          "User-Agent": "Sandbox-Watcher-Bot",
          "X-CSB-Skip-Incap-Check": "true", // ✨ これがあの画面を突破するおまじない
          "Accept": "application/json"      // ✨ HTMLではなくAPIの返答を要求
        }
      });
      clearTimeout(timeoutId);

      if (res.status === 200) {
        const endTime = performance.now();
        const pingMs = Math.round(endTime - startTime); 
        return { baseUrl, pingMs }; 
      }
      throw new Error(`Status: ${res.status}`);
    } catch (err) {
      clearTimeout(timeoutId);
      return null; 
    }
  };

  const tasks = SANDBOX_URLS.map(url => raceTask(url));
  const results = await Promise.all(tasks);

  const validResults = results.filter(r => r !== null);

  if (validResults.length > 0) {
    validResults.sort((a, b) => a.pingMs - b.pingMs);
    
    latestAvailableUrl = validResults[0].baseUrl;
    currentPingTime = ` (最速応答: ${validResults[0].pingMs}ms)`;
    console.log("🟢 現在の最速生存URL:", latestAvailableUrl, currentPingTime);
  } else {
    latestAvailableUrl = "⚠️ すべてのサブ垢のクレジットが切れているか、停止しています。";
    currentPingTime = "";
    console.log("⚠️ 生きているアカウントが一つも見つかりませんでした（全員スリープ中、または上限切れ）。");
  }
}

// 🌐 サイトのトップページ（ / ）にアクセスがあった時の処理
app.get('/', async (req, res) => {
  const nowStr = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  console.log(`[${nowStr}] 定期チェックアクセスを受信（確認画面スキップモード）`);

  try {
    await checkAllInstances();

    const replyMessage = 
`📺 自作YouTubeサイト案内Bot (自動巡回完了)

現在クレジットが残っていて快適に動くURLはこちらです！
👇
${latestAvailableUrl}${currentPingTime}`;

    await sendChatworkMessage(replyMessage);

    res.status(200).send(`巡回＆Chatworkへの投稿が完了しました。最新URL: ${latestAvailableUrl}`);

  } catch (error) {
    console.error("処理中でエラー発生:", error);
    res.status(500).send(`エラーが発生しました:\n${error.message}`);
  }
});

export default app;
