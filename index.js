import express from 'express';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================== 【設定エリア】 ==================
const CHATWORK_API_TOKEN = "47f3a071fe49e7259100d70071c986b7";
const CHATWORK_ROOM_ID = "440162416"; 

const SANDBOX_URLS = [
  "https://jhsnlx-8080.csb.app",
  "https://v52l6d-8080.csb.app/"
];
// ===================================================

// 🌐 サイトのトップページ（ / ）にアクセスがあった時の処理
app.get('/', async (req, res) => {
  const nowStr = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  
  // 画面（ブラウザ）に返すためのレポート用テキストを溜める変数
  let htmlReport = `
    <html>
    <head>
      <meta charset="utf-8">
      <title>CodeSandbox 接続テスト結果</title>
      <style>
        body { font-family: monospace; background: #1e1e1e; color: #d4d4d4; padding: 20px; line-height: 1.5; }
        h1 { color: #569cd6; border-bottom: 1px solid #3c3c3c; padding-bottom: 10px; }
        .box { background: #252526; border: 1px solid #3c3c3c; padding: 15px; margin-bottom: 20px; border-radius: 4px; }
        .url { font-weight: bold; color: #4ec9b0; }
        .status { font-weight: bold; padding: 2px 6px; border-radius: 3px; }
        .success { background: #164320; color: #b5cea8; }
        .error { background: #4a1515; color: #f44747; }
        pre { background: #2d2d2d; padding: 10px; overflow-x: auto; border-radius: 4px; color: #9cdcfe; white-space: pre-wrap; word-wrap: break-word; }
      </style>
    </head>
    <body>
      <h1>🔍 CodeSandbox 生存確認レポート</h1>
      <p>実行時刻: ${nowStr}</p>
  `;

  // 生存確認レースのタスク
  const raceTask = async (url) => {
    const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const controller = new AbortController();
    
    // ⚡ Vercelの上限ギリギリの9秒まで粘る
    const timeoutId = setTimeout(() => controller.abort(), 9000); 

    let resultLog = `<div class="box"><span class="url">🔗 Target: ${baseUrl}</span><br><br>`;

    try {
      const startTime = performance.now();

      const response = await fetch(`${baseUrl}/api/ping`, {
        signal: controller.signal,
        headers: { 
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
          "X-CSB-Skip-Incap-Check": "true",
          "Accept": "application/json"
        }
      });
      clearTimeout(timeoutId);

      const endTime = performance.now();
      const pingMs = Math.round(endTime - startTime);

      if (response.status === 200) {
        resultLog += `🟢 <span class="status success">STATUS: 200 OK (${pingMs}ms)</span><br><br>`;
        resultLog += `🎉 正常にExpressと通信できました！</div>`;
        return { success: true, url: baseUrl, pingMs, log: resultLog };
      } else {
        resultLog += `❌ <span class="status error">STATUS: ${response.status}</span><br><br>`;
        
        // 200以外の場合、相手が返してきた生の文字（クッション画面のHTMLなど）をぶちまける
        const rawBody = await response.text();
        resultLog += `📄 <b>CodeSandboxからの返答（最初の500文字）:</b><br><pre>${escapeHtml(rawBody.substring(0, 500))}</pre></div>`;
        return { success: false, log: resultLog };
      }

    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        resultLog += `⏳ <span class="status error">TIMEOUT</span><br><br>`;
        resultLog += `⚠️ 9秒待ってもCodeSandboxから返事がありませんでした（まだ爆睡中か、途中で通信が切られました）。</div>`;
      } else {
        resultLog += `💥 <span class="status error">FETCH ERROR</span><br><br>`;
        resultLog += `⚠️ 通信自体が失敗しました。<br>エラーメッセージ: <pre>${err.message}</pre></div>`;
      }
      return { success: false, log: resultLog };
    }
  };

  // 一斉にチェック開始
  const results = await Promise.all(SANDBOX_URLS.map(url => raceTask(url)));

  // 全サブ垢のログをHTMLに合流させる
  results.forEach(r => { htmlReport += r.log; });

  // 有効なURLがあるか判定
  const validResults = results.filter(r => r.success);
  let latestAvailableUrl = "現在、利用可能なサーバーがありません。";
  let currentPingTime = "";

  if (validResults.length > 0) {
    validResults.sort((a, b) => a.pingMs - b.pingMs);
    latestAvailableUrl = validResults[0].url;
    currentPingTime = ` (最速応答: ${validResults[0].pingMs}ms)`;
  }

  htmlReport += `
      <div class="box" style="border-color: #569cd6;">
        <h3>📢 Chatwork宛てに送る予定の判定結果</h3>
        <p><b>確定URL:</b> ${latestAvailableUrl}${currentPingTime}</p>
      </div>
    </body>
    </html>
  `;

  // 💥 Chatworkへの送信は、デバッグの邪魔にならないよう裏でそっと投げる（エラーでも画面は止めない）
  try {
    const replyMessage = `📺 自作YouTubeサイト案内Bot (デバッグ巡回完了)\n\n現在地URL:\n${latestAvailableUrl}${currentPingTime}`;
    await fetch(`https://api.chatwork.com/v2/rooms/${CHATWORK_ROOM_ID}/messages`, {
      method: "POST",
      headers: {
        "X-ChatWorkToken": CHATWORK_API_TOKEN,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ body: replyMessage }),
    });
  } catch (e) {
    // スルー
  }

  // 🎯 最後に完成した綺麗（？）なデバッグ画面をブラウザにドン！と返す
  res.status(200).send(htmlReport);
});

// HTMLのタグをバグらせずに文字として表示するための便利関数
function escapeHtml(string) {
  if (typeof string !== 'string') return string;
  return string.replace(/[&'`"<>]/g, function (match) {
    return { '&': '&amp;', "'": '&#x27;', '`': '&#x60;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[match];
  });
}

export default app;
