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

      // Redisから直近のsessionを取得
      const keys = await client.keys("session:*");
      console.log("🗂 session keys count:", keys.length);

      let latestSession = null;
      let latestCreatedAt = 0;
      let latestKey = null;

      for (const key of keys) {
        const raw = await client.get(key);
        if (!raw) {
          console.log("⚠️ empty raw for key:", key);
          continue;
        }

        try {
          const data = JSON.parse(raw);

          console.log("🔎 checking session key:", key);
          console.log("🔎 session created_at:", data.created_at || null);
          console.log("🔎 session product:", data.product || null);
          console.log("🔎 session fbc exists:", !!data.fbc);
          console.log("🔎 session fbp exists:", !!data.fbp);

          if (data.created_at && data.created_at > latestCreatedAt) {
            latestCreatedAt = data.created_at;
            latestSession = data;
            latestKey = key;
          }
        } catch (parseError) {
          console.log("❌ JSON parse error for key:", key);
          console.log("❌ raw value:", raw);
          console.log("❌ parse error:", parseError);
        }
      }

      console.log("🧩 selected latest key:", latestKey);
      console.log("🧩 latest session:", JSON.stringify(latestSession, null, 2));
      console.log("🔥 latestSession.product:", latestSession?.product || null);
      console.log("🔥 latestSession.fbc:", latestSession?.fbc || null);
      console.log("🔥 latestSession.fbp:", latestSession?.fbp || null);
      console.log("🔥 latestSession.created_at:", latestSession?.created_at || null);

      if (!latestSession) {
        console.log("⚠️ latestSession not found, skip sending to Meta");
        continue;
      }

      const eventName =
        latestSession?.product === "shoyu"
          ? "QualifiedLineRegistration_shoyu"
          : "QualifiedLineRegistration";

      console.log("🎯 eventName:", eventName);

      const payload = {
        data: [
          {
            event_name: eventName,
            event_time: Math.floor(Date.now() / 1000),
            action_source: "website",
            user_data: {
              external_id: [userId],
              ...(latestSession?.fbc ? { fbc: latestSession.fbc } : {}),
              ...(latestSession?.fbp ? { fbp: latestSession.fbp } : {})
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
