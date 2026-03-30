const { createClient } = require("redis");

module.exports = async function handler(req, res) {
  console.log("🔥 webhook hit");

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const client = createClient({
    url: process.env.REDIS_URL
  });

  client.on("error", (err) => console.error("Redis Client Error", err));

  try {
    await client.connect();

    const body = req.body;
    console.log("📦 req.body:", JSON.stringify(body, null, 2));

    const events = body.events || [];

    const PIXEL_ID = process.env.META_PIXEL_ID;
    const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

    for (const event of events) {
      console.log("📩 event.type:", event.type);

      if (event.type !== "follow") {
        continue;
      }

      const userId = event.source?.userId;
      console.log("👤 userId:", userId);

      // Redisから直近のsessionを取得
      const keys = await client.keys("session:*");

      let latestSession = null;
      let latestCreatedAt = 0;

      for (const key of keys) {
        const raw = await client.get(key);
        if (!raw) continue;

        const data = JSON.parse(raw);
        if (data.created_at && data.created_at > latestCreatedAt) {
          latestCreatedAt = data.created_at;
          latestSession = data;
        }
      }

      console.log("🧩 latest session:", JSON.stringify(latestSession, null, 2));

      const payload = {
        data: [
          {
            event_name:
              latestSession?.product === "shoyu"
                ? "QualifiedLineRegistration_shoyu"
                : "QualifiedLineRegistration",
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

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      const result = await response.json();
      console.log("📊 Meta response:", JSON.stringify(result, null, 2));
    }

    await client.disconnect();
    return res.status(200).send("OK");
  } catch (error) {
    console.error("❌ Error:", error);
    try {
      await client.disconnect();
    } catch (_) {}
    return res.status(500).send("Error");
  }
};
