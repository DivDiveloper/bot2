export default {
  async fetch(request: Request): Promise<Response> {
    // 👤 מזהה הצלם
    const targetUser = "59871731@N06"; 
    
    // 📂 מזהה האלבום הספציפי שסיפקת
    const photosetId = "72177720328320682"; 
    
    // 🔐 מפתחות הגישה (ראשי וגיבוי)
    const primaryApiKey = "47a02e6ef4e2c50d3cf672e2b74375ab"; 
    const backupApiKey = "3faf915241bdfc4b09b7a50a5a4a824a";  

    // 🎟️ אסימון ה-CSRF הזמני של החשבון המחובר
    const csrfToken = "1787806979:b4tbq9uukgc:f6e100e63ed002c1cb906663c99c1ac5";

    // פונקציית עזר לבניית ה-URL עבור שליפת התמונות מהאלבום
    const buildFlickrUrl = (key: string) => {
      return "https://flickr.com" +
             "?method=flickr.photosets.getPhotos" +
             "&api_key=" + key +
             "&user_id=" + targetUser +
             "&photoset_id=" + photosetId +
             "&per_page=10" +                         // שינוי ל-10 תמונות בדיוק
             "&extras=safety_level" +                // הצגת רמת ה-Safety ב-JSON (כדי לבדוק S1/S3)
             "&format=json" +
             "&nojsoncallback=1" +
             "&csrf=" + encodeURIComponent(csrfToken);
    };

    const commonHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json"
      // הערה: אם התמונות באלבום מוגדרות כ-S3/Restricted, פליקר עשוי לחסום או לסנן אותן ללא ה-Cookie מהדפדפן:
      // "Cookie": "מחרוזת העוגיות המלאה שלך מהדפדפן"
    };

    // --- ניסיון 1: שימוש במפתח הראשי ---
    try {
      const url = buildFlickrUrl(primaryApiKey);
      const response = await fetch(url, { method: "GET", headers: commonHeaders });

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Primary API key failed. Trying fallback.");
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
        const fallbackResponse = await fetch(fallbackUrl, { method: "GET", headers: commonHeaders });

        const fallbackContentType = fallbackResponse.headers.get("content-type") || "";
        if (!fallbackContentType.includes("application/json")) {
          const errorText = await fallbackResponse.text();
          return new Response(
            JSON.stringify({ error: "Both keys failed.", server_response: errorText.substring(0, 300) }),
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
          JSON.stringify({ error: "Fatal Exception", primary: primaryError.message, backup: backupError.message }),
          { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }
    }
  }
};
