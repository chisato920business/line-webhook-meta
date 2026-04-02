const { createClient } = require("redis");

module.exports = async function handler(req, res) {
  const client = createClient({
    url: process.env.REDIS_URL
  });

  client.on("error", (err) => console.error("Redis Client Error:", err));

  try {
    await client.connect();

    const sessionId = req.query.session_id;

    if (!sessionId) {
      await client.disconnect();
      return res.status(400).send("session_id is required");
    }

    const payload = {
      session_id: sessionId,
      linked_at: Date.now()
    };

    await client.set(
      `pending_line_session:${sessionId}`,
      JSON.stringify(payload),
      { EX: 60 * 30 }
    );

    console.log("✅ saved pending_line_session:", payload);

    await client.disconnect();

    return res.redirect("https://lin.ee/QqQxcDd"); // ← 本物のLINE URLに差し替え
  } catch (error) {
    console.error("❌ line-redirect error:", error);
    try {
      await client.disconnect();
    } catch (_) {}
    return res.status(500).send("internal error");
  }
};
