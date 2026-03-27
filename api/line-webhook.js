export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const body = req.body;
    const events = body.events || [];

    for (const event of events) {
      if (event.type === "follow") {
        console.log("LINE追加された！");
        console.log("userId:", event.source?.userId);
      }
    }

    return res.status(200).send("OK");
  } catch (e) {
    console.error(e);
    return res.status(500).send("Error");
  }
}
