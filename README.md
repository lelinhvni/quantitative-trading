# BPSQuant — Fund Web App

The web app for **BPSQuant**, a systematic quantitative fund trading liquid ETFs
(SPY, QQQ, DIA). It introduces the fund to prospective investors, publishes
performance, streams a live trade feed, shows live market data, surfaces market
news, and gives investors a portal to track their capital.

> **Status:** v2 — fully working with a **real backend powered by Supabase**
> (PostgreSQL + Auth + Realtime). The app runs as a static site (GitHub Pages)
> but stores investor accounts, NAV history, trades, and positions in a real
> database, with proper authentication and Row Level Security.
>
> The app also works **without Supabase** configured — every page falls back to
> demo data automatically so you can show it to investors before setup is done.

## Pages

| Page | File | What it does |
|------|------|--------------|
| Home / fund intro | `index.html` | Marketing page: pitch, metrics, strategy, live market snapshot, contact form |
| Performance | `performance.html` | Equity curve vs benchmark, monthly returns, allocation, risk metrics |
| Markets | `markets.html` | SPY / QQQ / DIA: daily **open & close**, **last 60-day high/low**, price chart |
| News | `news.html` | Free CNBC + Yahoo Finance headlines; tap any story to open the full article on the source site |
| Investor portal | `portal.html` | Login → investor sees capital/returns, **trade log & open positions**; manager sees AUM, investors, NAV, CSV trade upload, leads |

> **Trades are private.** The trade log and open positions live **inside the investor
> portal**, visible only to registered (logged-in) investors and the manager.
> `trades.html` now simply redirects to the portal.

## Run it locally

It's plain HTML/CSS/JS — no build step. Serve the folder over HTTP (needed so
the browser can fetch data and load the modular scripts):

```bash
# any static server works
python3 -m http.server 8000
# then open http://localhost:8000
```

Demo portal logins (front-end only):

- **Investor:** `investor@bpsquant.example` / `investor`
- **Manager:** `manager@bpsquant.example` — password is set privately in `scripts/config.js`

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

## Quick start — adding the real backend

See **[`supabase/README.md`](supabase/README.md)** for the full step-by-step guide.
The short version:

1. Create a free [Supabase](https://supabase.com) project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Enable Realtime on the `trades` table.
4. Create your manager account → set `role = 'manager'` in the `profiles` table.
5. Paste your Supabase URL + anon key into `scripts/config.js`.
6. Push — done.

Once configured, investors log in with their email/password (created via Supabase Auth),
and you as fund manager use the portal to enter NAV values, log trades, and manage accounts.

## Architecture

```
index.html, markets.html, news.html,        ← pages (semantic HTML)
performance.html, trades.html, portal.html
styles/main.css                             ← design system + all components
scripts/
  config.js        ← brand, tickers, metrics, Supabase credentials
  data.js          ← market data layer (Stooq/Twelve Data/demo) + canvas charts
  db.js            ← Supabase data layer (auth, trades, NAV, investors, leads)
  site.js          ← shared header/footer, nav, scroll reveal, counters
  home.js          ← homepage logic (market snapshot, contact form → Supabase)
  markets.js       ← markets page (SPY/QQQ/DIA: open/close/60d range/chart)
  news.js          ← news page (CNBC RSS feed via rss2json)
  performance.js   ← performance page (real NAV from DB or demo curve)
  trades.js        ← trade feed (real Supabase Realtime or demo generator)
  portal.js        ← investor portal (real Supabase auth or demo login)
assets/            ← favicon + social share image
supabase/
  schema.sql       ← PostgreSQL schema + RLS policies (run this first)
  seed.sql         ← test data (optional)
  README.md        ← step-by-step setup guide
```

Charts are drawn with the Canvas API — **no external chart libraries**, so the
site stays fast and dependency-free.

## Roadmap to v3+

The Supabase backend covers the core needs. Future enhancements:

1. **Automated NAV update** — connect to your broker API and push the NAV automatically at end of day (Supabase Edge Functions).
2. **Trade import** — parse broker execution reports and insert them via a serverless function.
3. **Email statements** — monthly PDF statements to investors via Edge Functions + Resend.
4. **Two-factor auth** — enable in Supabase Auth settings (one checkbox).
5. **Compliance** — investor reporting, disclosures, and KYC/AML as required for your jurisdiction. The disclaimers in the footer are a starting point, not legal advice.

## Deploy

Push to GitHub and enable **GitHub Pages** (Settings → Pages → deploy from
branch). The site is fully static, so it works as-is. For a custom domain, add a
`CNAME` file. For guaranteed live data without a public CORS proxy, deploy the
small proxy described above and point `config.js` at it.
