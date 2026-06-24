import express from 'express';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const CHATWORK_API_TOKEN = "47f3a071fe49e7259100d70071c986b7";
const CHATWORK_ROOM_ID = "440162416"; 

const SANDBOX_URLS = [
  "https://jhsnlx-8080.csb.app",
  "https://v52l6d-8080.csb.app/"
];

let latestAvailableUrl = "現在、利用可能なサーバーがありません。";
let currentPingTime = ""; 

async function sendChatworkMessage(message) {
  await fetch(`https://api.chatwork.com/v2/rooms/${CHATWORK_ROOM_ID}/messages`, {
    method: "POST",
    headers: {
      "X-ChatWorkToken": CHATWORK_API_TOKEN,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ body: message }),
  });
}

async function checkAllInstances() {
  console.log("🔍 【デバッグモード】CodeSandboxの返答を徹底調査します...");
  
  currentPingTime = ""; 

  const raceTask = async (url) => {
    const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000); 

    try {
      const res = await fetch(`${baseUrl}/api/ping`, {
        signal: controller.signal,
        headers: { 
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
          "X-CSB-Skip-Incap-Check": "true",
          "Accept": "application/json"
        }
      });
      clearTimeout(timeoutId);

      // 🛑 ここでステータスコードを細かくログに出す（200、400、403、502など）
      console.log(`📡 [${baseUrl}] ステータスコード: ${res.status}`);

      if (res.status === 200) {
        return { baseUrl, pingMs: 0 }; 
      }

      // 💥 200以外の場合、CodeSandboxが返してきた「生テキスト（HTMLなど）」を300文字だけ覗き見する
      const errorText = await res.text();
      console.log(`⚠️ [${baseUrl}] 返ってきたエラー中身(一部): ${errorText.substring(0, 300)}`);
      
      throw new Error(`Status: ${res.status}`);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.log(`⏳ [${baseUrl}] 9秒待っても応答がありませんでした（タイムアウト）`);
      } else {
        console.log(`❌ [${baseUrl}] 通信エラー発生: ${err.message}`);
      }
      return null; 
    }
  };

  const results = await Promise.all(SANDBOX_URLS.map(url => raceTask(url)));
  const validResults = results.filter(r => r !== null);

  if (validResults.length > 0) {
    latestAvailableUrl = validResults[0].baseUrl;
  } else {
    latestAvailableUrl = "⚠️ すべてのサブ垢が停止、またはブロックされています。";
  }
}

app.get('/', async (req, res) => {
  await checkAllInstances();
  res.status(200).send("デバッグ巡回が完了しました。Vercelのログ（Logs）を確認してください。");
});

export default app;
