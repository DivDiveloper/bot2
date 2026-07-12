/**
 * Worker 2: Isolated Search Proxy (Tavily Integrator)
 * 
 * Securely handles internal search queries, dispatches REST API requests to 
 * Tavily, strips unnecessary document payloads, and exports a text-only summary.
 */

type KVNamespace = any;

export interface Env {
  KV: KVNamespace;
  AUTH_KEY: string;
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    // Health check bypass
    if (request.method === "GET") {
      return new Response(JSON.stringify({ service: "tavily-proxy", status: "active" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // Explicit internal authorization verification
    const authHeader = request.headers.get("x-api-key");
    if (!authHeader || authHeader !== env.AUTH_KEY) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const url = new URL(request.url);
      if (url.pathname !== "/tools/tavily-search") {
        return new Response("Not Found", { status: 404 });
      }

      const body: any = await request.json();
      const query = body.query;
      if (!query) {
        return new Response(JSON.stringify({ error: "Missing query parameter" }), { status: 400 });
      }

      // Read Tavily keys directly from the key-pool in the KV namespace
      const keysRaw = await env.KV.get("tavily_keys_pool");
      let keys: any[] = [];
      if (keysRaw) {
        try { keys = JSON.parse(keysRaw); } catch {}
      }

      // Pick the best key from the active pool (sort by credits descending)
      const activeKeys = keys.filter((k: any) => !k.invalidated && (k.remainingCredit === undefined || k.remainingCredit > 0));
      if (activeKeys.length === 0) {
        return new Response(JSON.stringify({
          content: [{ type: "text", text: "Error: No available Tavily API keys remain in proxy pool." }],
          isError: true
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      activeKeys.sort((a, b) => (b.remainingCredit || 0) - (a.remainingCredit || 0));
      const chosenKeyObj = activeKeys[0];
      const apiKey = chosenKeyObj.apiKey;

      // Dispatch search to Tavily Endpoint
      const tavilyResponse = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: query,
          search_depth: body.search_depth || "basic",
          max_results: body.max_results || 5
        })
      });

      if (!tavilyResponse.ok) {
        // If Tavily responds with authentication failure, invalidate the key in the pool
        if (tavilyResponse.status === 401 || tavilyResponse.status === 403) {
          chosenKeyObj.invalidated = true;
          await env.KV.put("tavily_keys_pool", JSON.stringify(keys));
        }
        throw new Error(`Tavily HTTP error: ${tavilyResponse.status}`);
      }

      const searchData: any = await tavilyResponse.json();
      const results: TavilyResult[] = searchData.results || [];

      // Format a clean, text-only context string (stripping out heavy payload structures)
      const compiledSummary = results.map((r) => `Title: ${r.title}\nURL: ${r.url}\nContext: ${r.content}`).join("\n\n");

      // Deduct credit counter internally for key monitoring
      if (chosenKeyObj.remainingCredit !== undefined) {
        const cost = body.search_depth === "advanced" ? 2 : 1;
        chosenKeyObj.remainingCredit = Math.max(0, chosenKeyObj.remainingCredit - cost);
        await env.KV.put("tavily_keys_pool", JSON.stringify(keys));
      }

      return new Response(JSON.stringify({
        content: [{ type: "text", text: compiledSummary }]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });

    } catch (err: any) {
      console.error("Search Proxy Exception:", err);
      return new Response(JSON.stringify({
        content: [{ type: "text", text: `Search proxy error: ${err.message}` }],
        isError: true
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  }
};
