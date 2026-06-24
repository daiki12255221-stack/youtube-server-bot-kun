import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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

serve(async (req) => {
  const nowStr = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  console.log(`[${nowStr}] Supabaseが巡回アクセスを受信（ブロックなし確定）`);

  try {
    const latestAvailableUrl = await checkAllInstances();

    const replyMessage = 
`📺 自作YouTubeサイト案内Bot (自動巡回完了)

現在クレジットが残っていて快適に動くURLはこちらです！
👇
${latestAvailableUrl}`;

    await sendChatworkMessage(replyMessage);

    return new Response(`巡回完了。最新URL: ${latestAvailableUrl}`, { status: 200 });

  } catch (error) {
    console.error("エラー発生:", error);
    return new Response(`エラー: ${error.message}`, { status: 500 });
  }
});

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
  const fetchWithRetry = async (baseUrl, attempt = 1) => {
    const maxAttempts = 3;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒粘る

    try {
      console.log(`📡 [${baseUrl}] 通信試行中... (回数: ${attempt}/${maxAttempts})`);
      const startTime = Date.now();

      const res = await fetch(`${baseUrl}/api/ping`, {
        signal: controller.signal,
        headers: { 
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });
      clearTimeout(timeoutId);

      const endTime = Date.now();
      const pingMs = Math.round(endTime - startTime);

      if (res.status === 200) {
        return { baseUrl, pingMs, reason: `Direct OK (${attempt}回目)` };
      }

      const rawText = await res.text();

      if (rawText.includes("proceed to preview") || rawText.includes("Yes, proceed") || rawText.includes("sandbox was sleeping")) {
        return { baseUrl, pingMs, reason: `Preview Alive (${attempt}回目)` };
      }

      if (rawText.includes("Limit Exceeded") || rawText.includes("Upgrade your plan") || rawText.includes("Credit Expired")) {
        console.log(`❌ [${baseUrl}] クレジット切れ画面のため除外`);
        return null;
      }

      throw new Error(`ステータス: ${res.status}`);

    } catch (err) {
      clearTimeout(timeoutId);
      if (attempt < maxAttempts) {
        return await fetchWithRetry(baseUrl, attempt + 1);
      }
      return null;
    }
  };

  const tasks = SANDBOX_URLS.map(async (url) => {
    const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    return await fetchWithRetry(baseUrl);
  });
  
  const results = await Promise.all(tasks);
  const validResults = results.filter(r => r !== null);

  if (validResults.length > 0) {
    validResults.sort((a, b) => {
      if (a.reason.includes("Direct OK") && !b.reason.includes("Direct OK")) return -1;
      if (!a.reason.includes("Direct OK") && b.reason.includes("Direct OK")) return 1;
      return a.pingMs - b.pingMs;
    });
    return `${validResults[0].baseUrl} (判定: ${validResults[0].reason})`;
  } else {
    return "⚠️ すべてのサブ垢のクレジットが切れているか、停止しています。";
  }
}
