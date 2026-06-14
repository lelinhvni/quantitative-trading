/* ============================================================
   JSS — Investor portal (DEMO front-end auth)
   ⚠️  v1 only. Real investor data requires a secure backend with
       proper authentication. Do NOT store real credentials here.
   ============================================================ */
(function () {
  "use strict";
  const CFG = window.JSS_CONFIG;
  const F = window.JSS;
  const SESSION_KEY = "jss_session";

  document.addEventListener("DOMContentLoaded", () => {
    bindLogin();
    const s = currentUser();
    if (s) showApp(s); else showLogin();
  });

  function currentUser() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch (_) { return null; }
  }

  function bindLogin() {
    const form = document.getElementById("loginForm");
    const note = document.getElementById("loginNote");
    document.querySelectorAll(".demo-cred").forEach((b) =>
      b.addEventListener("click", () => {
        document.getElementById("lemail").value = b.dataset.email;
        document.getElementById("lpass").value = b.dataset.pass;
      })
    );
    if (form) form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("lemail").value.trim().toLowerCase();
      const pass = document.getElementById("lpass").value;
      const user = (CFG.demoUsers || []).find((u) => u.email.toLowerCase() === email && u.password === pass);
      if (!user) { note.textContent = "Incorrect email or password."; note.classList.add("is-error"); return; }
      const session = { email: user.email, role: user.role, name: user.name, invested: user.invested, since: user.since };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      showApp(session);
    });
    const out = document.getElementById("logoutBtn");
    if (out) out.addEventListener("click", () => { sessionStorage.removeItem(SESSION_KEY); showLogin(); });
  }

  function showLogin() {
    document.getElementById("loginView").hidden = false;
    document.getElementById("appView").hidden = true;
  }

  function showApp(user) {
    document.getElementById("loginView").hidden = true;
    document.getElementById("appView").hidden = false;
    document.getElementById("greeting").textContent = "Welcome, " + (user.name || user.email);
    document.getElementById("roleLine").textContent =
      user.role === "manager" ? "Fund manager view" : "Investor account";
    const body = document.getElementById("portalBody");
    body.innerHTML = user.role === "manager" ? managerView() : investorView(user);
    requestAnimationFrame(() => {
      document.querySelectorAll(".reveal").forEach((e) => e.classList.add("is-visible"));
      if (user.role === "manager") drawManagerCharts(); else drawInvestorChart(user);
    });
  }

  /* deterministic account growth series */
  function accountSeries(invested, sinceStr) {
    const since = new Date(sinceStr || "2025-09-01");
    const months = Math.max(3, monthsBetween(since, new Date()) + 1);
    let seed = invested + since.getMonth() * 31;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const labels = [], values = [];
    let v = invested;
    for (let i = 0; i < months; i++) {
      const d = new Date(since); d.setMonth(since.getMonth() + i);
      labels.push(d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }));
      if (i > 0) v *= 1 + (0.012 + (rnd() - 0.45) * 0.03);
      values.push(v);
    }
    return { labels, values };
  }
  function monthsBetween(a, b) { return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()); }

  function investorView(user) {
    const invested = user.invested || 25000;
    const series = accountSeries(invested, user.since);
    const current = series.values[series.values.length - 1];
    const gain = current - invested;
    const pct = (gain / invested) * 100;
    window.__jssSeries = series;
    return `
    <div class="metricrow reveal">
      <div class="metric"><div class="metric__v">${F.fmtMoney(current, 0)}</div><div class="metric__l">Current value</div></div>
      <div class="metric"><div class="metric__v">${F.fmtMoney(invested, 0)}</div><div class="metric__l">Invested</div></div>
      <div class="metric"><div class="metric__v ${gain >= 0 ? "pos" : "neg"}">${F.fmtMoney(gain, 0)}</div><div class="metric__l">Total gain</div></div>
      <div class="metric"><div class="metric__v ${pct >= 0 ? "pos" : "neg"}">${F.fmtPct(pct)}</div><div class="metric__l">Return</div></div>
    </div>
    <div class="panel reveal">
      <div class="panel__head"><h2>Your capital over time</h2></div>
      <canvas id="acctChart" height="300" aria-label="Account value over time" role="img"></canvas>
    </div>
    <div class="panel reveal">
      <div class="panel__head"><h2>Statements</h2></div>
      <div class="table-wrap"><table class="ttable">
        <thead><tr><th>Period</th><th>Opening</th><th>Closing</th><th>Change</th></tr></thead>
        <tbody>${statementRows(series)}</tbody>
      </table></div>
    </div>
    <p class="portal__note">This is illustrative demo data. Figures are not a real account statement.</p>`;
  }

  function statementRows(series) {
    const rows = [];
    for (let i = series.values.length - 1; i > 0 && rows.length < 6; i--) {
      const open = series.values[i - 1], close = series.values[i];
      const ch = ((close - open) / open) * 100;
      rows.push(`<tr><td>${series.labels[i]}</td><td class="mono">${F.fmtMoney(open, 0)}</td><td class="mono">${F.fmtMoney(close, 0)}</td><td class="mono ${ch >= 0 ? "pos" : "neg"}">${F.fmtPct(ch)}</td></tr>`);
    }
    return rows.join("");
  }

  function drawInvestorChart() {
    const c = document.getElementById("acctChart");
    const s = window.__jssSeries;
    if (c && s) F.chart.lineChart(c, { labels: s.labels, series: [{ values: s.values, color: "#5eead4", fill: "rgba(94,234,212,0.18)", width: 2.4 }], yFmt: (v) => "$" + (v / 1000).toFixed(0) + "k" });
  }

  /* ----- manager view ----- */
  function managerView() {
    const investors = [
      { name: "Sample Investor", invested: 25000, value: 27850 },
      { name: "A. Nguyen", invested: 50000, value: 55120 },
      { name: "M. Patel", invested: 15000, value: 15940 },
      { name: "R. Okafor", invested: 8000, value: 8410 },
    ];
    const aum = investors.reduce((a, i) => a + i.value, 0);
    const principal = investors.reduce((a, i) => a + i.invested, 0);
    const ret = ((aum - principal) / principal) * 100;
    let leads = [];
    try { leads = JSON.parse(localStorage.getItem("jss_leads") || "[]"); } catch (_) {}
    window.__jssMgr = investors;
    return `
    <div class="metricrow reveal">
      <div class="metric"><div class="metric__v">${F.fmtMoney(aum, 0)}</div><div class="metric__l">Assets under management</div></div>
      <div class="metric"><div class="metric__v">${investors.length}</div><div class="metric__l">Investors</div></div>
      <div class="metric"><div class="metric__v ${ret >= 0 ? "pos" : "neg"}">${F.fmtPct(ret)}</div><div class="metric__l">Blended return</div></div>
      <div class="metric"><div class="metric__v">${leads.length}</div><div class="metric__l">New leads</div></div>
    </div>
    <div class="panel reveal">
      <div class="panel__head"><h2>AUM by investor</h2></div>
      <canvas id="aumChart" height="240" aria-label="AUM by investor" role="img"></canvas>
    </div>
    <div class="panel reveal">
      <div class="panel__head"><h2>Investors</h2></div>
      <div class="table-wrap"><table class="ttable">
        <thead><tr><th>Investor</th><th>Invested</th><th>Value</th><th>Return</th></tr></thead>
        <tbody>${investors.map((i) => {
          const p = ((i.value - i.invested) / i.invested) * 100;
          return `<tr><td><b>${i.name}</b></td><td class="mono">${F.fmtMoney(i.invested, 0)}</td><td class="mono">${F.fmtMoney(i.value, 0)}</td><td class="mono ${p >= 0 ? "pos" : "neg"}">${F.fmtPct(p)}</td></tr>`;
        }).join("")}</tbody>
      </table></div>
    </div>
    <div class="panel reveal">
      <div class="panel__head"><h2>Inbound leads</h2><span class="panel__sub">from the homepage form</span></div>
      ${leads.length ? `<div class="table-wrap"><table class="ttable"><thead><tr><th>Name</th><th>Email</th><th>Message</th><th>When</th></tr></thead><tbody>${leads.slice().reverse().map((l) => `<tr><td>${esc(l.name)}</td><td>${esc(l.email)}</td><td>${esc(l.message || "")}</td><td class="mono">${new Date(l.at).toLocaleDateString()}</td></tr>`).join("")}</tbody></table></div>` : `<p class="portal__note">No leads captured yet. Submissions from the homepage contact form will appear here.</p>`}
    </div>
    <p class="portal__note">Demo data. Connect a backend to manage real investors and capital securely.</p>`;
  }

  function drawManagerCharts() {
    const c = document.getElementById("aumChart");
    const investors = window.__jssMgr || [];
    if (!c || !investors.length) return;
    const ratio = devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    const w = rect.width, h = 240;
    c.width = w * ratio; c.height = h * ratio; c.style.height = h + "px";
    const ctx = c.getContext("2d"); ctx.scale(ratio, ratio);
    const pad = { t: 16, b: 40, l: 56, r: 10 };
    const max = Math.max(...investors.map((i) => i.value)) * 1.1;
    const bw = (w - pad.l - pad.r) / investors.length;
    ctx.clearRect(0, 0, w, h);
    ctx.font = "11px JetBrains Mono, monospace"; ctx.textBaseline = "middle";
    for (let g = 0; g <= 4; g++) {
      const gy = pad.t + (g / 4) * (h - pad.t - pad.b);
      ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(w - pad.r, gy); ctx.stroke();
      ctx.fillStyle = "rgba(147,160,189,0.7)"; ctx.textAlign = "right";
      ctx.fillText("$" + ((max - (g / 4) * max) / 1000).toFixed(0) + "k", pad.l - 8, gy);
    }
    investors.forEach((inv, i) => {
      const bh = (inv.value / max) * (h - pad.t - pad.b);
      const x = pad.l + i * bw + bw * 0.2;
      const grad = ctx.createLinearGradient(0, h - pad.b - bh, 0, h - pad.b);
      grad.addColorStop(0, "#5eead4"); grad.addColorStop(1, "#6366f1");
      ctx.fillStyle = grad; ctx.fillRect(x, h - pad.b - bh, bw * 0.6, bh);
      ctx.fillStyle = "rgba(147,160,189,0.85)"; ctx.textAlign = "center";
      ctx.fillText(inv.name.split(" ")[0], x + bw * 0.3, h - pad.b + 16);
    });
  }

  function esc(s) { return (s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
})();
