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

// 🛠️ 全サブ垢の生存確認を行う関数
async function checkAllInstances() {
  console.log(`[${new Date().toLocaleString("ja-JP")}] 全サブ垢の生存確認（クッション画面許容モード）を開始します...`);
  
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
          "X-CSB-Skip-Incap-Check": "true",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
        }
      });
      clearTimeout(timeoutId);

      const endTime = performance.now();
      const pingMs = Math.round(endTime - startTime);

      // ✨ 【新・生存判定ロジック】
      // パターン1：奇跡的に直接 200 OK が返ってきた場合
      if (res.status === 200) {
        console.log(`🟢 [${baseUrl}] 直接200 OKを検出！`);
        return { baseUrl, pingMs, reason: "Direct OK" };
      }

      // パターン2：200以外（400など）だけど、中身がHTML（クッション画面）の場合
      const rawText = await res.text();
      if (rawText.includes("<!DOCTYPE") || rawText.includes("CodeSandbox") || rawText.includes("preview")) {
        console.log(`🟢 [${baseUrl}] クッション画面（HTML）を検出。コンテナ自体は生存と判定！`);
        return { baseUrl, pingMs, reason: "Preview Screen (Alive)" };
      }

      // クレジット切れなどの本当のエラー画面の場合
      throw new Error(`Real Error Status: ${res.status}`);

    } catch (err) {
      clearTimeout(timeoutId);
      console.log(`❌ [${baseUrl}] 停止または本当のエラー: ${err.message}`);
      return null; 
    }
  };

  // 全員のレースを一斉スタートして結果を回収
  const tasks = SANDBOX_URLS.map(url => raceTask(url));
  const results = await Promise.all(tasks);

  // 生存と判定されたアカウントだけを抽出
  const validResults = results.filter(r => r !== null);

  if (validResults.length > 0) {
    // 確実に生きてるやつ（できればDirect OK、なければ最初に見つかったやつ）をチョイス
    validResults.sort((a, b) => {
      if (a.reason === "Direct OK" && b.reason !== "Direct OK") return -1;
      if (a.reason !== "Direct OK" && b.reason === "Direct OK") return 1;
      return a.pingMs - b.pingMs;
    });
    
    latestAvailableUrl = validResults[0].baseUrl;
    currentPingTime = ` (判定: ${validResults[0].reason})`;
    console.log("🟢 決定した生存URL:", latestAvailableUrl);
  } else {
    latestAvailableUrl = "⚠️ すべてのサブ垢のクレジットが切れているか、完全に停止しています。";
    currentPingTime = "";
    console.log("⚠️ 生きているアカウントが一つも見つかりませんでした。");
  }
}

// 🌐 サイトのトップページ（ / ）にアクセスがあった時の処理
app.get('/', async (req, res) => {
  const nowStr = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  console.log(`[${nowStr}] 定期チェックアクセスを受信`);

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
