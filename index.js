import express from 'express';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================== 【設定エリア】 ==================
const CHATWORK_API_TOKEN = "47f3a071fe49e7259100d70071c986b7";
const CHATWORK_ROOM_ID = "440162416"; 

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
  console.log("🧪 【鉄壁のHTML選別モード】クッション画面だけを見分けます...");
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

    // 【1】 奇跡的に200 OKが返ってきたら当然文句なしで生存！
    if (res.status === 200) {
      console.log(`🟢 [${baseUrl}] 直接200 OKを検出！`);
      latestAvailableUrl = baseUrl;
      currentPingTime = ` (判定: Direct OK / ${pingMs}ms)`;
      return;
    }

    // 【2】 200以外（400など）だった場合、HTMLの中身を大捜査
    const rawText = await res.text();

    // 🚨 まず「絶対に死んでるキーワード（クレジット切れ画面など）」を弾く
    if (rawText.includes("Limit Exceeded") || rawText.includes("Upgrade your plan") || rawText.includes("Credit Expired")) {
      console.log(`❌ [${baseUrl}] 警告：クレジット切れ、またはプラン上限エラー画面を検出しました。`);
      throw new Error("クレジット切れ画面に遭遇");
    }

    // ⭕ 生きている時のクッション画面特有のキーワードが入っているかチェック
    if (rawText.includes("proceed to preview") || rawText.includes("Yes, proceed") || rawText.includes("sandbox was sleeping")) {
      console.log(`🟢 [${baseUrl}] 正真正銘の「生存クッション画面」を検出！友達が踏めば起きる状態です。`);
      latestAvailableUrl = baseUrl;
      currentPingTime = ` (判定: 生存クッション画面 / ${pingMs}ms)`;
      return;
    }

    // どちらでもない謎のHTMLエラーの場合
    throw new Error(`想定外のエラー画面（ステータス: ${res.status}）`);

  } catch (err) {
    clearTimeout(timeoutId);
    console.log(`❌ [${baseUrl}] 停止・死亡と判定: ${err.message}`);
    latestAvailableUrl = "⚠️ 対象のCodeSandboxが完全に停止しているか、クレジットが切れています。";
    currentPingTime = "";
  }
}

app.get('/', async (req, res) => {
  try {
    await checkAllInstances();

    const replyMessage = 
`📺 自作YouTubeサイト案内Bot (選別判定モード)

検証対象のURL判定結果はこちらです！
👇
${latestAvailableUrl}${currentPingTime}`;

    await sendChatworkMessage(replyMessage);
    res.status(200).send(`検証完了: ${latestAvailableUrl}`);
  } catch (error) {
    res.status(500).send(`エラー発生:\n${error.message}`);
  }
});

export default app;
