export default {
  async fetch(request: Request): Promise<Response> {
    // 👤 מזהה הצלם הספציפי שאת תמונותיו (S3) אנחנו מחפשים
    const targetUser = "202140161@N06"; 
    
    // 🔐 מפתחות הגישה
    const primaryApiKey = "47a02e6ef4e2c50d3cf672e2b74375ab"; // המפתח החדש
    const backupApiKey = "3faf915241bdfc4b09b7a50a5a4a824a";  // המפתח הישן (גיבוי)

    // 🎟️ אסימון ה-CSRF הזמני
    const csrfToken = "1787806979:b4tbq9uukgc:f6e100e63ed002c1cb906663c99c1ac5";

    // פונקציית עזר לבניית ה-URL המלא עבור בקשת GET
    const buildFlickrUrl = (key: string) => {
      return "https://www.flickr.com/services/rest/" +
             "?method=flickr.photos.search" +
             "&api_key=" + key +
             "&user_id=" + targetUser +
             "&safe_search=3" +       // רמת סינון S3 (Restricted)
             "&per_page=5" +          // הגבלה ל-5 תמונות
             "&format=json" +
             "&nojsoncallback=1" +
             "&csrf=" + encodeURIComponent(csrfToken);
    };

    const commonHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json"
    };

    // --- ניסיון 1: שימוש במפתח הראשי ---
    try {
      const url = buildFlickrUrl(primaryApiKey);
      const response = await fetch(url, {
        method: "GET",
        headers: commonHeaders
      });

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Primary API key did not return JSON. Trying fallback.");
      }

      const data = await response.json();
      return new Response(JSON.stringify({ source: "primary_key", data }, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });

    } catch (primaryError: any) {
      // --- ניסיון 2: גיבוי אוטומטי עם המפתח הישן ---
      try {
        const fallbackUrl = buildFlickrUrl(backupApiKey);
        const fallbackResponse = await fetch(fallbackUrl, {
          method: "GET",
          headers: commonHeaders
        });

        const fallbackContentType = fallbackResponse.headers.get("content-type") || "";
        if (!fallbackContentType.includes("application/json")) {
          const errorText = await fallbackResponse.text();
          return new Response(
            JSON.stringify({
              error: "Both primary and backup API keys failed.",
              server_response: errorText.substring(0, 300)
            }),
            { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
          );
        }

        const data = await fallbackResponse.json();
        return new Response(JSON.stringify({ source: "backup_key", data }, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });

      } catch (backupError: any) {
        return new Response(
          JSON.stringify({
            error: "Worker Fetch Fatal Exception",
            primary_exception: primaryError.message,
            backup_exception: backupError.message
          }),
          { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }
    }
  }
};
