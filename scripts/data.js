/* ============================================================
   JSS — Data layer
   Fetches market quotes / history and news, with a robust demo
   fallback so every page renders even with no network or keys.
   Also provides lightweight canvas charting (no dependencies).
   ============================================================ */
(function (global) {
  "use strict";
  const CFG = global.JSS_CONFIG || {};

  /* ---------- small helpers ---------- */
  const fmtMoney = (n, d = 2) =>
    n == null || isNaN(n) ? "—" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtPct = (n, d = 2) => (n == null || isNaN(n) ? "—" : (n >= 0 ? "+" : "") + Number(n).toFixed(d) + "%");
  const fmtNum = (n, d = 2) => (n == null || isNaN(n) ? "—" : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));

  /* ---------- deterministic pseudo-random (for stable demo data) ---------- */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- demo OHLC series generator (geometric random walk) ---------- */
  function demoSeries(symbol, days = 90, startPrice = 450) {
    const seed = [...symbol].reduce((a, c) => a + c.charCodeAt(0), 0) * 7;
    const rnd = mulberry32(seed);
    const drift = 0.0004, vol = 0.011;
    const out = [];
    let price = startPrice * (0.85 + rnd() * 0.3);
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      if (d.getDay() === 0 || d.getDay() === 6) continue; // skip weekends
      const shock = (rnd() - 0.5) * 2;
      const ret = drift + vol * shock;
      const open = price;
      const close = open * (1 + ret);
      const high = Math.max(open, close) * (1 + rnd() * 0.006);
      const low = Math.min(open, close) * (1 - rnd() * 0.006);
      out.push({
        date: d.toISOString().slice(0, 10),
        open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +close.toFixed(2),
        volume: Math.round(4e7 + rnd() * 6e7),
      });
      price = close;
    }
    return out;
  }

  const DEMO_BASE = { SPY: 545, QQQ: 470, DIA: 400 };

  /* ---------- parse Stooq daily CSV ---------- */
  function parseStooqCsv(text) {
    const lines = text.trim().split("\n");
    if (lines.length < 2 || !/Date/i.test(lines[0])) return null;
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const [date, o, h, l, c, v] = lines[i].split(",");
      if (!date || isNaN(+c)) continue;
      rows.push({ date, open: +o, high: +h, low: +l, close: +c, volume: +v });
    }
    return rows.length ? rows : null;
  }

  /* ---------- fetch with timeout ---------- */
  async function fetchText(url, ms = 9000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.text();
    } finally { clearTimeout(t); }
  }

  /* ---------- public: get daily history for a ticker ---------- */
  async function getHistory(ticker, days = 90) {
    const meta = (CFG.tickers || []).find((t) => t.symbol === ticker.symbol || t === ticker) || ticker;
    const symbol = meta.symbol || ticker;
    const provider = (CFG.data && CFG.data.provider) || "demo";

    try {
      if (provider === "stooq" && meta.stooq) {
        const base = `https://stooq.com/q/d/l/?s=${meta.stooq}&i=d`;
        const proxy = (CFG.data && CFG.data.corsProxy) || "";
        const url = proxy ? proxy + encodeURIComponent(base) : base;
        const csv = await fetchText(url);
        const rows = parseStooqCsv(csv);
        if (rows) return { symbol, source: "Stooq (live)", rows: rows.slice(-days) };
      }
      if (provider === "twelvedata" && CFG.data.twelveDataKey) {
        const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=${days}&apikey=${CFG.data.twelveDataKey}`;
        const json = JSON.parse(await fetchText(url));
        if (json && json.values) {
          const rows = json.values.map((v) => ({
            date: v.datetime, open: +v.open, high: +v.high, low: +v.low, close: +v.close, volume: +v.volume,
          })).reverse();
          return { symbol, source: "Twelve Data (live)", rows: rows.slice(-days) };
        }
      }
    } catch (e) {
      console.warn(`[JSS] live data for ${symbol} failed, using demo:`, e.message);
    }
    return { symbol, source: "Demo data", rows: demoSeries(symbol, days, DEMO_BASE[symbol] || 450) };
  }

  /* ---------- derive a quote + stats from a history series ---------- */
  function summarize(hist, lookback = 60) {
    const rows = hist.rows;
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2] || last;
    const window = rows.slice(-lookback);
    const highs = window.map((r) => r.high);
    const lows = window.map((r) => r.low);
    const changeAbs = last.close - prev.close;
    const changePct = (changeAbs / prev.close) * 100;
    return {
      symbol: hist.symbol, source: hist.source, date: last.date,
      open: last.open, high: last.high, low: last.low, close: last.close, volume: last.volume,
      prevClose: prev.close, changeAbs, changePct,
      hi60: Math.max(...highs), lo60: Math.min(...lows),
      rows,
    };
  }

  async function getQuote(ticker, lookback = 60) {
    const hist = await getHistory(ticker, Math.max(lookback + 5, 70));
    return summarize(hist, lookback);
  }

  /* ---------- news ---------- */
  async function getNews(feed) {
    const proxy = (CFG.news && CFG.news.rss2json) || "";
    try {
      if (proxy) {
        const json = JSON.parse(await fetchText(proxy + encodeURIComponent(feed.url), 9000));
        if (json && json.items && json.items.length) {
          return json.items.map((it) => ({
            title: it.title, link: it.link, date: it.pubDate,
            desc: (it.description || "").replace(/<[^>]+>/g, "").slice(0, 180),
            source: feed.label,
          }));
        }
      }
    } catch (e) {
      console.warn("[JSS] news fetch failed, using sample:", e.message);
    }
    return demoNews(feed.label);
  }

  function demoNews(source) {
    const now = Date.now();
    const samples = [
      ["Stocks edge higher as investors weigh rate path", "Major indexes ticked up as traders parsed the latest commentary from Fed officials ahead of next week's data."],
      ["Tech megacaps lead Nasdaq rebound", "Semiconductor and AI-linked names powered the Nasdaq-100 higher, with QQQ recovering recent losses."],
      ["Dow holds gains as industrials steady", "Blue-chip names kept the Dow in positive territory even as breadth stayed mixed across sectors."],
      ["Treasury yields slip, supporting equities", "A pullback in the 10-year yield gave equities room to run, with the S&P 500 testing resistance."],
      ["Volatility cools into options expiry", "The VIX drifted lower as positioning normalized heading into a busy week of earnings."],
      ["ETF inflows accelerate as retail returns", "Broad-market ETFs including SPY and QQQ saw renewed inflows, signaling improving risk appetite."],
    ];
    return samples.map((s, i) => ({
      title: s[0], link: "#", date: new Date(now - i * 5400000).toISOString(),
      desc: s[1], source: source + " · sample",
    }));
  }

  /* ============================================================
     Lightweight canvas charting
     ============================================================ */
  function hidpi(canvas) {
    const ratio = global.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || canvas.clientWidth || 600;
    const h = canvas.height || 320;
    canvas.width = w * ratio; canvas.height = h * ratio;
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    return { ctx, w, h };
  }

  function lineChart(canvas, opts) {
    const { ctx, w, h } = hidpi(canvas);
    const pad = { t: 16, r: 14, b: 26, l: 48 };
    const series = opts.series; // [{values:[], color, fill}]
    const labels = opts.labels || [];
    const all = series.flatMap((s) => s.values);
    let min = Math.min(...all), max = Math.max(...all);
    const span = max - min || 1; min -= span * 0.08; max += span * 0.08;
    const x = (i, n) => pad.l + (i / (n - 1)) * (w - pad.l - pad.r);
    const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);

    ctx.clearRect(0, 0, w, h);
    // grid + y labels
    ctx.font = "11px JetBrains Mono, monospace";
    ctx.textBaseline = "middle";
    for (let g = 0; g <= 4; g++) {
      const gy = pad.t + (g / 4) * (h - pad.t - pad.b);
      const val = max - (g / 4) * (max - min);
      ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(w - pad.r, gy); ctx.stroke();
      ctx.fillStyle = "rgba(147,160,189,0.75)"; ctx.textAlign = "right";
      ctx.fillText(opts.yFmt ? opts.yFmt(val) : val.toFixed(0), pad.l - 8, gy);
    }
    // x labels (first / mid / last)
    ctx.textAlign = "center"; ctx.fillStyle = "rgba(147,160,189,0.75)";
    [0, Math.floor(labels.length / 2), labels.length - 1].forEach((i) => {
      if (labels[i]) ctx.fillText(labels[i], x(i, labels.length), h - 10);
    });
    // series
    series.forEach((s) => {
      const n = s.values.length;
      if (s.fill) {
        const grad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
        grad.addColorStop(0, s.fill); grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath(); ctx.moveTo(x(0, n), y(s.values[0]));
        s.values.forEach((v, i) => ctx.lineTo(x(i, n), y(v)));
        ctx.lineTo(x(n - 1, n), h - pad.b); ctx.lineTo(x(0, n), h - pad.b); ctx.closePath();
        ctx.fillStyle = grad; ctx.fill();
      }
      ctx.beginPath(); ctx.lineWidth = s.width || 2; ctx.strokeStyle = s.color;
      ctx.lineJoin = "round";
      s.values.forEach((v, i) => (i ? ctx.lineTo(x(i, n), y(v)) : ctx.moveTo(x(i, n), y(v))));
      ctx.stroke();
    });
  }

  function sparkline(canvas, values, color) {
    const { ctx, w, h } = hidpi(canvas);
    const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
    const x = (i) => (i / (values.length - 1)) * w;
    const y = (v) => h - 2 - ((v - min) / span) * (h - 4);
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + "55"); grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath(); ctx.moveTo(0, h); values.forEach((v, i) => ctx.lineTo(x(i), y(v)));
    ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath(); ctx.lineWidth = 1.8; ctx.strokeStyle = color; ctx.lineJoin = "round";
    values.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)))); ctx.stroke();
  }

  function donut(canvas, segments) {
    const { ctx, w, h } = hidpi(canvas);
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 8, inner = r * 0.62;
    const total = segments.reduce((a, s) => a + s.value, 0);
    let start = -Math.PI / 2;
    ctx.clearRect(0, 0, w, h);
    segments.forEach((s) => {
      const ang = (s.value / total) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + ang); ctx.closePath();
      ctx.fillStyle = s.color; ctx.fill();
      start += ang;
    });
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath(); ctx.arc(cx, cy, inner, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  global.JSS = {
    fmtMoney, fmtPct, fmtNum, demoSeries, getHistory, getQuote, summarize, getNews,
    chart: { lineChart, sparkline, donut },
  };
})(window);
