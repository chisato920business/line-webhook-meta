const { createClient } = require("redis");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://magic-barrel.com");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).send("Method Not Allowed");
  }

  const client = createClient({
    url: process.env.REDIS_URL
  });

  client.on("error", (err) => console.error("Redis Client Error:", err));

  try {
    await client.connect();

    const sessionId = req.query.session_id;
    const redirectTo = "https://lin.ee/QqQxcDd";

    if (!sessionId) {
      await client.disconnect();
      return res.status(400).send("session_id is required");
    }

    const payload = {
      session_id: sessionId,
      product: "shoyu",
      redirect_to: redirectTo,
      created_at: Date.now()
    };

    await client.set(
      `pending_line_session:${sessionId}`,
      JSON.stringify(payload),
      { EX: 60 * 30 }
    );

    console.log("✅ saved pending_line_session:", JSON.stringify(payload, null, 2));

    await client.disconnect();

    return res.redirect(redirectTo);
  } catch (error) {
    console.error("❌ line-redirect error:", error);
    try {
      await client.disconnect();
    } catch (_) {}
    return res.status(500).send("internal error");
  }
};
