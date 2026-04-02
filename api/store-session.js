const { createClient } = require("redis");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://magic-barrel.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const client = createClient({
    url: process.env.REDIS_URL
  });

  client.on("error", (err) => console.error("Redis Client Error:", err));

  try {
    await client.connect();

    const {
      session_id,
      product,
      fbc,
      fbp,
      page_path,
      user_agent
    } = req.body;

    if (!session_id) {
      await client.disconnect();
      return res.status(400).json({ error: "session_id is required" });
    }

    const payload = {
      session_id,
      product: product || "shoyu",
      fbc: fbc || null,
      fbp: fbp || null,
      page_path: page_path || null,
      user_agent: user_agent || null,
      created_at: Date.now()
    };

    await client.set(`session:${session_id}`, JSON.stringify(payload), {
      EX: 60 * 60 * 24 * 7
    });

    await client.disconnect();
    return res.status(200).json({ ok: true, payload });
  } catch (error) {
    console.error("❌ store-session error:", error);
    try {
      await client.disconnect();
    } catch (_) {}
    return res.status(500).json({ error: "internal error" });
  }
};
