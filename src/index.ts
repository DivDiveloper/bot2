export default {
  async fetch(request: Request): Promise<Response> {
    // מזהי הצלם והמפתח הרשמיים שחילצת
    const targetUserId = "202140161@N06"; 
    const apiKey = "3faf915241bdfc4b09b7a50a5a4a824a"; 

    // שימוש בכתובת ה-API הציבורית והרשמית של פליקר (מונע קריסות וחסימות)
    const flickrUrl = `https://flickr.com{apiKey}&user_id=${targetUserId}&safe_search=3&format=json&nojsoncallback=1&per_page=5`;

    try {
      const response = await fetch(flickrUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json"
        }
      });

      // מניעת שגיאה 500: בודק אם פליקר החזיר HTML במקום JSON
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const errorText = await response.text();
        return new Response(JSON.stringify({ 
          error: "Flickr returned HTML instead of JSON. The key might be expired.",
          server_response_preview: errorText.substring(0, 300) 
        }, null, 2), {
          status: 502,
          headers: { "Content-Type": "application/json; charset=utf-8" }
        });
      }

      // שליפה תקינה של ה-JSON והצגתו
      const data = await response.json();
      return new Response(JSON.stringify(data, null, 2), {
        headers: { 
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*" 
        }
      });

    } catch (error: any) {
      // במקרה של תקלה ברשת, נחזיר את השגיאה המובנית בצורת JSON מסודר
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
