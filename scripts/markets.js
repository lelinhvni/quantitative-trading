/* ============================================================
   JSS — Markets page: SPY / QQQ / DIA detail
   ============================================================ */
(function () {
  "use strict";
  const CFG = window.JSS_CONFIG;
  const F = window.JSS;
  let range = 60;
  let quotes = [];

  document.addEventListener("DOMContentLoaded", () => {
    bindControls();
    load();
    const ms = (CFG.data && CFG.data.refreshMs) || 60000;
    setInterval(load, ms);
  });

  function bindControls() {
    document.querySelectorAll(".chip[data-range]").forEach((c) =>
      c.addEventListener("click", () => {
        document.querySelectorAll(".chip[data-range]").forEach((x) => x.classList.remove("is-active"));
        c.classList.add("is-active");
        range = parseInt(c.dataset.range, 10);
        render();
      })
    );
    const r = document.getElementById("refreshBtn");
    if (r) r.addEventListener("click", load);
  }

  async function load() {
    try {
      quotes = await Promise.all((CFG.tickers || []).map((t) => F.getQuote(t, 90)));
      const src = quotes[0] && quotes[0].source;
      const sourceEl = document.getElementById("dataSource");
      if (sourceEl) sourceEl.textContent = src ? `Source: ${src}.` : "";
      const upd = document.getElementById("updated");
      if (upd) upd.textContent = "Updated " + new Date().toLocaleTimeString();
      render();
    } catch (e) {
      const el = document.getElementById("marketCards");
      if (el) el.innerHTML = `<div class="snap__loading">Market data unavailable right now.</div>`;
    }
  }

  function render() {
    const el = document.getElementById("marketCards");
    if (!el || !quotes.length) return;
    el.innerHTML = quotes.map((q) => card(q)).join("");
    quotes.forEach((q) => {
      const c = document.getElementById("chart-" + q.symbol);
      if (!c) return;
      const rows = q.rows.slice(-range);
      F.chart.lineChart(c, {
        labels: rows.map((r) => r.date.slice(5)),
        series: [{ values: rows.map((r) => r.close), color: q.changePct >= 0 ? "#34d399" : "#f87171", fill: (q.changePct >= 0 ? "#34d399" : "#f87171") + "33", width: 2 }],
        yFmt: (v) => v.toFixed(0),
      });
    });
  }

  function card(q) {
    const up = q.changePct >= 0;
    const meta = (CFG.tickers || []).find((t) => t.symbol === q.symbol) || {};
    const rows = q.rows.slice(-range);
    const hi = Math.max(...rows.map((r) => r.high));
    const lo = Math.min(...rows.map((r) => r.low));
    const pos = ((q.close - lo) / ((hi - lo) || 1)) * 100;
    return `
    <article class="market reveal">
      <header class="market__head">
        <div>
          <div class="market__sym">${q.symbol} <span class="market__name">${meta.name || ""}</span></div>
          <div class="market__date">As of ${q.date}</div>
        </div>
        <div class="market__pricewrap">
          <div class="market__price">${F.fmtMoney(q.close)}</div>
          <div class="market__chg ${up ? "is-up" : "is-down"}">${up ? "▲" : "▼"} ${F.fmtNum(Math.abs(q.changeAbs))} (${F.fmtPct(q.changePct)})</div>
        </div>
      </header>

      <div class="market__grid">
        <div class="kv"><span>Open</span><b>${F.fmtNum(q.open)}</b></div>
        <div class="kv"><span>Close</span><b>${F.fmtNum(q.close)}</b></div>
        <div class="kv"><span>Day high</span><b>${F.fmtNum(q.high)}</b></div>
        <div class="kv"><span>Day low</span><b>${F.fmtNum(q.low)}</b></div>
        <div class="kv"><span>Prev close</span><b>${F.fmtNum(q.prevClose)}</b></div>
        <div class="kv"><span>Volume</span><b>${(q.volume / 1e6).toFixed(1)}M</b></div>
      </div>

      <div class="market__range">
        <div class="market__rangelabels">
          <span>${range}d low <b>${F.fmtNum(lo)}</b></span>
          <span>${range}d high <b>${F.fmtNum(hi)}</b></span>
        </div>
        <div class="rangebar"><div class="rangebar__fill" style="left:${pos}%"></div></div>
      </div>

      <canvas class="market__chart" id="chart-${q.symbol}" height="220"></canvas>
    </article>`;
  }
})();
