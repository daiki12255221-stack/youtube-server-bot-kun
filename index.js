import express from 'express';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================== 【設定エリア】 ==================
const CHATWORK_API_TOKEN = "47f3a071fe49e7259100d70071c986b7";
const CHATWORK_ROOM_ID = "440162416"; // 案内を自動投稿したいチャット部屋のID

// 【あなたの量産したサブ垢のCodeSandbox URLリスト】
const SANDBOX_URLS = [
  "https://jhsnlx-8080.csb.app",
  "https://v52l6d-8080.csb.app/"
];
// ===================================================

let latestAvailableUrl = "現在、利用可能なサーバーがありません。";

// 💬 Chatworkにメッセージを送信する共通関数
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
  console.log(`[${new Date().toLocaleString("ja-JP")}] 全サブ垢の生存確認を開始します...`);

  const raceTask = async (url) => {
    const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const controller = new AbortController();
    // 🔥【Vercelタイムアウト対策】制限時間を8秒から4秒に縮めて、全体の処理が10秒を超えないようにします
    const timeoutId = setTimeout(() => controller.abort(), 4000); 

    try {
      const res = await fetch(`${baseUrl}/api/ping`, {
        signal: controller.signal,
        headers: { "User-Agent": "Sandbox-Watcher-Bot" }
      });
      clearTimeout(timeoutId);

      if (res.status === 200) {
        return baseUrl;
      }
      throw new Error(`Status: ${res.status}`);
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  try {
    const fastestLiveUrl = await Promise.any(
      SANDBOX_URLS.map(url => raceTask(url))
    );
    latestAvailableUrl = fastestLiveUrl;
    console.log("🟢 現在の最適生存URL:", latestAvailableUrl);
  } catch (error) {
    latestAvailableUrl = "⚠️ すべてのサブ垢のクレジットが切れているか、停止しています。";
    console.error("❌ 生きているアカウントが一つも見つかりませんでした。");
  }
}

// ---------------------------------------------------
// 🌐 サイトのトップページ（ / ）にアクセスがあった時の処理
// ---------------------------------------------------
app.get('/', async (req, res) => {
  const nowStr = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  console.log(`[${nowStr}] 定期チェックアクセスを受信（24時間稼働モード）`);

  try {
    // ⚡【凍結防止対策】
    // 先にレスポンスを返さず、生存確認とChatworkへの投稿が「完全に終わるまで」しっかり待ちます！
    
    // 1. サブ垢の生存確認を走らせる（最長4秒）
    await checkAllInstances();

    // 2. 最新のURLをChatworkに投稿する（約1〜2秒）
    const replyMessage = 
`📺 自作YouTubeサイト案内Bot (自動巡回完了)

現在クレジットが残っていて快適に動くURLはこちらです！
👇
${latestAvailableUrl}`;

    await sendChatworkMessage(replyMessage);

    // ✨ すべての処理が無事に終わった後に、クローンジョブに「完了したよ！」と返信します
    res.status(200).send(`巡回＆Chatworkへの投稿が完了しました。最新URL: ${latestAvailableUrl}`);

  } catch (error) {
    console.error("処理中でエラー発生:", error);
    res.status(500).send(`エラーが発生しました:\n${error.message}`);
  }
});

// 🔥【Vercel対応】Expressのインスタンスをデフォルトエクスポート
export default app;
