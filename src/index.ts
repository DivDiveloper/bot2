export default {
  async fetch(request: Request): Promise<Response> {
    // מזהה המשתמש הספציפי שאתה מחפש את התמונות שלו
    const targetUser = "202140161@N06"; 
    
    // ה-API Key הפנימי שסיפקת בקוד הקודם
    const apiKey = "47a02e6ef4e2c50d3cf672e2b74375ab"; 

    // אסימון ה-CSRF הזמני ששלפת מאובייקט ה-root
    const csrfToken = "1787806979:b4tbq9uukgc:f6e100e63ed002c1cb906663c99c1ac5";

    // נקודת הקצה הרשמית והמתוקנת של ה-API
    const flickrUrl = "https://flickr.com";

    // יצירת גוף הבקשה (Form Data) - חובה ב-POST עבור ה-API הפנימי
    const formData = new URLSearchParams();
    formData.append("method", "flickr.photos.search");
    formData.append("api_key", apiKey);
    formData.append("user_id", targetUser);
    formData.append("safe_search", "3");      // רמת סינון S3 (Restricted)
    formData.append("per_page", "5");         // בדיוק 5 תמונות
    formData.append("format", "json");
    formData.append("nojsoncallback", "1");
    formData.append("csrf", csrfToken);        // הזרקת אסימון ה-CSRF הפנימי

    try {
      const response = await fetch(flickrUrl, {
        method: "POST", // שינוי ל-POST כדי שה-CSRF והסינון יעבדו
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
          // שים לב: פליקר עדיין עלולה לדרוש את מחרוזת ה-Cookie המלאה מהדפדפן שלך 
          // כדי לאמת שאתה אכן המשתמש שמחזיק ב-CSRF הזה. אם זה נכשל, תצטרך להוסיף אותה כאן:
          // "Cookie": "מחרוזת העוגיות המלאה שלך מהדפדפן"
        },
        body: formData.toString()
      });

      // בדיקה שהשרת אכן החזיר JSON
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const errorText = await response.text();
        return new Response(
          JSON.stringify({
            error: "Flickr API did not return JSON format.",
            server_response: errorText.substring(0, 300),
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
