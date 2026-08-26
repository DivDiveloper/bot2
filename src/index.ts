export default {
  async fetch(request: Request): Promise<Response> {
    const urlObj = new URL(request.url);
    
    // שליפת ה-CSRF באופן דינמי מכתובת ה-URL (למשל: ?csrf=...)
    // אם לא תשלח ב-URL, הוא ישתמש בברירת המחדל שמצאת באנדרואיד
    const csrfToken = urlObj.searchParams.get("csrf") || "1787806979:b4tbq9uukgc:f6e100e63ed002c1cb906663c99c1ac5";

    const targetUserId = "202140161@N06"; // מזהה הצלם שאתה רוצה לשלוף
    const apiKey = "3faf915241bdfc4b09b7a50a5a4a824a"; // ה-site_key שמצאת

    // תיקון הכתובת: הוספת ה-? ושם הפרמטר api_key=
    const flickrUrl = `https://flickr.com?api_key=${apiKey}&user_id=${targetUserId}&safe_search=3&csrf_token=${csrfToken}&format=json&nojsoncallback=1&per_page=5`;

    try {
      const response = await fetch(flickrUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
          "Accept": "application/json"
        }
      });

      const data = await response.json();

      return new Response(JSON.stringify(data, null, 2), {
        headers: { 
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*" 
        }
      });

    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
