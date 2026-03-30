module.exports = async function handler(req, res) {
  console.log("🔥 webhook hit");

  if (req.method !== "POST") {
    console.log("⛔ Method Not Allowed:", req.method);
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const body = req.body;
    console.log("📦 req.body:", JSON.stringify(body, null, 2));

    const events = body.events || [];

    const PIXEL_ID = process.env.META_PIXEL_ID;
    const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

    for (const event of events) {
      console.log("📩 event.type:", event.type);

      if (event.type === "follow") {
        const userId = event.source?.userId;

        console.log("LINE追加された！");
        console.log("userId:", userId);

        const payload = {
          data: [
            {
              event_name: "QualifiedLineRegistration_shoyu",
              event_time: Math.floor(Date.now() / 1000),
              action_source: "website",
              user_data: {
                external_id: [userId]
              }
            }
          ]
        };

        console.log("CAPI payload:", JSON.stringify(payload, null, 2));

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
        console.log("Meta response:", JSON.stringify(result, null, 2));
      }
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).send("Error");
  }
};
