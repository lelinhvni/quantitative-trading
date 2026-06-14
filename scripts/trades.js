/* ============================================================
   JSS — Live trade feed (demo generator; swap for real feed/API)
   ============================================================ */
(function () {
  "use strict";
  const F = window.JSS;
  const SYMS = ["SPY", "QQQ", "DIA"];
  const STRATS = ["Trend", "Mean-Rev", "Momentum", "Risk overlay", "Breakout"];
  const PRICES = { SPY: 545, QQQ: 470, DIA: 400 };
  let trades = [];
  let filter = "all";

  document.addEventListener("DOMContentLoaded", () => {
    seed();
    bindFilters();
    render();
    renderPositions();
    renderDay();
    // simulate a live feed
    setInterval(() => { addTrade(); render(); renderDay(); pulse(); }, 6500);
  });

  function rnd(n) { return Math.random() * n; }
  function pick(a) { return a[Math.floor(rnd(a.length))]; }

  function makeTrade(minutesAgo) {
    const sym = pick(SYMS);
    const side = rnd(1) > 0.5 ? "BUY" : "SELL";
    const px = PRICES[sym] * (1 + (rnd(1) - 0.5) * 0.01);
    return {
      t: new Date(Date.now() - minutesAgo * 60000),
      sym, side,
      qty: Math.round(50 + rnd(400)),
      px,
      strat: pick(STRATS),
      status: "Filled",
    };
  }

  function seed() {
    trades = [];
    for (let i = 18; i >= 0; i--) trades.push(makeTrade(i * 17 + rnd(10)));
  }
  function addTrade() {
    const t = makeTrade(0);
    t.status = "New";
    trades.push(t);
    setTimeout(() => { t.status = "Filled"; render(); }, 1500);
  }

  function bindFilters() {
    const bar = document.getElementById("tradeFilters");
    if (!bar) return;
    bar.querySelectorAll(".chip").forEach((c) =>
      c.addEventListener("click", () => {
        bar.querySelectorAll(".chip").forEach((x) => x.classList.remove("is-active"));
        c.classList.add("is-active");
        filter = c.dataset.f;
        render();
      })
    );
  }

  function visible() {
    return trades
      .slice()
      .reverse()
      .filter((t) => filter === "all" || t.sym === filter || t.side === filter);
  }

  function render() {
    const body = document.getElementById("tradeBody");
    const count = document.getElementById("tradeCount");
    if (!body) return;
    const list = visible();
    if (count) count.textContent = list.length + " shown";
    body.innerHTML = list.map((t) => `
      <tr class="${t.status === "New" ? "is-new" : ""}">
        <td class="mono">${t.t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
        <td><b>${t.sym}</b></td>
        <td><span class="pill ${t.side === "BUY" ? "pill--buy" : "pill--sell"}">${t.side}</span></td>
        <td class="mono">${t.qty}</td>
        <td class="mono">${F.fmtMoney(t.px)}</td>
        <td>${t.strat}</td>
        <td><span class="status ${t.status === "Filled" ? "status--ok" : "status--new"}">${t.status}</span></td>
      </tr>`).join("");
  }

  function renderPositions() {
    const el = document.getElementById("positions");
    if (!el) return;
    const pos = [
      { sym: "SPY", qty: 1200, avg: 538.4, pnl: 1.8 },
      { sym: "QQQ", qty: 800, avg: 462.1, pnl: 2.4 },
      { sym: "DIA", qty: 300, avg: 405.7, pnl: -0.6 },
    ];
    el.innerHTML = pos.map((p) => {
      const up = p.pnl >= 0;
      return `<li>
        <div><b>${p.sym}</b><span>${p.qty} @ ${F.fmtNum(p.avg)}</span></div>
        <span class="pos__pnl ${up ? "is-up" : "is-down"}">${F.fmtPct(p.pnl)}</span>
      </li>`;
    }).join("");
  }

  function renderDay() {
    const el = document.getElementById("dayStats");
    if (!el) return;
    const today = trades.filter((t) => t.t.toDateString() === new Date().toDateString());
    const buys = today.filter((t) => t.side === "BUY").length;
    const sells = today.length - buys;
    const vol = today.reduce((a, t) => a + t.qty * t.px, 0);
    el.innerHTML = `
      <div class="daystat"><span>Trades</span><b>${today.length}</b></div>
      <div class="daystat"><span>Buys / Sells</span><b>${buys} / ${sells}</b></div>
      <div class="daystat"><span>Notional</span><b>${F.fmtMoney(vol, 0)}</b></div>`;
  }

  function pulse() {
    const d = document.getElementById("liveDot");
    if (!d) return;
    d.classList.add("flash");
    setTimeout(() => d.classList.remove("flash"), 600);
  }
})();
