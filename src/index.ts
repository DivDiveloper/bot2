export default {
  async fetch(request: Request): Promise<Response> {
    const user = "202140161@N06";
    const key = "3faf915241bdfc4b09b7a50a5a4a824a";

    // בניית הכתובת הרשמית על פי התיעוד של Flickr REST API
    const flickrUrl = "https://flickr.com" +
                      "&api_key=" + key +
                      "&user_id=" + user +
                      "&format=json" +
                      "&nojsoncallback=1" +
                      "&per_page=5";

    try {
      const response = await fetch(flickrUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json"
        }
      });

      // הגנה חיונית: בדיקה שהשרת אכן החזיר JSON ולא עמוד HTML חסום
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const errorText = await response.text();
        return new Response(
          JSON.stringify({
            error: "Flickr API did not return JSON format.",
            server_response: errorText.substring(0, 200),
            url_called: flickrUrl
          }),
          { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }

      const data = await response.json();
      return new Response(JSON.stringify(data, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*"
        }
      });

    } catch (error: any) {
      return new Response(
        JSON.stringify({
          error: "Worker Fetch Exception",
          message: error.message
        }),
        { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }
  }
};
