/* ============================================================
   JSS — Site configuration & fund profile
   Edit this file to change content without touching markup.
   ============================================================ */
window.JSS_CONFIG = {
  /* ----- Supabase connection -------------------------------------------
     Paste your project's URL and anon key here.
     These are safe to commit — Row Level Security on every table is the
     real security boundary. Never put the service_role key here.

     Where to find them:
       Supabase dashboard → Settings → API
         "Project URL"          → supabase.url
         "anon (public)" key    → supabase.anonKey

     Leave as-is to use demo mode (no real auth, no DB required).
  --------------------------------------------------------------------- */
  supabase: {
    url:     "YOUR_SUPABASE_PROJECT_URL",   // e.g. "https://xxxx.supabase.co"
    anonKey: "YOUR_SUPABASE_ANON_KEY",      // eyJhbGci...
  },

  brand: {
    name: "JSS",
    full: "JSS Capital",
    tagline: "Systematic ETF trading, driven by quantitative theory.",
    email: "invest@jsscapital.example",
  },

  /* ----- Market data providers -----------------------------------------
     Sources are tried in order until one succeeds; demo is the final
     fallback so the site always renders.

     "yahoo"     — Yahoo Finance v8 API (free, no key). Requires a CORS
                   proxy since Yahoo blocks direct browser requests.
     "stooq"     — Stooq daily CSV (free, no key). Also needs corsProxy.
     "twelvedata"— Set twelveDataKey for guaranteed live quotes (free tier).
     "demo"      — Force simulated data (useful for offline testing).

     Set corsProxy to your own proxy for production. The public corsproxy.io
     works fine for demos and small traffic.
  --------------------------------------------------------------------- */
  data: {
    providers: ["yahoo", "stooq"],          // tried left-to-right until one works
    corsProxy: "https://corsproxy.io/?url=",
    twelveDataKey: "",                       // optional: twelvedata.com free key
    refreshMs: 60000,
  },

  /* ----- Tickers tracked on the markets page --------------------------- */
  tickers: [
    { symbol: "SPY", name: "S&P 500 ETF",    stooq: "spy.us" },
    { symbol: "QQQ", name: "Nasdaq-100 ETF", stooq: "qqq.us" },
    { symbol: "DIA", name: "Dow Jones ETF",  stooq: "dia.us" },
  ],

  /* ----- News sources --------------------------------------------------
     All are free RSS feeds, routed through rss2json (free, no key).
     CNBC and Yahoo Finance cover market/ETF news without paid subscriptions.
  --------------------------------------------------------------------- */
  news: {
    rss2json: "https://api.rss2json.com/v1/api.json?count=12&rss_url=",
    feeds: [
      { label: "CNBC — Top News",     url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
      { label: "CNBC — Markets",      url: "https://www.cnbc.com/id/20910258/device/rss/rss.html" },
      { label: "Yahoo Finance",       url: "https://finance.yahoo.com/rss/topstories" },
      { label: "Yahoo — ETFs",        url: "https://finance.yahoo.com/rss/headline?s=SPY,QQQ,DIA" },
    ],
  },

  /* ----- Headline fund metrics (illustrative until wired to live data) -- */
  metrics: [
    { value: 2.1,  decimals: 1, suffix: "",  label: "Net Sharpe (since inception)" },
    { value: 64.0, decimals: 1, suffix: "%", label: "Win rate" },
    { value: 4.8,  decimals: 1, suffix: "%", prefix: "-", label: "Max drawdown" },
    { value: 18.6, decimals: 1, suffix: "%", prefix: "+", label: "Annualized return (sim.)" },
  ],

  /* ----- Strategy pillars --------------------------------------------- */
  strategies: [
    { icon: "📊", title: "Trend & Momentum", desc: "Volatility-targeted exposure to SPY/QQQ/DIA when momentum signals align across horizons." },
    { icon: "🔁", title: "Mean Reversion",  desc: "Short-horizon reversal entries on stretched ETF moves, gated by liquidity and event risk." },
    { icon: "🛡️", title: "Risk Overlay",    desc: "Systematic de-risking and hedging that caps drawdowns when regimes turn hostile." },
    { icon: "🧠", title: "Quant Research",  desc: "Every signal is walk-forward validated and cost-aware before a dollar is risked." },
  ],

  /* ----- Demo investor accounts (front-end only) ----------------------
     v1 uses local demo auth so you can show the portal. Replace with a
     real backend before handling actual investor data. See README.       */
  demoUsers: [
    { email: "manager@jss.example",  password: "jss",      role: "manager", name: "Kevin (Fund Manager)" },
    { email: "investor@jss.example", password: "investor", role: "investor", name: "Sample Investor",
      invested: 25000, since: "2025-09-01" },
  ],
};
