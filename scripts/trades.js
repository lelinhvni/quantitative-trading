/* ============================================================
   JSS Capital — Trade history
   Requires a logged-in investor or manager session.
   Manager uploads trades via CSV in the investor portal;
   this page shows the result from the database, read-only.
   ============================================================ */
(function () {
  "use strict";
  const F = window.JSS;
  const DB = window.JSSDB;

  let trades = [];
  let filter = "all";

  document.addEventListener("DOMContentLoaded", async () => {
    const liveMode = DB && DB.init();

    if (!liveMode) {
      showAuthGate();
      return;
    }

    const session = await DB.getSession();
    if (!session) {
      showAuthGate();
      return;
    }

    bindFilters();
    await loadTrades();
  });

  async function loadTrades() {
    const body = document.getElementById("tradeBody");
    if (body) body.innerHTML = `<tr><td colspan="7" class="snap__loading" style="text-align:center;padding:32px">Loading…</td></tr>`;

    try {
      const [tradesData, posData] = await Promise.all([
        DB.getTrades(300),
        DB.getPositions(),
      ]);
      trades = tradesData.map(normalise);
      render();
      renderPositions(posData);
      renderDay();
    } catch (err) {
      console.error("[JSS] trade load error:", err);
      const body = document.getElementById("tradeBody");
      if (body) body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted)">Could not load trades: ${esc(err.message)}</td></tr>`;
    }
  }

  function normalise(raw) {
    return {
      t: new Date(raw.executed_at || raw.created_at),
      sym: raw.symbol, side: raw.side,
      qty: +raw.qty, px: +raw.price,
      strat: raw.strategy || "—",
      status: raw.status || "filled",
      note: raw.note || "",
    };
  }

  function renderPositions(positions) {
    const el = document.getElementById("positions");
    if (!el) return;
    if (!positions || !positions.length) {
      el.innerHTML = `<li class="pos__empty">No open positions.</li>`;
      return;
    }
    el.innerHTML = positions.map((p) => `
      <li>
        <div><b>${esc(p.symbol)}</b><span>${F.fmtNum(p.qty, 0)} @ ${F.fmtNum(p.avg_cost, 2)}</span></div>
        <span class="pos__note">avg cost</span>
      </li>`).join("");
  }

  function showAuthGate() {
    const main = document.querySelector(".trades__layout");
    if (main) {
      main.innerHTML = `
        <div class="auth-gate">
          <div class="auth-gate__icon">🔒</div>
          <h2 class="auth-gate__title">Investor access only</h2>
          <p class="auth-gate__desc">The trade log is available to registered JSS Capital investors.<br>Sign in to your account to view trade history and positions.</p>
          <a href="portal.html" class="btn btn--primary">Sign in to investor portal</a>
        </div>`;
    }
    const bar = document.getElementById("tradeFilters");
    if (bar) bar.style.display = "none";
  }

  /* ---------- filter + render ---------- */
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
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted)">No trades recorded yet.</td></tr>`;
      return;
    }
    body.innerHTML = list.map((t) => `
      <tr>
        <td class="mono">${t.t.toLocaleDateString()} ${t.t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
        <td><b>${esc(t.sym)}</b></td>
        <td><span class="pill ${t.side === "BUY" ? "pill--buy" : "pill--sell"}">${t.side}</span></td>
        <td class="mono">${F.fmtNum(t.qty, 0)}</td>
        <td class="mono">${F.fmtMoney(t.px)}</td>
        <td>${esc(t.strat)}</td>
        <td><span class="status status--ok">${esc(t.status)}</span></td>
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
      <div class="daystat"><span>Notional</span><b>${vol ? F.fmtMoney(vol, 0) : "—"}</b></div>`;
  }

  function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
})();
