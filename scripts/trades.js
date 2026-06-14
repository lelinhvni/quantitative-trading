/* ============================================================
   JSS Capital — Live trade feed
   LIVE: Supabase configured → real trades + Realtime subscription
   DEMO: Supabase not configured → deterministic demo feed
   ============================================================ */
(function () {
  "use strict";
  const F = window.JSS;
  const DB = window.JSSDB;
  const CFG = window.JSS_CONFIG;

  let trades = [];
  let filter = "all";
  let realtimeChannel = null;
  let liveMode = false;

  document.addEventListener("DOMContentLoaded", async () => {
    liveMode = DB && DB.init();
    bindFilters();

    if (liveMode) {
      const session = await DB.getSession();
      if (!session) {
        showAuthRequired();
        return;
      }
      await loadLive();
    } else {
      seedDemo();
      render();
      renderPositionsDemo();
      renderDay();
      simulateDemoFeed();
    }
  });

  /* ============================================================
     LIVE MODE
     ============================================================ */
  async function loadLive() {
    document.getElementById("liveDot").textContent = "● Connecting…";
    try {
      const [tradesData, posData] = await Promise.all([
        DB.getTrades(150),
        DB.getPositions(),
      ]);
      trades = tradesData.map(normalise);
      render();
      renderPositionsLive(posData);
      renderDay();

      // Supabase Realtime: new trades push live
      realtimeChannel = DB.subscribeToTrades((raw) => {
        const t = normalise(raw);
        t._isNew = true;
        trades.unshift(t);
        render();
        renderDay();
        pulse();
        setTimeout(() => { t._isNew = false; }, 3000);
      });
      document.getElementById("liveDot").textContent = "● Live";
    } catch (err) {
      document.getElementById("liveDot").textContent = "● Error";
      console.error("[JSS] trade feed error:", err);
    }

    // Refresh positions every minute
    setInterval(async () => {
      const pos = await DB.getPositions().catch(() => null);
      if (pos) renderPositionsLive(pos);
    }, 60000);
  }

  function normalise(raw) {
    return {
      t: new Date(raw.executed_at || raw.created_at),
      sym: raw.symbol, side: raw.side,
      qty: +raw.qty, px: +raw.price,
      strat: raw.strategy || "—",
      status: raw.status || "filled",
      note: raw.note || "",
      _isNew: false,
    };
  }

  function renderPositionsLive(positions) {
    const el = document.getElementById("positions");
    if (!el || !positions.length) {
      if (el) el.innerHTML = `<li class="pos__empty">No open positions.</li>`;
      return;
    }
    el.innerHTML = positions.map((p) => `
      <li>
        <div><b>${p.symbol}</b><span>${F.fmtNum(p.qty, 0)} @ ${F.fmtNum(p.avg_cost, 2)}</span></div>
        <span class="pos__note">avg cost</span>
      </li>`).join("");
  }

  function showAuthRequired() {
    const body = document.querySelector(".trades__layout");
    if (body) body.innerHTML = `<div class="snap__loading">Please <a class="inline-link" href="portal.html">sign in</a> to view the live trade feed.</div>`;
    document.getElementById("liveDot").textContent = "";
  }

  /* ============================================================
     DEMO MODE
     ============================================================ */
  const SYMS = ["SPY", "QQQ", "DIA"];
  const STRATS = ["Trend", "Mean-Rev", "Momentum", "Risk overlay", "Breakout"];

  function rnd(n) { return Math.random() * n; }
  function pick(a) { return a[Math.floor(rnd(a.length))]; }

  function makeDemoTrade(minsAgo) {
    const sym = pick(SYMS);
    const PRICES = { SPY: 545, QQQ: 470, DIA: 400 };
    return {
      t: new Date(Date.now() - minsAgo * 60000),
      sym, side: rnd(1) > 0.5 ? "BUY" : "SELL",
      qty: Math.round(50 + rnd(400)), px: PRICES[sym] * (1 + (rnd(1) - 0.5) * 0.01),
      strat: pick(STRATS), status: "filled", note: "", _isNew: false,
    };
  }

  function seedDemo() {
    trades = [];
    for (let i = 18; i >= 0; i--) trades.push(makeDemoTrade(i * 17 + rnd(10)));
  }

  function simulateDemoFeed() {
    setInterval(() => {
      const t = makeDemoTrade(0); t.status = "pending"; t._isNew = true;
      trades.unshift(t);
      render(); renderDay(); pulse();
      setTimeout(() => { t.status = "filled"; t._isNew = false; render(); }, 1600);
    }, 6500);
  }

  function renderPositionsDemo() {
    const el = document.getElementById("positions");
    if (!el) return;
    el.innerHTML = [
      { sym: "SPY", qty: 400, avg: 545.8 },
      { sym: "QQQ", qty: 275, avg: 470.9 },
      { sym: "DIA", qty: 200, avg: 402.6 },
    ].map((p) => `
      <li>
        <div><b>${p.sym}</b><span>${p.qty} @ ${F.fmtNum(p.avg, 2)}</span></div>
        <span class="pos__note">avg cost (demo)</span>
      </li>`).join("");
  }

  /* ============================================================
     SHARED: filter + render
     ============================================================ */
  function bindFilters() {
    const bar = document.getElementById("tradeFilters");
    if (!bar) return;
    bar.querySelectorAll(".chip[data-f]").forEach((c) =>
      c.addEventListener("click", () => {
        bar.querySelectorAll(".chip[data-f]").forEach((x) => x.classList.remove("is-active"));
        c.classList.add("is-active");
        filter = c.dataset.f;
        render();
      })
    );
  }

  function visible() {
    return trades.filter((t) => filter === "all" || t.sym === filter || t.side === filter);
  }

  function render() {
    const body = document.getElementById("tradeBody");
    const count = document.getElementById("tradeCount");
    if (!body) return;
    const list = visible();
    if (count) count.textContent = list.length + " shown";
    body.innerHTML = list.map((t) => `
      <tr class="${t._isNew ? "is-new" : ""}">
        <td class="mono">${t.t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
        <td><b>${t.sym}</b></td>
        <td><span class="pill ${t.side === "BUY" ? "pill--buy" : "pill--sell"}">${t.side}</span></td>
        <td class="mono">${F.fmtNum(t.qty, 0)}</td>
        <td class="mono">${F.fmtMoney(t.px)}</td>
        <td>${t.strat}</td>
        <td><span class="status ${t.status === "filled" ? "status--ok" : "status--new"}">${t.status}</span></td>
      </tr>`).join("");
  }

  function renderDay() {
    const el = document.getElementById("dayStats");
    if (!el) return;
    const today = trades.filter((t) => t.t.toDateString() === new Date().toDateString());
    const buys = today.filter((t) => t.side === "BUY").length;
    const vol = today.reduce((a, t) => a + t.qty * t.px, 0);
    el.innerHTML = `
      <div class="daystat"><span>Trades today</span><b>${today.length}</b></div>
      <div class="daystat"><span>Buys / Sells</span><b>${buys} / ${today.length - buys}</b></div>
      <div class="daystat"><span>Notional</span><b>${F.fmtMoney(vol, 0)}</b></div>`;
  }

  function pulse() {
    const d = document.getElementById("liveDot");
    if (d) { d.classList.add("flash"); setTimeout(() => d.classList.remove("flash"), 600); }
  }
})();
