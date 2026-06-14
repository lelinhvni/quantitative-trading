# JSS Capital — Fund Web App

The web app for **JSS**, a systematic quantitative fund trading liquid ETFs
(SPY, QQQ, DIA). It introduces the fund to prospective investors, publishes
performance, streams a live trade feed, shows live market data, surfaces market
news, and gives investors a portal to track their capital.

> **Status:** v1 — a fast, fully working **front-end**. It runs as a static
> site (great for GitHub Pages) with a clean, pluggable data layer. Live market
> data and news are fetched in the browser; the investor portal uses demo auth.
> See **[Roadmap to production](#roadmap-to-production)** for what to add before
> handling real investor accounts and money.

## Pages

| Page | File | What it does |
|------|------|--------------|
| Home / fund intro | `index.html` | Marketing page: pitch, metrics, strategy, live market snapshot, contact form |
| Performance | `performance.html` | Equity curve vs benchmark, monthly returns, allocation, risk metrics |
| Trades | `trades.html` | Live trade feed, open positions, daily activity — filterable |
| Markets | `markets.html` | SPY / QQQ / DIA: daily **open & close**, **last 60-day high/low**, price chart |
| News | `news.html` | Market headlines from CNBC feeds (and other finance sources) |
| Investor portal | `portal.html` | Login → investor sees capital/returns/statements; manager sees AUM, investors, leads |

## Run it locally

It's plain HTML/CSS/JS — no build step. Serve the folder over HTTP (needed so
the browser can fetch data and load the modular scripts):

```bash
# any static server works
python3 -m http.server 8000
# then open http://localhost:8000
```

Demo portal logins (front-end only):

- **Investor:** `investor@jss.example` / `investor`
- **Manager:** `manager@jss.example` / `jss`

## Configuration

Everything you'd normally edit lives in **`scripts/config.js`** — brand name,
contact email, tracked tickers, headline metrics, strategy copy, data provider,
and news feeds. No need to touch the markup.

### Live market data (SPY / QQQ / DIA)

> **Important:** Google Finance has **no public/official API** (the old one was
> discontinued). So we don't fetch from Google Finance directly. Instead the
> data layer (`scripts/data.js`) is provider-agnostic with a demo fallback so
> pages always render. Configure your source in `config.js`:

- `provider: "stooq"` *(default)* — free, no API key. ETF history (open, high,
  low, close, volume) for daily open/close and 60-day high/low. Browser fetches
  are routed through a CORS proxy (`data.corsProxy`); for production, host your
  own proxy.
- `provider: "twelvedata"` — set `data.twelveDataKey` with a free key from
  [twelvedata.com](https://twelvedata.com). CORS-friendly, reliable quotes.
- `provider: "demo"` — deterministic simulated data, no network. Useful offline
  or for screenshots.

If a live fetch fails (offline, CORS, rate limit), the page automatically falls
back to demo data and labels the source accordingly.

### Market news

News is pulled from **CNBC RSS** feeds (Top News, Markets, Investing) converted
to JSON via a public RSS→JSON service (`news.rss2json` in `config.js`). Swap in
your own proxy or add/remove feeds there. If fetching fails, sample headlines
are shown so the page is never empty.

## Architecture

```
index.html, markets.html, news.html,        ← pages (semantic HTML)
performance.html, trades.html, portal.html
styles/main.css                             ← design system + components
scripts/
  config.js        ← all editable content & data settings
  data.js          ← data layer (quotes, history, news) + canvas charts
  site.js          ← shared header/footer, nav, scroll reveal, counters
  home.js / markets.js / news.js / performance.js / trades.js / portal.js
assets/            ← favicon + social share image
```

Charts are drawn with the Canvas API — **no external chart libraries**, so the
site stays fast and dependency-free.

## Roadmap to production

The current portal and trade/performance data are demo-grade. Before onboarding
real investors and real money you'll want a backend:

1. **Authentication & accounts** — replace the front-end demo login with a real
   identity provider (e.g. Auth0/Clerk/Supabase Auth). Never store credentials
   or real balances in client-side code.
2. **Database** — persist investors, contributions/withdrawals, NAV history, and
   trades (e.g. Postgres/Supabase).
3. **Real trade & performance feed** — connect your broker/execution system or a
   trades API so `trades.html` and `performance.html` show your true record.
4. **Server-side market data & news proxy** — host your own proxy to avoid
   third-party CORS proxies and to add caching/keys securely.
5. **Compliance** — investor reporting, disclosures, and KYC/AML as required for
   a fund in your jurisdiction. The disclaimers in the footer are a starting
   point, not legal advice.

## Deploy

Push to GitHub and enable **GitHub Pages** (Settings → Pages → deploy from
branch). The site is fully static, so it works as-is. For a custom domain, add a
`CNAME` file. For guaranteed live data without a public CORS proxy, deploy the
small proxy described above and point `config.js` at it.
