const { createClient } = require("redis");

module.exports = async function handler(req, res) {
  console.log("🔥 webhook hit");

  if (req.method !== "POST") {
    console.log("⛔ invalid method:", req.method);
    return res.status(405).send("Method Not Allowed");
  }

  const client = createClient({
    url: process.env.REDIS_URL
  });

  client.on("error", (err) => console.error("❌ Redis Client Error:", err));

  try {
    await client.connect();
    console.log("✅ Redis connected");

    const body = req.body;
    console.log("📦 req.body:", JSON.stringify(body, null, 2));

    const events = body?.events || [];
    console.log("📦 events count:", events.length);

    const PIXEL_ID = process.env.META_PIXEL_ID;
    const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

    if (!PIXEL_ID) {
      console.log("❌ META_PIXEL_ID is missing");
    }

    if (!ACCESS_TOKEN) {
      console.log("❌ META_ACCESS_TOKEN is missing");
    }

    for (const event of events) {
      console.log("========================================");
      console.log("📩 event.type:", event.type);
      console.log("📩 full event:", JSON.stringify(event, null, 2));

      if (event.type !== "follow") {
        console.log("↩️ skip: event.type is not follow");
        continue;
      }

      const userId = event.source?.userId;
      console.log("👤 userId:", userId);

      if (!userId) {
        console.log("⚠️ userId is missing, skip");
        continue;
      }

      // ① LINEクリック直後の候補だけを見る
      const pendingKeys = await client.keys("pending_line_session:*");
      console.log("🗂 pending_line_session keys count:", pendingKeys.length);

      let latestPending = null;
      let latestPendingCreatedAt = 0;
      let latestPendingKey = null;

      for (const key of pendingKeys) {
        const raw = await client.get(key);
        if (!raw) {
          console.log("⚠️ empty raw for pending key:", key);
          continue;
        }

        try {
          const data = JSON.parse(raw);

          console.log("🔎 checking pending key:", key);
          console.log("🔎 pending created_at:", data.created_at || null);
          console.log("🔎 pending session_id:", data.session_id || null);
          console.log("🔎 pending product:", data.product || null);

          if (data.created_at && data.created_at > latestPendingCreatedAt) {
            latestPendingCreatedAt = data.created_at;
            latestPending = data;
            latestPendingKey = key;
          }
        } catch (parseError) {
          console.log("❌ JSON parse error for pending key:", key);
          console.log("❌ raw value:", raw);
          console.log("❌ parse error:", parseError);
        }
      }

      console.log("🧩 selected pending key:", latestPendingKey);
      console.log("🧩 latest pending session:", JSON.stringify(latestPending, null, 2));

      if (!latestPending?.session_id) {
        console.log("⚠️ latestPending.session_id not found, skip sending to Meta");
        continue;
      }

      // ② そのsession_idに紐づく本体sessionを読む
      const sessionKey = `session:${latestPending.session_id}`;
      const sessionRaw = await client.get(sessionKey);

      if (!sessionRaw) {
        console.log("⚠️ sessionRaw not found for key:", sessionKey);
        continue;
      }

      let selectedSession = null;

      try {
        selectedSession = JSON.parse(sessionRaw);
      } catch (parseError) {
        console.log("❌ JSON parse error for session key:", sessionKey);
        console.log("❌ raw session value:", sessionRaw);
        console.log("❌ parse error:", parseError);
        continue;
      }

      console.log("🧩 selected session key:", sessionKey);
      console.log("🧩 selected session:", JSON.stringify(selectedSession, null, 2));
      console.log("🔥 selectedSession.product:", selectedSession?.product || null);
      console.log("🔥 selectedSession.fbc:", selectedSession?.fbc || null);
      console.log("🔥 selectedSession.fbp:", selectedSession?.fbp || null);
      console.log("🔥 selectedSession.created_at:", selectedSession?.created_at || null);

      if (!selectedSession) {
        console.log("⚠️ selectedSession not found, skip sending to Meta");
        continue;
      }

      const eventName =
        selectedSession?.product === "shoyu"
          ? "QualifiedLineRegistration_shoyu"
          : "QualifiedLineRegistration";

      console.log("🎯 eventName:", eventName);

      // 重複排除しやすくするためevent_id追加
      const eventId = `line_follow_${userId}_${latestPending.session_id}`;

      const payload = {
        data: [
          {
            event_name: eventName,
            event_time: Math.floor(Date.now() / 1000),
            event_id: eventId,
            action_source: "website",
            event_source_url: "https://magic-barrel.com/4",
            user_data: {
              external_id: [userId],
              ...(selectedSession?.fbc ? { fbc: selectedSession.fbc } : {}),
              ...(selectedSession?.fbp ? { fbp: selectedSession.fbp } : {})
            }
          }
        ]
      };

      console.log("🔥 CAPI payload:", JSON.stringify(payload, null, 2));

      const url = `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;
      console.log("🌐 Meta request URL:", url.replace(ACCESS_TOKEN, "****hidden****"));

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      console.log("📊 Meta response status:", response.status);
      console.log("📊 Meta response ok:", response.ok);
      console.log("📊 Meta response body:", JSON.stringify(result, null, 2));

      // ③ 送信後、使ったpendingを削除
      if (latestPendingKey) {
        await client.del(latestPendingKey);
        console.log("🗑 deleted pending key:", latestPendingKey);
      }
    }

    await client.disconnect();
    console.log("✅ Redis disconnected");
    return res.status(200).send("OK");
  } catch (error) {
    console.error("❌ Error:", error);
    try {
      await client.disconnect();
      console.log("✅ Redis disconnected after error");
    } catch (_) {
      console.log("⚠️ Redis disconnect failed after error");
    }
    return res.status(500).send("Error");
  }
};
