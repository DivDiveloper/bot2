// =============================================================================
// WORKER 2 — SEARCH PROXY (Tavily integrator)
// -----------------------------------------------------------------------------
// Stateless. Only reachable via the SEARCH service binding from Worker 3.
// Takes a { query } POST, calls Tavily, strips boilerplate/HTML down to a
// compact plain-text block, and returns { summary }.
// =============================================================================

// =============================================================================
// WORKER 2 — SEARCH PROXY (Tavily integrator)
// -----------------------------------------------------------------------------
// Stateless. Only reachable via the SEARCH service binding.
// - POST /search { query }  -> { summary }        (called from Worker 3)
// - GET  /balance            -> { remainingCredits, plan }  (called from Worker 1's /balance command)
// =============================================================================

export interface Env {
  TAVILY_API_KEY: string;
  // OPTIONAL. Only relevant if this worker is ever given a public route in
  // addition to its service binding — service bindings themselves are NOT
  // reachable from the public internet, only from workers you've explicitly
  // bound them into, so this is not required for the architecture as
  // shipped. Leave unset to skip the check entirely.
  TAVILY_PROXY_AUTH_KEY?: string;
}

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const TAVILY_USAGE_URL = "https://api.tavily.com/usage";
const SEARCH_DEPTH = "basic";
const MAX_RESULTS = 5;
const MAX_SUMMARY_CHARS = 4000;

function stripBoilerplate(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ") // strip any stray HTML tags
    .replace(/\s+/g, " ")
    .trim();
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function handleSearch(request: Request, env: Env): Promise<Response> {
  try {
    const { query } = (await request.json()) as { query?: string };
    if (!query || typeof query !== "string") return jsonResponse({ error: "missing_query" }, 400);
    if (!env.TAVILY_API_KEY) return jsonResponse({ error: "tavily_key_missing" }, 500);

    const tavilyRes = await fetch(TAVILY_SEARCH_URL, {
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
      console.error(`[worker2] Tavily search HTTP ${tavilyRes.status}: ${errBody.slice(0, 300)}`);
      return jsonResponse({ error: "tavily_upstream_error", status: tavilyRes.status }, 502);
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
    return jsonResponse({ summary });
  } catch (err) {
    console.error("[worker2] search fatal error:", err);
    return jsonResponse({ error: "search_proxy_failure" }, 500);
  }
}

// NOTE: Tavily's account-usage endpoint/response shape has changed across
// API versions in the past — verify this against Tavily's current API
// reference (https://docs.tavily.com) if this starts returning `unknown`.
// This handler is defensive: it checks several plausible field names rather
// than assuming one exact shape.
async function handleBalance(env: Env): Promise<Response> {
  try {
    if (!env.TAVILY_API_KEY) return jsonResponse({ error: "tavily_key_missing" }, 500);

    const res = await fetch(TAVILY_USAGE_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${env.TAVILY_API_KEY}` },
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[worker2] Tavily usage HTTP ${res.status}: ${errBody.slice(0, 300)}`);
      return jsonResponse({ error: `tavily_usage_http_${res.status}` }, 502);
    }

    const data: any = await res.json();
    const remainingCredits =
      data?.remaining_credit ?? data?.remaining_credits ?? data?.account?.remaining_credit ?? data?.credits_remaining ?? null;
    const plan = data?.plan ?? data?.account?.plan ?? null;

    return jsonResponse({ remainingCredits, plan, raw: remainingCredits == null ? data : undefined });
  } catch (err) {
    console.error("[worker2] balance fatal error:", err);
    return jsonResponse({ error: "balance_proxy_failure" }, 500);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    // Defense-in-depth only — see the Env.TAVILY_PROXY_AUTH_KEY comment above.
    if (env.TAVILY_PROXY_AUTH_KEY) {
      const provided = request.headers.get("x-api-key");
      if (provided !== env.TAVILY_PROXY_AUTH_KEY) return jsonResponse({ error: "unauthorized" }, 401);
    }

    if (request.method === "POST" && pathname === "/search") return handleSearch(request, env);
    if (request.method === "GET" && pathname === "/balance") return handleBalance(env);

    // Back-compat: a bare POST with no recognized path is treated as /search
    // (matches the original single-path behavior).
    if (request.method === "POST") return handleSearch(request, env);

    return new Response("Worker 2 (search proxy) is running.", { status: 200 });
  },
};
