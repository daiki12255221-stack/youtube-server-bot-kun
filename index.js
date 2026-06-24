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

// 🛠️ Vercelの10秒制限の枠内で選別する関数
async function checkInstancesWithTimeout() {
  const controller = new AbortController();
  // ⚡ Vercelが死ぬ前に「7.5秒」で強引に見切るタイマー
  const timeoutId = setTimeout(() => controller.abort(), 7500); 

  const raceTask = async (url) => {
    const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    try {
      const startTime = performance.now();
      const res = await fetch(`${baseUrl}/api/ping`, {
        signal: controller.signal,
        headers: { 
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });

      const pingMs = Math.round(performance.now() - startTime);

      if (res.status === 200) return { baseUrl, pingMs, reason: "Direct OK" };

      const rawText = await res.text();
      if (rawText.includes("proceed to preview") || rawText.includes("Yes, proceed") || rawText.includes("sandbox was sleeping")) {
        return { baseUrl, pingMs, reason: "Preview Alive" };
      }
      return null; // クレジット切れなどは除外
    } catch {
      return null; // タイムアウトや落ちている場合は無視
    }
  };

  try {
    const tasks = SANDBOX_URLS.map(url => raceTask(url));
    const results = await Promise.all(tasks);
    clearTimeout(timeoutId);
    return results.filter(r => r !== null);
  } catch {
    return []; // エラー時は空配列を返す
  }
}

// 🌐 巡回アクセスを受信したときの処理
app.get('/', async (req, res) => {
  console.log(`[${new Date().toLocaleString("ja-JP")}] Vercel超速見切りモード実行`);

  try {
    // 7.5秒だけ本気で生存確認を待ってみる
    const validResults = await checkInstancesWithTimeout();

    let replyMessage = "";

    if (validResults.length > 0) {
      // 🎉 7.5秒以内に起きてるやつが見つかった場合
      validResults.sort((a, b) => {
        if (a.reason === "Direct OK" && b.reason !== "Direct OK") return -1;
        if (a.reason !== "Direct OK" && b.reason === "Direct OK") return 1;
        return a.pingMs - b.pingMs;
      });
      
      replyMessage = `📺 自作YouTubeサイト案内Bot (最速選別完了)

現在クレジットが残っていてすぐ動くURLはこちらです！
👇
${validResults[0].baseUrl} (${validResults[0].reason})`;

    } else {
      // ⏳ 7.5秒以内に返事がなかった場合（CodeSandboxがまだ爆睡中のとき）
      // タイムアウトエラーで落ちる前に、今起こし中のURLを全部送ってVercelの処理を終わらせる！
      replyMessage = `📺 自作YouTubeサイト案内Bot (一斉起床ノック送信)

サブ垢がまだ爆睡中のため、現在一斉に叩き起こしています！
15秒ほど待ってから、以下のどれかを選んで踏んでみてください（どれかが生きてます！）
👇
① ${SANDBOX_URLS[0]}
② ${SANDBOX_URLS[1]}
③ ${SANDBOX_URLS[2]}`;
    }

    // Chatworkに送信
    await sendChatworkMessage(replyMessage);
    res.status(200).send("Vercelタイムアウト回避成功。Chatworkへ送信しました。");

  } catch (error) {
    res.status(500).send(`エラー: ${error.message}`);
  }
});

export default app;
