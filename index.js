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
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒タイムアウト

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

  // ⚡【Vercelタイムアウト対策】
  // クローンジョブを待たせないために、先に「200 OK」を返して切断させます
  res.status(200).send("巡回命令を受信しました。裏側で即座に生存チェックとChatwork投稿を開始します。");

  // クローンジョブを帰らせたあとに、Vercelの裏で残りの重い通信処理をノンストップで実行
  try {
    // 1. 時間帯に関係なく、いつでもサブ垢の生存確認を走らせる
    await checkAllInstances();

    // 2. 最新のURLをChatworkに即時投稿
    const replyMessage = 
`📺 自作YouTubeサイト案内Bot (自動巡回完了)

現在クレジットが残っていて快適に動くURLはこちらです！
👇
${latestAvailableUrl}`;

    await sendChatworkMessage(replyMessage);
  } catch (bgError) {
    console.error("バックグラウンド処理でエラー発生:", bgError);
  }
});

// 🔥【Vercel対応】app.listenを削除し、Expressのインスタンスをデフォルトエクスポート
export default app;
