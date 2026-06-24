import express from 'express';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================== 【設定エリア】 ==================
const CHATWORK_API_TOKEN = "47f3a071fe49e7259100d70071c986b7";
const CHATWORK_ROOM_ID = "440162416"; 

// 🎯 今回テストするURLだけに絞り込み
const SANDBOX_URLS = [
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

async function checkAllInstances() {
  console.log("🧪 【ピンポイントテスト】指定のURLで生存判定の実験を開始します...");
  currentPingTime = ""; 

  const url = SANDBOX_URLS[0];
  const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  const controller = new AbortController();
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

    // パターン1：もし直接 200 OK が返ってきた場合
    if (res.status === 200) {
      console.log(`🟢 [${baseUrl}] 奇跡の直接200 OKを検出！`);
      latestAvailableUrl = baseUrl;
      currentPingTime = ` (判定: Direct OK / ${pingMs}ms)`;
      return;
    }

    // パターン2：エラー（400など）だけど、中身がHTMLの場合
    const rawText = await res.text();
    if (rawText.includes("<!DOCTYPE") || rawText.includes("CodeSandbox") || rawText.includes("proceed")) {
      console.log(`🟢 [${baseUrl}] クッション画面（HTML）を検出。これを生存とみなします！`);
      latestAvailableUrl = baseUrl;
      currentPingTime = ` (判定: クッション画面検知成功 / ${pingMs}ms)`;
      return;
    }

    throw new Error(`想定外のエラー（ステータス: ${res.status}）`);

  } catch (err) {
    clearTimeout(timeoutId);
    console.log(`❌ [${baseUrl}] 判定エラー: ${err.message}`);
    latestAvailableUrl = "⚠️ 対象のCodeSandboxが完全に停止しているか、クレジットが切れています。";
    currentPingTime = "";
  }
}

// 🌐 サイトのトップページ（ / ）にアクセスがあった時の処理
app.get('/', async (req, res) => {
  try {
    await checkAllInstances();

    const replyMessage = 
`📺 自作YouTubeサイト案内Bot (実験モード)

検証対象のURL判定結果はこちらです！
👇
${latestAvailableUrl}${currentPingTime}`;

    await sendChatworkMessage(replyMessage);

    res.status(200).send(`実験完了しました。最新結果: ${latestAvailableUrl}`);

  } catch (error) {
    res.status(500).send(`エラー発生:\n${error.message}`);
  }
});

export default app;
