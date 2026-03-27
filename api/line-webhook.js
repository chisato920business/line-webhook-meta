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
