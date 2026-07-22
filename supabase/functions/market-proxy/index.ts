// ============================================================
// BPSQuant — market data proxy (Supabase Edge Function)
//
// Yahoo Finance and Stooq block direct browser requests (CORS).
// This function fetches on the server side and returns the data
// with CORS headers, so the website never depends on flaky free
// public proxies.
//
// Security: only the allow-listed market-data hosts can be
// fetched — this cannot be abused as a general-purpose proxy.
//
// Deploy (Supabase dashboard, ~3 minutes):
//   1. Edge Functions → Deploy a new function
//   2. Name it exactly:  market-proxy
//   3. Paste this entire file, click Deploy
//   4. Open the function → Details → turn OFF "Enforce JWT
//      verification" (it must accept requests from the website
//      without a login — it's read-only public market data)
//
// The website already tries this proxy first:
//   https://<project-ref>.supabase.co/functions/v1/market-proxy?url=<encoded>
// ============================================================

const ALLOWED_HOSTS = [
  "query1.finance.yahoo.com",
  "query2.finance.yahoo.com",
  "stooq.com",
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const raw = new URL(req.url).searchParams.get("url");
  if (!raw) {
    return new Response("missing ?url=", { status: 400, headers: CORS });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("invalid url", { status: 400, headers: CORS });
  }

  if (!ALLOWED_HOSTS.includes(target.hostname)) {
    return new Response("host not allowed", { status: 403, headers: CORS });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "*/*",
      },
    });
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...CORS,
        "Content-Type": upstream.headers.get("Content-Type") || "text/plain",
        // one-minute edge cache keeps repeat loads fast and gentle on Yahoo
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (e) {
    return new Response("upstream fetch failed: " + (e as Error).message, {
      status: 502,
      headers: CORS,
    });
  }
});
