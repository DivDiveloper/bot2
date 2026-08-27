import puppeteer from "@cloudflare/puppeteer";


interface Env {
  MYBROWSER: any;
  STORE: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const targetUser = "59871731@N06"; 
    
    // 1. משיכת הקוקיז מתוך מאגר ה-STORE
    let userCookieString = await env.STORE.get("cookies");
    
    // אם ה-KV ריק, נשתמש בקוקיז החדשים שסיפקת ונשמור אותם אוטומטית ל-KV
    if (!userCookieString) {
      userCookieString = "usprivacy=1---;_sp_id.df80=b1eef646-f0fe-4e1c-9d51-aad67800ec63.1787765774.7.1787812944.1787804160.2a12dc34-9a90-437a-b8de-c6b4d3e10352.5781c636-41dc-49e2-bd6a-d8a1a8fe1687.dd2fb427-192a-4877-90ea-1c7850d1d9f9.1787812936489.9;cookie_epass=0b6f4b7fbbb54960b72a35ed171dd680;liqpw=1036;localization=en-us%3Bil%3Bil;flrbgrp=1787804039-a1913f88b8867bc8a9b6350a944cac4936b56de2;TAsessionID=a587394e-6374-400a-8d78-46d49eb4edfe|EXISTING;cmapi_gtm_bl=ga-ms-ua-ta-asp-bzi-sp-awct-cts-csm-img-flc-fls-mpm-mpr-m6d-tc-tdc;xb=788649;notice_preferences=0:;flrbpap=1787804039-e48f5211590dad0a9dc72c6a0348acc026dc8263;flrbfd=1787804039-815e0b58783ef33ea7c75992992e235de75cc1c4;cookie_session=204870642%3A0b6f4b7fbbb54960b72a35ed171dd680;_sp_ses.df80=*;session_id=9c82d317-3589-4add-94ac-8d7fe6e56338;flrbp=1787804039-5eca4dc0cdc4e5318cbc635ef18c427f5e60251d;flrbgmrp=1787804039-69688ec733f6d8cd53637da37e2fa93db9961e4c;sa=1792954934%3A204891972%40N07%3A870d205775b04ead9bd969b56187511f;adCounter=38;ccc=%7B%22needsConsent%22%3Afalse%2C%22managed%22%3A0%2C%22changed%22%3A0%2C%22info%22%3A%7B%22cookieBlock%22%3A%7B%22level%22%3A0%2C%22blockRan%22%3A0%7D%7D%2C%22freshServerContext%22%3Atrue%7D;cmapi_cookie_privacy=permit 1 required;cookie_accid=204870642;dcbn=1;flrb=23;flrbgdrp=1787804039-1fcc50638f4b70bc5f647e1b069935ac06d06de3;flrbrp=1787804039-3159d073b70ce2ae130be19c104a88723c56f553;flrbrst=1787804039-9a500cfc572ec76ba193944ebaa017c51efb746b;flrtags=1787804039-c71a7531c4c675d8c47097ad8d4e5a5ce2a3d93e;fmvt=2.20692.8.p7;liqph=1806;notice_behavior=implied,us;notice_gdpr_prefs=0:;vp=252%2C451%2C4.285714285714286%2C0%2Ctag-photos-everyone-view%3A252%2Cfluid-centered%3A252%2Csearch-photos-everyone-view%3A252%2Cgroup-pool-preview-view%3A236%2Csearch-photos-albums-new-view%3A252%2Csearch-photos-yours-view%3A252%2Csearch-photos-contacts-view%3A252%2Cgalleries-list-page-view%3A236%2Cphotolist-container%3A252";
      await env.STORE.put("cookies", userCookieString);
    }

    const browser = await puppeteer.launch(env.MYBROWSER);
    const page = await browser.newPage();

    try {
      // 2. פירוק מחרוזת ה-Cookie והזרקתה לדפדפן המובנה
      const cookies = userCookieString.split(";").map(pair => {
        const [name, ...valueParts] = pair.trim().split("=");
        return {
          name: name,
          value: valueParts.join("="),
          domain: ".flickr.com",
          path: "/"
        };
      });
      await page.setCookie(...cookies);

      // 3. ניווט לפרופיל הצלם והמתנה לטעינה מלאה
      const targetUrl = `https://flickr.com{targetUser}/`;
      await page.goto(targetUrl, { waitUntil: "networkidle2" });

      // 4. חילוץ ה-SRC של התמונה הראשונה
      const imageUrl = await page.evaluate(() => {
        const imgElement = document.querySelector(".photo-list-photo-view img, .photo_container img, img.interaction-view");
        return imgElement ? imgElement.getAttribute("src") : null;
      });

      if (!imageUrl) {
        throw new Error("Could not find any images on the user profile layout.");
      }

      // 5. משיכת הקובץ הבינארי של התמונה
      const fullImageUrl = imageUrl.startsWith("http") ? imageUrl : `https:${imageUrl}`;
      const imageResponse = await fetch(fullImageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();

      await browser.close();

      // 6. הצגת התמונה חזרה ישירות בדפדפן
      return new Response(imageBuffer, {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=3600",
          "Access-Control-Allow-Origin": "*"
        }
      });

    } catch (error: any) {
      await browser.close();
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
