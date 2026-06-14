/* ============================================================
   JSS Capital — Investor portal
   Supports two modes:
     LIVE: Supabase configured in config.js → real auth + DB
     DEMO: Supabase not configured          → demo login + local data
   ============================================================ */
(function () {
  "use strict";
  const F = window.JSS;
  const DB = window.JSSDB;
  const CFG = window.JSS_CONFIG;

  let liveMode = false;

  document.addEventListener("DOMContentLoaded", async () => {
    liveMode = DB && DB.init();
    if (liveMode) await initLive();
    else initDemo();
  });

  /* ============================================================
     LIVE MODE (Supabase)
     ============================================================ */
  async function initLive() {
    document.getElementById("loginView").hidden = false;
    document.getElementById("appView").hidden = true;

    // Listen for auth state changes
    DB.onAuthChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        await showLiveApp();
      } else if (event === "SIGNED_OUT") {
        showLogin();
      }
    });

    // Check existing session
    const session = await DB.getSession();
    if (session) await showLiveApp(); else showLogin();

    bindLiveLogin();
    bindLogout();
  }

  function showLogin() {
    document.getElementById("loginView").hidden = false;
    document.getElementById("appView").hidden = true;
  }

  function bindLiveLogin() {
    const form = document.getElementById("loginForm");
    const note = document.getElementById("loginNote");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      note.classList.remove("is-error"); note.textContent = "Signing in…";
      try {
        await DB.signIn(
          document.getElementById("lemail").value.trim().toLowerCase(),
          document.getElementById("lpass").value
        );
        // Auth state change handler takes over
      } catch (err) {
        note.textContent = err.message || "Sign-in failed.";
        note.classList.add("is-error");
      }
    });
  }

  async function showLiveApp() {
    try {
      const profile = await DB.getProfile(true);
      document.getElementById("loginView").hidden = true;
      document.getElementById("appView").hidden = false;
      document.getElementById("greeting").textContent = "Welcome, " + profile.name;
      document.getElementById("roleLine").textContent =
        profile.role === "manager" ? "Fund manager" : "Investor account";
      if (profile.role === "manager") await renderManager();
      else await renderInvestor(profile);
    } catch (err) {
      showError("Could not load your account: " + err.message);
    }
  }

  function bindLogout() {
    const btn = document.getElementById("logoutBtn");
    if (btn) btn.addEventListener("click", async () => {
      if (liveMode) await DB.signOut(); else showLogin();
    });
  }

  /* ============================================================
     INVESTOR VIEW
     ============================================================ */
  async function renderInvestor(profile) {
    const body = document.getElementById("portalBody");
    body.innerHTML = `<div class="snap__loading">Loading your account…</div>`;

    const [account, latestNav, events, allNav] = await Promise.all([
      DB.getMyAccount(),
      DB.getLatestNav(),
      DB.getMyCapitalEvents(),
      DB.getAllNavHistory(),
    ]);

    const navPU = latestNav ? +latestNav.nav_per_unit : null;
    const units = account ? +account.units : 0;
    const curVal = navPU ? units * navPU : null;
    const totalDep = events.filter((e) => e.type === "deposit").reduce((a, e) => a + +e.amount, 0);
    const totalWith = events.filter((e) => e.type === "withdrawal").reduce((a, e) => a + +e.amount, 0);
    const netInvested = totalDep - totalWith;
    const gain = curVal != null ? curVal - netInvested : null;
    const retPct = curVal != null && netInvested > 0 ? (gain / netInvested) * 100 : null;

    // Build account value series from NAV history × units
    const navSeries = allNav.length ? allNav : null;

    body.innerHTML = `
      <div class="metricrow reveal">
        <div class="metric"><div class="metric__v">${curVal != null ? F.fmtMoney(curVal, 0) : "—"}</div><div class="metric__l">Current value</div></div>
        <div class="metric"><div class="metric__v">${F.fmtMoney(netInvested, 0)}</div><div class="metric__l">Net invested</div></div>
        <div class="metric"><div class="metric__v ${gain != null && gain >= 0 ? "pos" : "neg"}">${gain != null ? F.fmtMoney(gain, 0) : "—"}</div><div class="metric__l">Total gain/loss</div></div>
        <div class="metric"><div class="metric__v ${retPct != null && retPct >= 0 ? "pos" : "neg"}">${retPct != null ? F.fmtPct(retPct) : "—"}</div><div class="metric__l">Total return</div></div>
        <div class="metric"><div class="metric__v mono">${units.toFixed(4)}</div><div class="metric__l">Fund units held</div></div>
      </div>
      ${navSeries ? `
      <div class="panel reveal">
        <div class="panel__head"><h2>Account value over time</h2><span class="panel__sub">NAV × your units</span></div>
        <canvas id="acctChart" height="300" role="img" aria-label="Account value chart"></canvas>
      </div>` : ""}
      <div class="panel reveal">
        <div class="panel__head"><h2>Capital events</h2></div>
        ${events.length ? `
        <div class="table-wrap"><table class="ttable">
          <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Units</th><th>NAV at txn</th><th>Note</th></tr></thead>
          <tbody>${events.map((ev) => `
            <tr>
              <td class="mono">${ev.date}</td>
              <td><span class="pill ${ev.type === "deposit" ? "pill--buy" : "pill--sell"}">${ev.type}</span></td>
              <td class="mono">${F.fmtMoney(ev.amount, 0)}</td>
              <td class="mono">${ev.units != null ? F.fmtNum(ev.units, 4) : "—"}</td>
              <td class="mono">${ev.nav_at_txn != null ? F.fmtNum(ev.nav_at_txn, 2) : "—"}</td>
              <td>${ev.note || ""}</td>
            </tr>`).join("")}</tbody>
        </table></div>` : `<p class="portal__note">No capital events recorded yet.</p>`}
      </div>
      ${latestNav ? `<p class="portal__note">NAV as of ${latestNav.date}: ${F.fmtNum(latestNav.nav_per_unit, 2)} per unit.</p>` : `<p class="portal__note">No NAV entries yet — fund manager will add these.</p>`}`;

    revealAll();
    if (navSeries && units > 0) {
      const c = document.getElementById("acctChart");
      if (c) F.chart.lineChart(c, {
        labels: navSeries.map((n) => n.date.slice(5)),
        series: [{ values: navSeries.map((n) => units * +n.nav_per_unit), color: "#5eead4", fill: "rgba(94,234,212,0.18)", width: 2.4 }],
        yFmt: (v) => "$" + (v / 1000).toFixed(0) + "k",
      });
    }
  }

  /* ============================================================
     MANAGER VIEW
     ============================================================ */
  async function renderManager() {
    const body = document.getElementById("portalBody");
    body.innerHTML = `<div class="snap__loading">Loading manager dashboard…</div>`;

    const [investors, latestNav, positions, leads, navHistory] = await Promise.all([
      DB.getAllInvestors().catch(() => []),
      DB.getLatestNav().catch(() => null),
      DB.getPositions().catch(() => []),
      DB.getLeads().catch(() => []),
      DB.getAllNavHistory().catch(() => []),
    ]);

    const navPU = latestNav ? +latestNav.nav_per_unit : 1000;
    const aum = investors.reduce((a, inv) => a + +inv.units * navPU, 0);
    const totalInvested = investors.reduce((a, inv) => a + +(inv.net_invested || 0), 0);

    body.innerHTML = `
      <div class="metricrow reveal">
        <div class="metric"><div class="metric__v">${F.fmtMoney(aum, 0)}</div><div class="metric__l">AUM (est.)</div></div>
        <div class="metric"><div class="metric__v">${investors.length}</div><div class="metric__l">Investors</div></div>
        <div class="metric"><div class="metric__v">${navPU ? F.fmtNum(navPU, 2) : "—"}</div><div class="metric__l">Latest NAV / unit</div></div>
        <div class="metric"><div class="metric__v">${latestNav ? latestNav.date : "None"}</div><div class="metric__l">Last NAV date</div></div>
        <div class="metric"><div class="metric__v">${leads.length}</div><div class="metric__l">Leads</div></div>
      </div>

      <!-- NAV entry -->
      <div class="panel reveal">
        <div class="panel__head"><h2>Update NAV</h2><span class="panel__sub">Set today's NAV per unit</span></div>
        <form class="mgr-form" id="navForm">
          <div class="field"><label>Date</label><input type="date" name="date" value="${new Date().toISOString().slice(0,10)}" required /></div>
          <div class="field"><label>NAV per unit</label><input type="number" name="nav" step="0.0001" min="0" required placeholder="1212.40" value="${navPU ? navPU : ""}" /></div>
          <div class="field"><label>AUM ($, optional)</label><input type="number" name="aum" step="0.01" min="0" placeholder="124091.00" /></div>
          <div class="field field--full"><label>Note</label><input type="text" name="note" placeholder="End of day valuation" /></div>
          <button type="submit" class="btn btn--primary">Save NAV</button>
          <p class="cta__note" id="navNote" role="status" aria-live="polite"></p>
        </form>
        ${navHistory.length ? `
        <div class="table-wrap" style="margin-top:18px">
          <table class="ttable"><thead><tr><th>Date</th><th>NAV / unit</th><th>AUM</th><th>Note</th></tr></thead>
          <tbody>${navHistory.slice().reverse().slice(0, 12).map((n) => `
            <tr><td class="mono">${n.date}</td><td class="mono">${F.fmtNum(n.nav_per_unit, 2)}</td><td class="mono">${n.aum ? F.fmtMoney(n.aum, 0) : "—"}</td><td>${n.note || ""}</td></tr>
          `).join("")}</tbody></table>
        </div>` : ""}
      </div>

      <!-- Add trade -->
      <div class="panel reveal">
        <div class="panel__head"><h2>Log a trade</h2><span class="panel__sub">Manual entry or paste from broker</span></div>
        <form class="mgr-form" id="tradeForm">
          <div class="field"><label>Symbol</label>
            <select name="symbol">
              ${(CFG.tickers || []).map((t) => `<option>${t.symbol}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label>Side</label>
            <select name="side"><option>BUY</option><option>SELL</option></select>
          </div>
          <div class="field"><label>Qty</label><input type="number" name="qty" step="0.0001" min="0.0001" required placeholder="200" /></div>
          <div class="field"><label>Price ($)</label><input type="number" name="price" step="0.0001" min="0" required placeholder="545.20" /></div>
          <div class="field"><label>Strategy</label>
            <select name="strategy">
              ${["Trend","Momentum","Mean-Rev","Risk overlay","Breakout","Manual"].map((s) => `<option>${s}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label>Executed at (optional)</label><input type="datetime-local" name="executedAt" /></div>
          <div class="field field--full"><label>Note</label><input type="text" name="note" placeholder="Optional notes" /></div>
          <button type="submit" class="btn btn--primary">Add trade</button>
          <p class="cta__note" id="tradeNote" role="status" aria-live="polite"></p>
        </form>
      </div>

      <!-- Positions -->
      <div class="panel reveal">
        <div class="panel__head"><h2>Open positions</h2></div>
        ${positions.length ? `
        <div class="table-wrap"><table class="ttable">
          <thead><tr><th>Symbol</th><th>Qty</th><th>Avg cost</th><th>Updated</th></tr></thead>
          <tbody>${positions.map((p) => `
            <tr><td><b>${p.symbol}</b></td><td class="mono">${F.fmtNum(p.qty, 2)}</td><td class="mono">${F.fmtNum(p.avg_cost, 2)}</td><td class="mono">${new Date(p.updated_at).toLocaleDateString()}</td></tr>
          `).join("")}</tbody>
        </table></div>` : `<p class="portal__note">No open positions logged yet.</p>`}
        <!-- Position upsert form -->
        <details class="mgr-details">
          <summary>Update / add position</summary>
          <form class="mgr-form mgr-form--sm" id="posForm">
            <div class="field"><label>Symbol</label>
              <select name="symbol">${(CFG.tickers || []).map((t) => `<option>${t.symbol}</option>`).join("")}</select>
            </div>
            <div class="field"><label>Qty</label><input type="number" name="qty" step="0.0001" required placeholder="400" /></div>
            <div class="field"><label>Avg cost</label><input type="number" name="avgCost" step="0.0001" required placeholder="545.80" /></div>
            <button type="submit" class="btn btn--ghost btn--sm">Save</button>
            <p class="cta__note" id="posNote" role="status" aria-live="polite"></p>
          </form>
        </details>
      </div>

      <!-- Investors -->
      <div class="panel reveal">
        <div class="panel__head"><h2>Investor accounts</h2></div>
        ${investors.length ? `
        <div class="table-wrap"><table class="ttable">
          <thead><tr><th>Investor</th><th>Units</th><th>Est. value</th><th>Since</th></tr></thead>
          <tbody>${investors.map((inv) => {
            const val = +inv.units * navPU;
            return `<tr>
              <td><b>${inv.profiles ? inv.profiles.name : "—"}</b></td>
              <td class="mono">${F.fmtNum(inv.units, 4)}</td>
              <td class="mono">${F.fmtMoney(val, 0)}</td>
              <td class="mono">${inv.since || "—"}</td>
            </tr>`;
          }).join("")}</tbody>
        </table></div>` : `<p class="portal__note">No investor accounts yet. See README for how to add investors.</p>`}
        <!-- Update investor units form -->
        <details class="mgr-details">
          <summary>Update investor units</summary>
          <form class="mgr-form mgr-form--sm" id="unitsForm">
            <div class="field"><label>Investor ID (UUID)</label><input type="text" name="investorId" placeholder="From Supabase Auth dashboard" /></div>
            <div class="field"><label>Units</label><input type="number" name="units" step="0.000001" min="0" required placeholder="25.000000" /></div>
            <div class="field"><label>Since</label><input type="date" name="since" /></div>
            <div class="field field--full"><label>Note</label><input type="text" name="note" /></div>
            <button type="submit" class="btn btn--ghost btn--sm">Save</button>
            <p class="cta__note" id="unitsNote" role="status" aria-live="polite"></p>
          </form>
        </details>
      </div>

      <!-- Leads -->
      <div class="panel reveal">
        <div class="panel__head"><h2>Contact leads</h2><span class="panel__sub">from homepage form</span></div>
        ${leads.length ? `
        <div class="table-wrap"><table class="ttable">
          <thead><tr><th>Name</th><th>Email</th><th>Message</th><th>When</th></tr></thead>
          <tbody>${leads.map((l) => `
            <tr>
              <td>${esc(l.name)}</td>
              <td>${esc(l.email)}</td>
              <td>${esc(l.message || "")}</td>
              <td class="mono">${new Date(l.created_at).toLocaleDateString()}</td>
            </tr>`).join("")}</tbody>
        </table></div>` : `<p class="portal__note">No leads yet.</p>`}
      </div>

      <p class="portal__note">Live data from Supabase. <a href="trades.html" class="inline-link">View full trade feed →</a></p>`;

    revealAll();
    bindManagerForms(navPU);
  }

  function bindManagerForms(navPU) {
    /* NAV form */
    const navForm = document.getElementById("navForm");
    if (navForm) navForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const note = document.getElementById("navNote");
      try {
        await DB.upsertNav({
          date: navForm.elements.date.value,
          navPerUnit: parseFloat(navForm.elements.nav.value),
          aum: navForm.elements.aum.value ? parseFloat(navForm.elements.aum.value) : null,
          note: navForm.elements.note.value.trim() || null,
        });
        note.textContent = "✓ NAV saved."; note.classList.remove("is-error");
      } catch (err) { note.textContent = "Error: " + err.message; note.classList.add("is-error"); }
    });

    /* Trade form */
    const tradeForm = document.getElementById("tradeForm");
    if (tradeForm) tradeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const note = document.getElementById("tradeNote");
      try {
        const t = tradeForm.elements;
        const ex = t.executedAt.value ? new Date(t.executedAt.value).toISOString() : null;
        await DB.addTrade({ symbol: t.symbol.value, side: t.side.value, qty: parseFloat(t.qty.value),
          price: parseFloat(t.price.value), strategy: t.strategy.value, note: t.note.value.trim() || null,
          executedAt: ex });
        note.textContent = "✓ Trade added."; note.classList.remove("is-error"); tradeForm.reset();
      } catch (err) { note.textContent = "Error: " + err.message; note.classList.add("is-error"); }
    });

    /* Position form */
    const posForm = document.getElementById("posForm");
    if (posForm) posForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const note = document.getElementById("posNote");
      try {
        const t = posForm.elements;
        await DB.upsertPosition({ symbol: t.symbol.value, qty: parseFloat(t.qty.value), avgCost: parseFloat(t.avgCost.value) });
        note.textContent = "✓ Position updated."; note.classList.remove("is-error");
      } catch (err) { note.textContent = "Error: " + err.message; note.classList.add("is-error"); }
    });

    /* Investor units form */
    const unitsForm = document.getElementById("unitsForm");
    if (unitsForm) unitsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const note = document.getElementById("unitsNote");
      try {
        const t = unitsForm.elements;
        await DB.upsertInvestorAccount({
          investorId: t.investorId.value.trim(), units: parseFloat(t.units.value),
          since: t.since.value || new Date().toISOString().slice(0, 10), note: t.note.value.trim() || null });
        note.textContent = "✓ Investor account updated."; note.classList.remove("is-error");
      } catch (err) { note.textContent = "Error: " + err.message; note.classList.add("is-error"); }
    });
  }

  /* ============================================================
     DEMO MODE (Supabase not configured)
     ============================================================ */
  function initDemo() {
    document.getElementById("loginView").hidden = false;
    document.getElementById("appView").hidden = true;

    const banner = document.createElement("div");
    banner.className = "demo-banner";
    banner.innerHTML = `<b>Demo mode</b> — Supabase is not yet configured. <a href="README.md" class="inline-link">See setup guide.</a>`;
    document.getElementById("loginView").prepend(banner);

    document.querySelectorAll(".demo-cred").forEach((b) =>
      b.addEventListener("click", () => {
        document.getElementById("lemail").value = b.dataset.email;
        document.getElementById("lpass").value = b.dataset.pass;
      })
    );

    const form = document.getElementById("loginForm");
    const note = document.getElementById("loginNote");
    if (form) form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("lemail").value.trim().toLowerCase();
      const pass = document.getElementById("lpass").value;
      const user = (CFG.demoUsers || []).find((u) => u.email.toLowerCase() === email && u.password === pass);
      if (!user) { note.textContent = "Incorrect demo credentials."; note.classList.add("is-error"); return; }
      sessionStorage.setItem("jss_demo_session", JSON.stringify(user));
      showDemoApp(user);
    });

    const existingSession = (() => { try { return JSON.parse(sessionStorage.getItem("jss_demo_session")); } catch { return null; } })();
    if (existingSession) showDemoApp(existingSession);

    document.getElementById("logoutBtn")?.addEventListener("click", () => {
      sessionStorage.removeItem("jss_demo_session"); showLogin();
    });
  }

  function showDemoApp(user) {
    document.getElementById("loginView").hidden = true;
    document.getElementById("appView").hidden = false;
    document.getElementById("greeting").textContent = "Welcome, " + user.name;
    document.getElementById("roleLine").textContent = user.role === "manager" ? "Fund manager (demo)" : "Investor account (demo)";
    const body = document.getElementById("portalBody");
    body.innerHTML = demoBody(user);
    revealAll();
    drawDemoCharts(user);
  }

  function demoBody(user) {
    if (user.role === "manager") return demoManagerBody();
    const inv = user.invested || 25000;
    const curVal = inv * 1.114;
    const gain = curVal - inv; const retPct = (gain / inv) * 100;
    return `
      <div class="demo-banner">Demo data. Configure Supabase to show real investor balances.</div>
      <div class="metricrow reveal">
        <div class="metric"><div class="metric__v">${F.fmtMoney(curVal, 0)}</div><div class="metric__l">Current value (demo)</div></div>
        <div class="metric"><div class="metric__v">${F.fmtMoney(inv, 0)}</div><div class="metric__l">Invested</div></div>
        <div class="metric"><div class="metric__v pos">${F.fmtMoney(gain, 0)}</div><div class="metric__l">Total gain</div></div>
        <div class="metric"><div class="metric__v pos">${F.fmtPct(retPct)}</div><div class="metric__l">Return</div></div>
      </div>
      <div class="panel reveal"><div class="panel__head"><h2>Account value (demo)</h2></div>
        <canvas id="acctChart" height="280" role="img"></canvas></div>`;
  }

  function demoManagerBody() {
    const investors = [
      { name: "Sample Investor A", units: 25, val: 25000 * 1.114 },
      { name: "Sample Investor B", units: 50, val: 50000 * 1.114 },
      { name: "Sample Investor C", units: 12, val: 12500 * 1.114 },
    ];
    const aum = investors.reduce((a, i) => a + i.val, 0);
    return `
      <div class="demo-banner">Demo data. Configure Supabase for real investor management.</div>
      <div class="metricrow reveal">
        <div class="metric"><div class="metric__v">${F.fmtMoney(aum, 0)}</div><div class="metric__l">AUM (demo)</div></div>
        <div class="metric"><div class="metric__v">${investors.length}</div><div class="metric__l">Investors</div></div>
        <div class="metric"><div class="metric__v">1,212.40</div><div class="metric__l">Latest NAV / unit</div></div>
      </div>
      <div class="panel reveal"><div class="panel__head"><h2>Investors (demo)</h2></div>
        <div class="table-wrap"><table class="ttable">
          <thead><tr><th>Investor</th><th>Units</th><th>Est. value</th></tr></thead>
          <tbody>${investors.map((i) => `<tr><td><b>${i.name}</b></td><td class="mono">${i.units}.0000</td><td class="mono">${F.fmtMoney(i.val, 0)}</td></tr>`).join("")}</tbody>
        </table></div>
      </div>`;
  }

  function drawDemoCharts(user) {
    const c = document.getElementById("acctChart");
    if (!c) return;
    const invested = (user.invested || 25000);
    const n = 10;
    const vals = Array.from({ length: n }, (_, i) => invested * (1 + i * 0.013));
    const labels = Array.from({ length: n }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - (n - 1) + i); return d.toLocaleDateString("en-US", { month: "short" }); });
    F.chart.lineChart(c, { labels, series: [{ values: vals, color: "#5eead4", fill: "rgba(94,234,212,0.18)", width: 2.4 }], yFmt: (v) => "$" + (v / 1000).toFixed(0) + "k" });
  }

  /* ============================================================
     Shared helpers
     ============================================================ */
  function showError(msg) {
    const body = document.getElementById("portalBody");
    if (body) body.innerHTML = `<div class="snap__loading">${esc(msg)}</div>`;
    document.getElementById("loginView").hidden = true;
    document.getElementById("appView").hidden = false;
  }

  function revealAll() {
    requestAnimationFrame(() => document.querySelectorAll(".reveal").forEach((e) => e.classList.add("is-visible")));
  }

  function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
})();
