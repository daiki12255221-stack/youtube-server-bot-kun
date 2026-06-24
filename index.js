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

// 🛠️ 1つのURLに対して、Vercelが死なない程度の短時間で生存確認する関数
async function checkSingleInstance(url) {
  const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  const controller = new AbortController();
  
  // ⚡ 1つのURLにつき「最長2.5秒」だけ待つ（寝起きが遅ければ次へ行く）
  const timeoutId = setTimeout(() => controller.abort(), 2500); 

  try {
    const res = await fetch(`${baseUrl}/api/ping`, {
      signal: controller.signal,
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    clearTimeout(timeoutId);

    if (res.status === 200) {
      return { baseUrl, success: true, reason: "Direct OK" };
    }

    const rawText = await res.text();
    // ホワイトリスト検証
    if (rawText.includes("proceed to preview") || rawText.includes("Yes, proceed") || rawText.includes("sandbox was sleeping")) {
      return { baseUrl, success: true, reason: "Preview Alive" };
    }

    // クレジット切れ画面などの場合は不合格
    return null;
  } catch (err) {
    clearTimeout(timeoutId);
    return null; // タイムアウトやエラーは不合格（次へ行く）
  }
}

// 🌐 1時間ごとのcronアクセスを受信するメイン処理
app.get('/', async (req, res) => {
  console.log(`[${new Date().toLocaleString("ja-JP")}] Vercel順次ノック選別を開始します...`);

  let finalUrl = null;
  let finalReason = "";

  // 🔄 3つのURLを上から順番に1個ずつチェックしていく（一発抜け方式）
  for (const url of SANDBOX_URLS) {
    console.log(`📡 👀 【調査中】: ${url}`);
    const result = await checkSingleInstance(url);
    
    if (result && result.success) {
      // 🎉 生きている（使える）やつを見つけた瞬間に、残りのURLのチェックを止めてループを抜ける！
      finalUrl = result.baseUrl;
      finalReason = result.reason;
      break; 
    }
  }

  try {
    let replyMessage = "";

    if (finalUrl) {
      // 🟢 使えるURLが1本ビシッと決まった場合
      replyMessage = `📺 自作YouTubeサイト案内Bot (自動巡回完了)

現在クレジットが残っていて快適に動くURLはこちらです！
👇
${finalUrl} (判定: ${finalReason})`;
    } else {
      // ❌ 3つとも2.5秒以内に起きなかった、またはクレジット切れだった場合
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

export default app;
