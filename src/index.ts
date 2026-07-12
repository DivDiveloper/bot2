// =============================================================================
// WORKER 2 — SEARCH PROXY (Tavily integrator)
// -----------------------------------------------------------------------------
// Stateless. Only reachable via the SEARCH service binding from Worker 3.
// Takes a { query } POST, calls Tavily, strips boilerplate/HTML down to a
// compact plain-text block, and returns { summary }.
// =============================================================================

export interface Env {
  TAVILY_API_KEY: string;
}

const TAVILY_URL = "https://api.tavily.com/search";
const SEARCH_DEPTH = "basic";
const MAX_RESULTS = 5;
const MAX_SUMMARY_CHARS = 4000;

function stripBoilerplate(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ") // strip any stray HTML tags
    .replace(/\s+/g, " ")
    .trim();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Worker 2 (search proxy) is running.", { status: 200 });
    }

    try {
      const { query } = (await request.json()) as { query?: string };
      if (!query || typeof query !== "string") {
        return new Response(JSON.stringify({ error: "missing_query" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!env.TAVILY_API_KEY) {
        return new Response(JSON.stringify({ error: "tavily_key_missing" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      const tavilyRes = await fetch(TAVILY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: env.TAVILY_API_KEY,
          query,
          search_depth: SEARCH_DEPTH,
          max_results: MAX_RESULTS,
          include_answer: true,
        }),
      });

      if (!tavilyRes.ok) {
        const errBody = await tavilyRes.text();
        console.error(`[worker2] Tavily HTTP ${tavilyRes.status}: ${errBody.slice(0, 300)}`);
        return new Response(JSON.stringify({ error: "tavily_upstream_error", status: tavilyRes.status }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }

      const data: any = await tavilyRes.json();
      const parts: string[] = [];

      if (data.answer) parts.push(`Summary: ${stripBoilerplate(data.answer)}`);

      for (const r of data.results || []) {
        const title = stripBoilerplate(r.title || "");
        const content = stripBoilerplate(r.content || "");
        if (title || content) parts.push(`• ${title}: ${content}`);
      }

      let summary = parts.join("\n").trim();
      if (summary.length > MAX_SUMMARY_CHARS) summary = summary.slice(0, MAX_SUMMARY_CHARS);

      return new Response(JSON.stringify({ summary }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("[worker2] fatal error:", err);
      return new Response(JSON.stringify({ error: "search_proxy_failure" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
