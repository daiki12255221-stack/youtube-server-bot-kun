import express from 'express';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================== 【設定エリア】 ==================
const CHATWORK_API_TOKEN = "47f3a071fe49e7259100d70071c986b7";
const CHATWORK_ROOM_ID = "440162416"; 

// 🔥 3つのURLリスト（末尾の / はコード側で自動カットして綺麗に処理します）
const SANDBOX_URLS = [
  "https://jhsnlx-8080.csb.app",
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

// 🛠️ クッション画面をすっ飛ばして check.html を爆速チェックする関数
async function checkSingleInstance(url) {
  const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  const controller = new AbortController();
  
  // ⚡ フロントの軽量HTMLを叩くだけなので、1.5秒で見切る超強気設定
  const timeoutId = setTimeout(() => controller.abort(), 1500); 

  try {
    // 💡 末尾に /check.html をつけて、ダイレクトにHTMLを狙い撃ち！
    const res = await fetch(`${baseUrl}/check.html`, {
      signal: controller.signal,
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
        // 🔥 これで「Yes, proceed」の確認画面を100%完全回避！
        "x-csb-bypass-proxy": "true",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    clearTimeout(timeoutId);

    const rawText = await res.text();

    // ⭕ HTMLの中に仕込んだ秘密の合言葉が入っていれば「完全生存」と判定！
    if (res.status === 200 && rawText.includes("sandbox-is-perfectly-alive")) {
      console.log(`🟢 [${baseUrl}] check.html の読み込みに成功！(生存確定)`);
      return { baseUrl, success: true };
    }

    console.log(`❌ [${baseUrl}] 合言葉が見つかりません（クレジット切れなどの可能性）`);
    return null;
  } catch (err) {
    clearTimeout(timeoutId);
    console.log(`⚠️ [${baseUrl}] 応答なし、またはまだサーバーがスリープ状態です。`);
    return null; 
  }
}

// 🌐 1時間ごとのcronアクセスを受信するメイン処理
app.get('/', async (req, res) => {
  console.log(`[${new Date().toLocaleString("ja-JP")}] クッション画面バイパス・爆速選別を開始します...`);

  let finalUrl = null;

  // 🔄 3つのURLを上から順番に1個ずつチェックしていく（一発抜け方式）
  for (const url of SANDBOX_URLS) {
    console.log(`📡 👀 【調査中】: ${url}/check.html`);
    const result = await checkSingleInstance(url);
    if (result && result.success) {
      finalUrl = result.baseUrl;
      break; // 生きているやつを見つけた瞬間に残りのループをスキップして終了！
    }
  }

  try {
    let replyMessage = "";

    if (finalUrl) {
      // 🟢 使えるURLが1本ビシッと決まった場合
      replyMessage = `📺 自作YouTubeサイト案内Bot (自動巡回完了)

現在クレジットが残っていて快適に動くURLはこちらです！
👇
${finalUrl}`;
    } else {
      // ❌ 3つとも起きなかった、またはクレジット切れだった場合
      replyMessage = `📺 自作YouTubeサイト案内Bot (警告)

⚠️ 現在、利用可能なサブ垢がすべて停止しているか、クレジットが切れている可能性があります。`;
    }

    // Chatworkに決定版を1本だけ送信
    await sendChatworkMessage(replyMessage);
    res.status(200).send(`巡回完了。結果をChatworkへ送信しました。`);

  } catch (error) {
    res.status(500).send(`エラー: ${error.message}`);
  }
});

// ローカル検証用（Vercel側では無視されますが記述しておきます）
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Local server running on port ${PORT}`));

export default app;
