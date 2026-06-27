import express from 'express';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================== 【設定エリア】 ==================
const CHATWORK_API_TOKEN = "47f3a071fe49e7259100d70071c986b7";
const CHATWORK_ROOM_ID = "440162416"; 

// 🔥 最新の4つのURLリスト
const SANDBOX_URLS = [
  "https://jhsnlx-8080.csb.app",
  "https://3qk3hw-8080.csb.app",
  "https://v52l6d-8080.csb.app",
  "https://znpf9v-3000.csb.app"
];
// ===================================================

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
  if (!res.ok) console.log("❌ Chatwork送信エラー:", await res.text());
}

// 🛠️ クッション画面の文言 or ダイレクト直通（200 OK）の両方を1回で判定する関数
async function checkSingleInstance(url) {
  const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  const controller = new AbortController();
  
  // ⚡ 2秒で見切る設定（HTMLの文字チェックなのでこれで十分です）
  const timeoutId = setTimeout(() => controller.abort(), 2000); 

  try {
    // 💡 クッションを抜けるためのヘッダーは外し、正面からトップページ（/）を見にいきます
    const res = await fetch(baseUrl, {
      signal: controller.signal,
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    clearTimeout(timeoutId);

    const rawText = await res.text();

    // 🎯 【ハイブリッド判定ロジック】
    // パターンA：直接入れて正常に応答した（res.status === 200）
    // パターンB：クッション画面が出ている（proceed to preview または do you want to continue が含まれる）
    const isDirectOk = (res.status === 200);
    const isCushionOk = rawText.includes("proceed to preview") || rawText.includes("do you want to continue");

    if (isDirectOk || isCushionOk) {
      const mode = isDirectOk ? "ダイレクト直通" : "クッション画面検出";
      console.log(`🟢 [${baseUrl}] 生存確認に成功しました！ (${mode})`);
      return { baseUrl, success: true };
    }

    console.log(`❌ [${baseUrl}] 不合格（クレジット切れエラー画面、または別の応答です）`);
    return null;
  } catch (err) {
    clearTimeout(timeoutId);
    console.log(`⚠️ [${baseUrl}] タイムアウト、またはサーバーが完全に停止しています。`);
    return null; 
  }
}

// 🌐 1時間ごとのcronアクセスを受信するメイン処理
app.get('/', async (req, res) => {
  console.log(`[${new Date().toLocaleString("ja-JP")}] ハイブリッド生存選別を開始します...`);

  let finalUrl = null;

  // 🔄 4つのURLを上から順番に1個ずつチェック（一発抜け方式）
  for (const url of SANDBOX_URLS) {
    console.log(`📡 👀 【調査中】: ${url}`);
    const result = await checkSingleInstance(url);
    if (result && result.success) {
      finalUrl = result.baseUrl;
      break; 
    }
  }

  try {
    let replyMessage = "";

    if (finalUrl) {
      replyMessage = `📺 自作YouTubeサイト案内Bot (自動巡回完了)

現在クレジットが残っていて快適に動くURLはこちらです！
👇
${finalUrl}`;
    } else {
      replyMessage = `📺 自作YouTubeサイト案内Bot (警告)

⚠️ 現在、利用可能なサブ垢がすべて停止しているか、クレジットが切れている可能性があります。`;
    }

    await sendChatworkMessage(replyMessage);
    res.status(200).send(`巡回完了。結果をChatworkへ送信しました。`);

  } catch (error) {
    res.status(500).send(`エラー: ${error.message}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Local server running on port ${PORT}`));

export default app;
