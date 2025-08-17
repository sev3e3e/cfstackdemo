import { http } from "@google-cloud/functions-framework";

http("relay", async (req, res) => {
  let { url, method = "GET", headers = {}, body = null } = req.body;

  // バリデーション
  if (!url) {
    res.status(400).send("URL parameter is required");
    return;
  }

  if (Object.keys(headers).length == 0) {
    console.log("header is none. add some required something");
    headers = {
      "Content-Type": "application/json",
      cookie: "hello=1; there=true;",
    };
  }

  try {
    const response = await fetch(url, {
      method,
      headers: headers,
      body: body ? body : null,
    });

    if (!response.ok) {
      res.status(response.status).send(await response.text());
      return;
    }

    res.status(200).send(await response.text());
  } catch (error) {
    res.status(500).send(error);
  }
});
