export default {
  async fetch(request: Request): Promise<Response> {
    const targetUser = "59871731@N06"; 
    const photosetId = "72177720328320682"; 
    
    const primaryApiKey = "47a02e6ef4e2c50d3cf672e2b74375ab"; 
    const backupApiKey = "3faf915241bdfc4b09b7a50a5a4a824a";  
    const csrfToken = "1787806979:b4tbq9uukgc:f6e100e63ed002c1cb906663c99c1ac5";
    const userCookie = "usprivacy=1---;_sp_id.df80=b1eef646-f0fe-4e1c-9d51-aad67800ec63.1787765774.5.1787787014.1787781931.ff6ea7ff-14e7-44fa-85d4-db7b06e819b1.a8ec5b22-bfce-45d6-919c-97e92905ee0e.61800c19-cd62-4c3e-bdb3-f1cdcafa5a15.1787784728880.241;cookie_epass=0b6f4b7fbbb54960b72a35ed171dd680;liqpw=1036;localization=en-us%3Bil%3Bil;flrbgrp=1787781929-9b6083cb69adc9777408c13fbfc0b72f6e498d9a;TAsessionID=602d9dc7-e54a-48b8-8745-92c897986a65|EXISTING;cmapi_gtm_bl=ga-ms-ua-ta-asp-bzi-sp-awct-cts-csm-img-flc-fls-mpm-mpr-m6d-tc-tdc;xb=788649;notice_preferences=0:;flrbpap=1787781929-c9f8a1d5f6fd19082435f5cfd70c2db7fe7d8f09;flrbfd=1787781929-799c4d21768876a8f581f037ad9791e8c679518f;cookie_session=204870642%3A0b6f4b7fbbb54960b72a35ed171dd680;_sp_ses.df80=*;session_id=9c82d317-3589-4add-94ac-8d7fe6e56338;flrbp=1787781929-6364e891d70f3c80da00d5cb503e96aed7a40589;flrbgmrp=1787781929-76eacd1037aeae64a07222f35f31400708f6d7fe;sa=1792954934%3A204891972%40N07%3A870d205775b04ead9bd969b56187511f;adCounter=38;ccc=%7B%22needsConsent%22%3Afalse%2C%22managed%22%3A0%2C%22changed%22%3A0%2C%22info%22%3A%7B%22cookieBlock%22%3A%7B%22level%22%3A0%2C%22blockRan%22%3A0%7D%7D%2C%22freshServerContext%22%3Atrue%7D;cmapi_cookie_privacy=permit 1 required;cookie_accid=204870642;dcbn=1;flrb=44;flrbgdrp=1787781929-3eb56283e9516b82e3b6747f374ef20ee2f27993;flrbrp=1787781929-1295cd1a589d891bc29a345f98664c08e5120b9e;flrbrst=1787781929-ab0d9fbf5f3632fe0114bdbae3becfaf9fa1608c;flrtags=1787781929-24674f28926efdf7e1df1dc111b0819b504b8ea2;fmvt=2.20691.158.p153;liqph=1806;notice_behavior=implied,us;notice_gdpr_prefs=0:;vp=252%2C451%2C4.285714285714286%2C0%2Ctag-photos-everyone-view%3A252%2Cfluid-centered%3A252%2Csearch-photos-everyone-view%3A252%2Cgroup-pool-preview-view%3A236%2Csearch-photos-albums-new-view%3A252%2Csearch-photos-yours-view%3A252%2Csearch-photos-contacts-view%3A252%2Cgalleries-list-page-view%3A236%2Cphotolist-container%3A252";

    // ✅ הכתובת שונתה ל-AJAX REST Endpoint הפנימי של פליקר
    const buildFlickrUrl = (key: string) => {
      return "https://flickr.com" +
             "?method=flickr.photosets.getPhotos" +
             "&api_key=" + key +
             "&user_id=" + targetUser +
             "&photoset_id=" + photosetId +
             "&privacy_filter=1" + 
             "&per_page=10" + 
             "&extras=safety_level" + 
             "&format=json" +
             "&nojsoncallback=1" +
             "&csrf=" + encodeURIComponent(csrfToken);
    };

    const commonHeaders = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Referer": `https://flickr.com{targetUser}/albums/${photosetId}`,
      "Cookie": userCookie
    };

    try {
      const url = buildFlickrUrl(primaryApiKey);
      const response = await fetch(url, { method: "GET", headers: commonHeaders });
      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error("Primary internal API failed. Trying backup.");
      }

      const data = await response.json();
      return new Response(JSON.stringify({ source: "internal_primary", data }, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });

    } catch (primaryError: any) {
      try {
        const fallbackUrl = buildFlickrUrl(backupApiKey);
        const fallbackResponse = await fetch(fallbackUrl, { method: "GET", headers: commonHeaders });
        const fallbackContentType = fallbackResponse.headers.get("content-type") || "";

        if (!fallbackContentType.includes("application/json")) {
          const errorText = await fallbackResponse.text();
          return new Response(
            JSON.stringify({ 
              error: "Both internal pathways blocked.", 
              server_response: errorText.substring(0, 300)
            }),
            { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
          );
        }

        const data = await fallbackResponse.json();
        return new Response(JSON.stringify({ source: "internal_backup", data }, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });

      } catch (backupError: any) {
        return new Response(
          JSON.stringify({ error: "Fatal Internal Route Exception", primary: primaryError.message, backup: backupError.message }),
          { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }
    }
  }
};
