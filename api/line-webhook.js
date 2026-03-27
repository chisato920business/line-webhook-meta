const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const body = req.body;
    const events = body.events || [];

    const PIXEL_ID = process.env.META_PIXEL_ID;
    const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

    for (const event of events) {
      if (event.type === "follow") {
        const userId = event.source?.userId;

        console.log("LINE追加された！");
        console.log("userId:", userId);

        const response = await fetch(
          `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
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
            })
          }
        );

        const result = await response.json();
        console.log("Meta response:", JSON.stringify(result));
      }
    }

    return res.status(200).send("OK");

  } catch (error) {
    console.error(error);
    return res.status(500).send("Error");
  }
};
