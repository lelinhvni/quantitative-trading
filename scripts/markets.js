/* ============================================================
   BPSQuant — Markets page: Google Finance-style ETF row + S&P 500
   ============================================================ */
(function () {
  "use strict";
  const CFG = window.JSS_CONFIG;
  const F = window.JSS;
  let range = "30";           // "7" | "30" | "ytd"
  let etfQuotes = [];
  let activeSymbol = null;
  let detailDate = null;      // selected day inside the detail popup

  const SP500_TOP20 = [
    { symbol: "AAPL",  name: "Apple" },
    { symbol: "MSFT",  name: "Microsoft" },
    { symbol: "NVDA",  name: "NVIDIA" },
    { symbol: "AMZN",  name: "Amazon" },
    { symbol: "GOOGL", name: "Alphabet" },
    { symbol: "META",  name: "Meta" },
    { symbol: "TSLA",  name: "Tesla" },
    { symbol: "AVGO",  name: "Broadcom" },
    { symbol: "LLY",   name: "Eli Lilly" },
    { symbol: "JPM",   name: "JPMorgan" },
    { symbol: "UNH",   name: "UnitedHealth" },
    { symbol: "V",     name: "Visa" },
    { symbol: "XOM",   name: "ExxonMobil" },
    { symbol: "MA",    name: "Mastercard" },
    { symbol: "COST",  name: "Costco" },
    { symbol: "HD",    name: "Home Depot" },
    { symbol: "PG",    name: "P&G" },
    { symbol: "NFLX",  name: "Netflix" },
    { symbol: "WMT",   name: "Walmart" },
    { symbol: "JNJ",   name: "J&J" },
  ];

  document.addEventListener("DOMContentLoaded", () => {
    bindControls();
    load();
    loadSP500();
    const ms = (CFG.data && CFG.data.refreshMs) || 60000;
    setInterval(() => { load(); loadSP500(); }, ms);
  });

  /* Rows for the selected range: 7d / 30d slices, or calendar YTD */
  function rowsForRange(q) {
    if (range === "ytd") {
      const yearStart = new Date().getFullYear() + "-01-01";
      const ytd = q.rows.filter((r) => r.date >= yearStart);
      return ytd.length ? ytd : q.rows;
    }
    const n = parseInt(range, 10);
    return q.rows.slice(-Math.min(n, q.rows.length));
  }
  function rangeLabel() { return range === "ytd" ? "YTD" : range + "d"; }

  function bindControls() {
    document.querySelectorAll(".chip[data-range]").forEach((c) =>
      c.addEventListener("click", () => {
        document.querySelectorAll(".chip[data-range]").forEach((x) => x.classList.remove("is-active"));
        c.classList.add("is-active");
        range = c.dataset.range;
        renderEtfRow();
        if (activeSymbol) showDetail(activeSymbol, detailDate);
      })
    );
    const r = document.getElementById("refreshBtn");
    if (r) r.addEventListener("click", () => { load(); loadSP500(); });
  }

  async function load() {
    try {
      etfQuotes = await Promise.all((CFG.tickers || []).map((t) => F.getQuote(t, 260)));
      const src = etfQuotes[0] && etfQuotes[0].source;
      const sourceEl = document.getElementById("dataSource");
      if (sourceEl) sourceEl.textContent = src ? `Source: ${src}.` : "";
      const upd = document.getElementById("updated");
      if (upd) upd.textContent = "Updated " + new Date().toLocaleTimeString();
      renderEtfRow();
      if (activeSymbol) showDetail(activeSymbol, detailDate);
    } catch (e) {
      const el = document.getElementById("etfRow");
      if (el) el.innerHTML = `<div class="snap__loading">Market data unavailable right now.</div>`;
    }
  }

  /* ============================================================
     ETF horizontal row
     ============================================================ */
  function renderEtfRow() {
    const el = document.getElementById("etfRow");
    if (!el || !etfQuotes.length) return;
    el.innerHTML = etfQuotes.map((q) => {
      const up = q.changePct >= 0;
      const meta = (CFG.tickers || []).find((t) => t.symbol === q.symbol) || {};
      const isActive = q.symbol === activeSymbol;
      return `
      <button class="etf-tile${up ? " is-up" : " is-down"}${isActive ? " is-selected" : ""}"
              data-symbol="${q.symbol}" aria-expanded="${isActive}" type="button">
        <div class="etf-tile__sym">${q.symbol}</div>
        <div class="etf-tile__name">${meta.name || ""}</div>
        <div class="etf-tile__price">${F.fmtMoney(q.close)}</div>
        <div class="etf-tile__chg">${up ? "▲" : "▼"} ${F.fmtPct(q.changePct)}</div>
        <canvas class="etf-tile__spark" id="etfspark-${q.symbol}" height="36" aria-hidden="true"></canvas>
      </button>`;
    }).join("");

    etfQuotes.forEach((q) => {
      const c = document.getElementById("etfspark-" + q.symbol);
      if (c && q.rows.length) {
        F.chart.sparkline(c, rowsForRange(q).map((r) => r.close),
          q.changePct >= 0 ? "#34d399" : "#f87171");
      }
    });

    el.querySelectorAll(".etf-tile").forEach((btn) =>
      btn.addEventListener("click", () => {
        const sym = btn.dataset.symbol;
        detailDate = null;
        if (activeSymbol === sym) {
          activeSymbol = null;
          hideDetail();
        } else {
          activeSymbol = sym;
          showDetail(sym);
        }
        renderEtfRow();
      })
    );
  }

  function showDetail(symbol, selDate) {
    const q = etfQuotes.find((x) => x.symbol === symbol);
    const detail = document.getElementById("etfDetail");
    if (!q || !detail) return;
    const meta = (CFG.tickers || []).find((t) => t.symbol === q.symbol) || {};
    const rows = rowsForRange(q);
    const hi = Math.max(...rows.map((r) => r.high || r.close));
    const lo = Math.min(...rows.map((r) => r.low || r.close));
    const lbl = rangeLabel();

    // Last 7 trading sessions — pickable days inside the popup
    const last7 = q.rows.slice(-7);
    const latestDate = q.rows[q.rows.length - 1].date;
    if (!selDate || !last7.some((r) => r.date === selDate)) selDate = latestDate;
    detailDate = selDate;

    // Stats for the selected day (change measured vs the previous session)
    const idx = q.rows.findIndex((r) => r.date === selDate);
    const sel = q.rows[idx];
    const prev = q.rows[idx - 1] || sel;
    const chgAbs = sel.close - prev.close;
    const chgPct = (chgAbs / (prev.close || 1)) * 100;
    const up = chgAbs >= 0;
    const isLatest = selDate === latestDate;
    const pos = ((sel.close - lo) / ((hi - lo) || 1)) * 100;

    const dayName = (ds) => new Date(ds + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });

    detail.hidden = false;
    detail.innerHTML = `
    <div class="etf-detail__inner reveal is-visible">
      <div class="etf-detail__top">
        <div>
          <h2 class="etf-detail__sym">${q.symbol} <span class="etf-detail__name">${meta.name || ""}</span></h2>
          <div class="etf-detail__date">${isLatest ? "As of " + sel.date : "Viewing " + dayName(sel.date) + " " + sel.date}</div>
        </div>
        <div class="etf-detail__pricewrap">
          <div class="etf-detail__price">${F.fmtMoney(sel.close)}</div>
          <div class="etf-detail__chg ${up ? "is-up" : "is-down"}">${up ? "▲" : "▼"} ${F.fmtNum(Math.abs(chgAbs))} (${F.fmtPct(chgPct)})</div>
        </div>
        <button class="etf-detail__close" id="closeDetail" aria-label="Close detail">✕</button>
      </div>

      <div class="day-picker">
        <div class="day-picker__label">Last 7 sessions — tap a day to view its data</div>
        <div class="day-picker__row">
          ${last7.map((r, i) => {
            const p = i > 0 ? last7[i - 1] : (q.rows[q.rows.length - 8] || r);
            const dPct = ((r.close - p.close) / (p.close || 1)) * 100;
            const dUp = dPct >= 0;
            return `
            <button class="day-chip ${r.date === selDate ? "is-active" : ""}" data-date="${r.date}" type="button">
              <span class="day-chip__wd">${dayName(r.date)}</span>
              <span class="day-chip__d">${r.date.slice(5)}</span>
              <span class="day-chip__c mono">${F.fmtNum(r.close)}</span>
              <span class="day-chip__p ${dUp ? "is-up" : "is-down"}">${dUp ? "▲" : "▼"}${Math.abs(dPct).toFixed(2)}%</span>
            </button>`;
          }).join("")}
        </div>
      </div>

      <div class="etf-detail__kv">
        <div class="kv"><span>Open</span><b>${F.fmtNum(sel.open)}</b></div>
        <div class="kv"><span>Close</span><b>${F.fmtNum(sel.close)}</b></div>
        <div class="kv"><span>Day high</span><b>${F.fmtNum(sel.high)}</b></div>
        <div class="kv"><span>Day low</span><b>${F.fmtNum(sel.low)}</b></div>
        <div class="kv"><span>Prev close</span><b>${F.fmtNum(prev.close)}</b></div>
        <div class="kv"><span>Volume</span><b>${(sel.volume / 1e6).toFixed(1)}M</b></div>
        <div class="kv"><span>${lbl} high</span><b>${F.fmtNum(hi)}</b></div>
        <div class="kv"><span>${lbl} low</span><b>${F.fmtNum(lo)}</b></div>
      </div>
      <div class="market__range">
        <div class="market__rangelabels">
          <span>${lbl} low <b>${F.fmtNum(lo)}</b></span>
          <span>${lbl} high <b>${F.fmtNum(hi)}</b></span>
        </div>
        <div class="rangebar"><div class="rangebar__fill" style="left:${pos.toFixed(1)}%"></div></div>
      </div>
      <canvas class="etf-detail__chart" id="etfDetailChart" height="260" aria-label="${q.symbol} price history"></canvas>
    </div>`;

    const chartCanvas = document.getElementById("etfDetailChart");
    if (chartCanvas && rows.length) {
      const rUp = rows[rows.length - 1].close >= rows[0].close;
      F.chart.lineChart(chartCanvas, {
        labels: rows.map((r) => r.date.slice(5)),
        series: [{ values: rows.map((r) => r.close), color: rUp ? "#34d399" : "#f87171", fill: (rUp ? "#34d399" : "#f87171") + "33", width: 2 }],
        yFmt: (v) => v.toFixed(0),
      });
    }

    detail.querySelectorAll(".day-chip").forEach((chip) =>
      chip.addEventListener("click", () => showDetail(symbol, chip.dataset.date))
    );

    document.getElementById("closeDetail").addEventListener("click", () => {
      activeSymbol = null;
      detailDate = null;
      hideDetail();
      renderEtfRow();
    });

    if (!selDateWasClick(selDate, latestDate))
      setTimeout(() => detail.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  }

  /* Only auto-scroll when the popup first opens (latest day selected) */
  function selDateWasClick(selDate, latestDate) { return selDate !== latestDate; }

  function hideDetail() {
    const detail = document.getElementById("etfDetail");
    if (detail) { detail.hidden = true; detail.innerHTML = ""; }
  }

  /* ============================================================
     S&P 500 Top 20
     ============================================================ */
  async function loadSP500() {
    const grid = document.getElementById("sp500Grid");
    if (!grid) return;
    // Load in batches of 5 to avoid hammering the proxy
    const results = [];
    for (let i = 0; i < SP500_TOP20.length; i += 5) {
      const batch = SP500_TOP20.slice(i, i + 5);
      const batchResults = await Promise.allSettled(batch.map((s) => F.getQuote(s.symbol, 7)));
      results.push(...batchResults.map((r, j) =>
        r.status === "fulfilled"
          ? { ...batch[j], ...r.value }
          : { ...batch[j], close: null, changePct: 0, changeAbs: 0, rows: [] }
      ));
      // Render each batch as it arrives
      renderSP500Tiles(grid, results);
    }
  }

  function renderSP500Tiles(grid, quotes) {
    grid.innerHTML = quotes.map((q) => sp500Tile(q)).join("");
    quotes.forEach((q) => {
      if (q.rows && q.rows.length) {
        const c = document.getElementById("s5spark-" + q.symbol);
        if (c) F.chart.sparkline(c, q.rows.slice(-7).map((r) => r.close), (q.changePct || 0) >= 0 ? "#34d399" : "#f87171");
      }
    });
  }

  function sp500Tile(q) {
    const up = (q.changePct || 0) >= 0;
    if (q.close == null) {
      return `<div class="sp500-tile sp500-tile--err">
        <div class="sp500-tile__sym">${q.symbol}</div>
        <div class="sp500-tile__name">${q.name}</div>
        <div class="sp500-tile__price">—</div>
        <div class="sp500-tile__chg" style="color:var(--faint)">Loading…</div>
      </div>`;
    }
    return `
    <div class="sp500-tile${up ? " is-up" : " is-down"}">
      <div class="sp500-tile__top">
        <span class="sp500-tile__sym">${q.symbol}</span>
        <canvas class="sp500-tile__spark" id="s5spark-${q.symbol}" height="32" aria-hidden="true"></canvas>
      </div>
      <div class="sp500-tile__name">${q.name}</div>
      <div class="sp500-tile__price">${F.fmtMoney(q.close)}</div>
      <div class="sp500-tile__chg">${up ? "▲" : "▼"} ${F.fmtPct(q.changePct)}</div>
    </div>`;
  }
})();
