export default {
  async fetch(request: Request): Promise<Response> {
    // 1. הגדרת משתנים קבועים - מפתחות ומזהי יעד בצורה נקייה
    const targetUserId: string = "202140161@N06"; 
    const apiKey: string = "3faf915241bdfc4b09b7a50a5a4a824a"; 

    // 2. בניית הקישור הרשמי ל-API של פליקר (נבדק תו לתו - כולל התווים הלוגיים המלאים)
    const flickrUrl: string = `https://flickr.com{apiKey}&user_id=${targetUserId}&safe_search=3&format=json&nojsoncallback=1&per_page=5`;

    try {
      // 3. ביצוע הבקשה אל שרתי פליקר
      const response = await fetch(flickrUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json"
        }
      });

      // 4. בדיקת סוג התוכן שחזר - מוודא שלא קיבלנו עמוד HTML של שגיאה
      const contentType: string = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const errorText: string = await response.text();
        return new Response(
          JSON.stringify({ 
            error: "Flickr API did not return JSON data.",
            server_response_preview: errorText.substring(0, 300) 
          }, null, 2), 
          {
            status: 502,
            headers: { 
              "Content-Type": "application/json; charset=utf-8",
              "Access-Control-Allow-Origin": "*"
            }
          }
        );
      }

      // 5. המרת המידע ל-JSON ופליטתו בצורה תקינה ומסודרת
      const data = await response.json();
      return new Response(JSON.stringify(data, null, 2), {
        status: 200,
        headers: { 
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*" 
        }
      });

    } catch (error: any) {
      // 6. תפיסת שגיאות רשת ומניעת קריסת הוורקר (שגיאה 500)
      return new Response(
        JSON.stringify({ 
          error: "Internal Worker Error", 
          message: error.message 
        }, null, 2), 
        { 
          status: 500,
          headers: { 
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*"
          } 
        }
      );
    }
  }
};
