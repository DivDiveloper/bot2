export default {
  async fetch(request: Request): Promise<Response> {
    // 👤 מזהה הצלם
    const targetUser = "59871731@N06"; 
    
    // 🔐 מפתחות הגישה (החדש והישן כגיבוי)
    const primaryApiKey = "47a02e6ef4e2c50d3cf672e2b74375ab"; 
    const backupApiKey = "3faf915241bdfc4b09b7a50a5a4a824a";  

    // ✅ בניית הכתובת בצורה הבטוחה ביותר דרך אובייקט URL מובנה כדי למנוע מ-Cloudflare למחוק נתיבים
    const buildCleanUrl = (key: string) => {
      const url = new URL("https://flickr.com");
      url.searchParams.set("method", "flickr.photos.search");
      url.searchParams.set("api_key", key);
      url.searchParams.set("user_id", targetUser);
      url.searchParams.set("safe_search", "3");      // דרישת S3 לרמת הסינון
      url.searchParams.set("per_page", "10");        // 10 תמונות
      url.searchParams.set("extras", "safety_level");
      url.searchParams.set("format", "json");
      url.searchParams.set("nojsoncallback", "1");
      return url.toString();
    };

    // 🔑 נקי לחלוטין: בלי ה-Cookies שגרמו לשרת לחשוד ולנתב אותנו לעמוד הבית
    const commonHeaders = {
      "User-Agent": "FlickrWorkerApp/1.0", 
      "Accept": "application/json"
    };

    // --- ניסיון 1: מפתח ראשי ---
    try {
      const url = buildCleanUrl(primaryApiKey);
      const response = await fetch(url, { method: "GET", headers: commonHeaders });
      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error("Primary API route returned HTML. Trying backup.");
      }

      const data = await response.json();
      return new Response(JSON.stringify({ source: "clean_api_primary_success", data }, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });

    } catch (primaryError: any) {
      // --- ניסיון 2: מפתח גיבוי ---
      try {
        const fallbackUrl = buildCleanUrl(backupApiKey);
        const fallbackResponse = await fetch(fallbackUrl, { method: "GET", headers: commonHeaders });
        const fallbackContentType = fallbackResponse.headers.get("content-type") || "";

        if (!fallbackContentType.includes("application/json")) {
          const errorText = await fallbackResponse.text();
          return new Response(
            JSON.stringify({ 
              error: "Flickr REST API completely rejected the Worker.", 
              server_response: errorText.substring(0, 150),
              final_called_url: fallbackUrl
            }),
            { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
          );
        }

        const data = await fallbackResponse.json();
        return new Response(JSON.stringify({ source: "clean_api_backup_success", data }, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });

      } catch (backupError: any) {
        return new Response(
          JSON.stringify({ error: "Fatal API Exception", primary: primaryError.message, backup: backupError.message }),
          { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }
    }
  }
};
