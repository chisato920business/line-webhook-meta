const { createClient } = require("redis");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const client = createClient({
    url: process.env.REDIS_URL
  });

  client.on("error", (err) => console.error("Redis Client Error", err));

  try {
    await client.connect();

    const { session_id, fbc, fbp, product } = req.body;

    if (!session_id) {
      await client.disconnect();
      return res.status(400).json({ error: "session_id is required" });
    }

    const value = JSON.stringify({
      fbc: fbc || null,
      fbp: fbp || null,
      product: product || null,
      created_at: Date.now()
    });

    await client.set(`session:${session_id}`, value, {
      EX: 60 * 30
    });

    console.log("✅ store saved:", {
      session_id,
      fbc,
      fbp,
      product
    });

    await client.disconnect();
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("❌ store error:", error);
    try {
      await client.disconnect();
    } catch (_) {}
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
