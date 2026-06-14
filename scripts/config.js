/* ============================================================
   JSS — Site configuration & fund profile
   Edit this file to change content without touching markup.
   ============================================================ */
window.JSS_CONFIG = {
  brand: {
    name: "JSS",
    full: "JSS Capital",
    tagline: "Systematic ETF trading, driven by quantitative theory.",
    email: "invest@jsscapital.example",
  },

  /* ----- Market data providers -----------------------------------------
     The app works with zero configuration using a demo fallback.
     For LIVE data, choose a provider:
       - "stooq":      free, no key. Routed through a CORS proxy (see corsProxy).
       - "twelvedata": free key from https://twelvedata.com (CORS-friendly).
       - "demo":       force simulated data (no network).
  --------------------------------------------------------------------- */
  data: {
    provider: "stooq",
    // Public CORS proxy used for browser fetches that lack CORS headers.
    // For production, host your own proxy and put its URL here.
    corsProxy: "https://corsproxy.io/?url=",
    twelveDataKey: "", // paste your Twelve Data API key here for live quotes
    refreshMs: 60000,  // auto-refresh interval for live pages
  },

  /* ----- Tickers tracked on the markets page --------------------------- */
  tickers: [
    { symbol: "SPY", name: "S&P 500 ETF",         stooq: "spy.us" },
    { symbol: "QQQ", name: "Nasdaq-100 ETF",      stooq: "qqq.us" },
    { symbol: "DIA", name: "Dow Jones ETF",       stooq: "dia.us" },
  ],

  /* ----- News sources -------------------------------------------------- */
  news: {
    rss2json: "https://api.rss2json.com/v1/api.json?count=12&rss_url=",
    feeds: [
      { label: "CNBC — Top News",   url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
      { label: "CNBC — Markets",    url: "https://www.cnbc.com/id/20910258/device/rss/rss.html" },
      { label: "CNBC — Investing",  url: "https://www.cnbc.com/id/15839069/device/rss/rss.html" },
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
