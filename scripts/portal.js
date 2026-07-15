/* ============================================================
   BPSQuant — Investor portal
   LIVE: Supabase configured → real auth + DB
   DEMO: Supabase not configured → demo login + local data
   ============================================================ */
(function () {
  "use strict";
  const F   = window.JSS;
  const DB  = window.JSSDB;
  const CFG = window.JSS_CONFIG;

  let liveMode   = false;
  let _activeTab = "overview";

  /* ============================================================
     DEMO DATA — 2026 trades (Excel format: Col C = final P&L $)
     Columns: Name | Return% | P&L$ | CreatedAt | Expiration |
              NetCredit | Chance | MaxLoss | MaxProfit |
              High | Low | Delta | Theta | Gamma | Vega | Rho |
              IV | Link | Group
              Sub-rows: Symbol | Qty | Entry | Current | Close
     ============================================================ */
  const DEMO_TRADES = [
    { id:"t01", name:"SPY Iron Condor",            returnPct: 8.2,  pnl:  820,
      createdAt:"2026-01-06", expiration:"2026-01-17",
      netCredit:820, chance:78, maxLoss:4180, maxProfit:820, high:590, low:520,
      delta:-0.08, theta:45.2, gamma:0.003, vega:-12.4, rho:0.8, iv:18.4,
      group:"Iron Condor", status:"closed",
      legs:[
        {symbol:"SPY 520P", qty:-2, entry:1.85, current:0.00, close:0.00},
        {symbol:"SPY 515P", qty: 2, entry:0.95, current:0.00, close:0.00},
        {symbol:"SPY 580C", qty:-2, entry:2.10, current:0.00, close:0.00},
        {symbol:"SPY 585C", qty: 2, entry:1.05, current:0.00, close:0.00},
      ]},
    { id:"t02", name:"QQQ Bull Put Spread",        returnPct: 9.0,  pnl:  450,
      createdAt:"2026-01-20", expiration:"2026-01-30",
      netCredit:450, chance:82, maxLoss:5550, maxProfit:450, high:490, low:420,
      delta:-0.12, theta:28.5, gamma:0.005, vega:-8.2, rho:0.4, iv:22.1,
      group:"Bull Put Spread", status:"closed",
      legs:[
        {symbol:"QQQ 430P", qty:-3, entry:2.10, current:0.00, close:0.10},
        {symbol:"QQQ 425P", qty: 3, entry:1.60, current:0.00, close:0.05},
      ]},
    { id:"t03", name:"SPY Covered Call — The Wheel", returnPct: 1.4,  pnl:  380,
      createdAt:"2026-02-03", expiration:"2026-02-21",
      netCredit:380, chance:72, maxLoss:null, maxProfit:380, high:578, low:null,
      delta:-0.28, theta:22.1, gamma:0.008, vega:-9.8, rho:0.6, iv:15.8,
      group:"The Wheel", status:"closed",
      legs:[
        {symbol:"SPY 575C", qty:-2, entry:2.20, current:0.00, close:0.05},
      ]},
    { id:"t04", name:"DIA Cash-Secured Put",        returnPct:-3.6,  pnl: -180,
      createdAt:"2026-02-17", expiration:"2026-03-07",
      netCredit:320, chance:74, maxLoss:39680, maxProfit:320, high:415, low:385,
      delta:-0.25, theta:18.4, gamma:0.006, vega:-10.2, rho:0.3, iv:19.5,
      group:"Cash-Secured Put", status:"closed",
      legs:[
        {symbol:"DIA 390P", qty:-2, entry:1.60, current:0.00, close:2.50},
      ]},
    { id:"t05", name:"QQQ Iron Condor",            returnPct:11.6,  pnl:  620,
      createdAt:"2026-03-10", expiration:"2026-03-28",
      netCredit:620, chance:76, maxLoss:5380, maxProfit:620, high:500, low:430,
      delta:-0.06, theta:52.8, gamma:0.002, vega:-15.1, rho:0.5, iv:24.8,
      group:"Iron Condor", status:"closed",
      legs:[
        {symbol:"QQQ 435P", qty:-3, entry:1.95, current:0.00, close:0.10},
        {symbol:"QQQ 430P", qty: 3, entry:1.05, current:0.00, close:0.05},
        {symbol:"QQQ 490C", qty:-3, entry:1.88, current:0.00, close:0.10},
        {symbol:"QQQ 495C", qty: 3, entry:0.88, current:0.00, close:0.05},
      ]},
    { id:"t06", name:"SPY Cash-Secured Put — The Wheel", returnPct: 3.2,  pnl:  950,
      createdAt:"2026-04-01", expiration:"2026-04-17",
      netCredit:950, chance:80, maxLoss:null, maxProfit:950, high:null, low:540,
      delta:-0.20, theta:62.5, gamma:0.007, vega:-14.8, rho:0.9, iv:17.2,
      group:"The Wheel", status:"closed",
      legs:[
        {symbol:"SPY 545P", qty:-5, entry:1.90, current:0.00, close:0.00},
      ]},
    { id:"t07", name:"SPY Covered Call — The Wheel", returnPct: 1.6,  pnl:  410,
      createdAt:"2026-04-22", expiration:"2026-05-02",
      netCredit:410, chance:75, maxLoss:null, maxProfit:410, high:565, low:null,
      delta:-0.25, theta:38.2, gamma:0.009, vega:-8.5, rho:0.7, iv:14.6,
      group:"The Wheel", status:"closed",
      legs:[
        {symbol:"SPY 560C", qty:-5, entry:0.82, current:0.00, close:0.00},
      ]},
    { id:"t08", name:"QQQ Bull Put Spread",        returnPct:10.4,  pnl:  520,
      createdAt:"2026-05-06", expiration:"2026-05-16",
      netCredit:520, chance:81, maxLoss:4980, maxProfit:520, high:480, low:440,
      delta:-0.10, theta:34.1, gamma:0.004, vega:-9.6, rho:0.4, iv:21.3,
      group:"Bull Put Spread", status:"closed",
      legs:[
        {symbol:"QQQ 445P", qty:-4, entry:1.85, current:0.00, close:0.05},
        {symbol:"QQQ 440P", qty: 4, entry:0.55, current:0.00, close:0.02},
      ]},
    { id:"t09", name:"SPY Iron Condor",            returnPct: 9.1,  pnl:  730,
      createdAt:"2026-05-19", expiration:"2026-05-30",
      netCredit:730, chance:77, maxLoss:7270, maxProfit:730, high:570, low:530,
      delta:-0.07, theta:48.9, gamma:0.003, vega:-11.8, rho:0.8, iv:16.4,
      group:"Iron Condor", status:"closed",
      legs:[
        {symbol:"SPY 532P", qty:-4, entry:2.05, current:0.00, close:0.10},
        {symbol:"SPY 527P", qty: 4, entry:1.22, current:0.00, close:0.05},
        {symbol:"SPY 570C", qty:-4, entry:2.10, current:0.00, close:0.10},
        {symbol:"SPY 575C", qty: 4, entry:1.22, current:0.00, close:0.05},
      ]},
    { id:"t10", name:"SPY Covered Call",           returnPct: 1.2,  pnl:  380,
      createdAt:"2026-06-02", expiration:"2026-06-13",
      netCredit:380, chance:74, maxLoss:null, maxProfit:380, high:572, low:null,
      delta:-0.26, theta:36.4, gamma:0.008, vega:-9.2, rho:0.7, iv:15.1,
      group:"The Wheel", status:"closed",
      legs:[
        {symbol:"SPY 568C", qty:-4, entry:0.95, current:0.00, close:0.00},
      ]},
    { id:"t11", name:"DIA Iron Condor",            returnPct: 9.4,  pnl:  680,
      createdAt:"2026-06-09", expiration:"2026-06-20",
      netCredit:680, chance:79, maxLoss:6320, maxProfit:680, high:425, low:388,
      delta:-0.07, theta:41.2, gamma:0.003, vega:-10.6, rho:0.6, iv:17.8,
      group:"Iron Condor", status:"closed",
      legs:[
        {symbol:"DIA 390P", qty:-4, entry:1.88, current:0.00, close:0.05},
        {symbol:"DIA 386P", qty: 4, entry:1.08, current:0.00, close:0.02},
        {symbol:"DIA 422C", qty:-4, entry:1.90, current:0.00, close:0.05},
        {symbol:"DIA 426C", qty: 4, entry:1.10, current:0.00, close:0.02},
      ]},
    { id:"t12", name:"QQQ Cash-Secured Put",       returnPct: 5.8,  pnl:  290,
      createdAt:"2026-06-16", expiration:"2026-06-27",
      netCredit:290, chance:83, maxLoss:null, maxProfit:290, high:null, low:458,
      delta:-0.17, theta:24.6, gamma:0.006, vega:-7.8, rho:0.4, iv:20.4,
      group:"Cash-Secured Put", status:"open",
      legs:[
        {symbol:"QQQ 460P", qty:-2, entry:1.45, current:0.50, close:null},
      ]},
    { id:"t13", name:"SPY Iron Condor (Jul)",      returnPct: 0.0,  pnl:    0,
      createdAt:"2026-06-23", expiration:"2026-07-10",
      netCredit:540, chance:78, maxLoss:4460, maxProfit:540, high:585, low:535,
      delta:-0.05, theta:44.0, gamma:0.003, vega:-11.2, rho:0.6, iv:16.9,
      group:"Iron Condor", status:"open",
      legs:[
        {symbol:"SPY 538P", qty:-3, entry:1.70, current:1.20, close:null},
        {symbol:"SPY 533P", qty: 3, entry:1.05, current:0.75, close:null},
        {symbol:"SPY 582C", qty:-3, entry:1.55, current:1.10, close:null},
        {symbol:"SPY 587C", qty: 3, entry:1.02, current:0.72, close:null},
      ]},
  ];

  const DEMO_MSGS_KEY = "jss_msgs_v1";
  const DEMO_RISK_KEY = "jss_risk_v1";

  function getDemoMsgs() {
    try { return JSON.parse(localStorage.getItem(DEMO_MSGS_KEY)); } catch { return null; }
  }
  function saveDemoMsgs(msgs) { localStorage.setItem(DEMO_MSGS_KEY, JSON.stringify(msgs)); }
  function initDemoMsgs() {
    const existing = getDemoMsgs();
    if (existing) return existing;
    const msgs = [
      { id:"m1", from:"manager", fromName:"BPSQuant", subject:"Welcome to BPSQuant",
        body:"Dear Investor, your account is now active. Your initial deposit is on record. Log in any time to track performance, view trades and message us with questions.",
        date:"2026-01-05T09:00:00Z", read:true },
      { id:"m2", from:"investor", fromName:"You", subject:"Question about The Wheel",
        body:"Hi, I see a lot of Wheel strategy trades. Can you explain how it reduces risk compared to just buying shares outright?",
        date:"2026-02-10T14:30:00Z", read:true },
      { id:"m3", from:"manager", fromName:"BPSQuant", subject:"RE: Question about The Wheel",
        body:"Great question! With The Wheel we sell a cash-secured put first — collecting premium and agreeing to buy at a lower price only if the market drops. If assigned, we then sell covered calls to generate income while holding. Both steps pay us premium. It's lower risk than buying shares outright because we either never buy (premium profit) or buy at a discount with ongoing income.",
        date:"2026-02-11T10:15:00Z", read:true },
      { id:"m4", from:"manager", fromName:"BPSQuant", subject:"Q1 2026 Performance Update",
        body:"Q1 2026 summary: Net P&L +$2,090 across 5 closed positions. Win rate 80%. The DIA cash-secured put in March resulted in a small loss as DIA briefly declined — within normal risk parameters. Q2 is off to a strong start with two Wheel positions and an iron condor open.",
        date:"2026-04-02T08:00:00Z", read:false },
    ];
    saveDemoMsgs(msgs);
    return msgs;
  }

  /* ============================================================
     INIT
     ============================================================ */
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
    document.getElementById("appView").hidden   = true;
    // Real auth is active — demo accounts don't exist in live mode
    const demoBlock = document.getElementById("demoCredsBlock");
    if (demoBlock) demoBlock.remove();

    DB.onAuthChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) await showLiveApp();
      else if (event === "SIGNED_OUT") showLogin();
    });

    try {
      const session = await DB.getSession();
      if (session) await showLiveApp(); else showLogin();
    } catch { showLogin(); }
    bindLiveLogin(); bindLogout(); bindForgot();
  }

  function bindForgot() {
    const btn  = document.getElementById("forgotBtn");
    if (!btn) return;
    const note = document.getElementById("loginNote");
    btn.addEventListener("click", async () => {
      const email = (document.getElementById("lemail").value || "").trim().toLowerCase();
      note.classList.remove("is-error");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        note.textContent = "Enter your email above first, then tap Forgot password?";
        note.classList.add("is-error"); return;
      }
      if (!liveMode) { note.textContent = "Password reset works once live login is configured. Use the demo accounts below."; return; }
      try { await DB.resetPassword(email); note.textContent = "If an account exists for that email, a reset link is on its way."; }
      catch (err) { note.textContent = err.message || "Could not send a reset link right now."; note.classList.add("is-error"); }
    });
  }

  function showLogin() {
    document.getElementById("loginView").hidden = false;
    document.getElementById("appView").hidden   = true;
  }

  function bindLiveLogin() {
    const form = document.getElementById("loginForm");
    const note = document.getElementById("loginNote");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      note.classList.remove("is-error"); note.textContent = "Signing in…";
      try { await DB.signIn(document.getElementById("lemail").value.trim().toLowerCase(), document.getElementById("lpass").value); }
      catch (err) { note.textContent = err.message || "Sign-in failed."; note.classList.add("is-error"); }
    });
  }

  async function showLiveApp() {
    try {
      const profile = await DB.getProfile(true);
      document.getElementById("loginView").hidden = true;
      document.getElementById("appView").hidden   = false;
      document.getElementById("greeting").textContent = "Welcome, " + profile.name;
      document.getElementById("roleLine").textContent = profile.role === "manager" ? "Fund manager" : "Investor account";
      if (profile.role === "manager") await renderManager();
      else await renderInvestor(profile);
    } catch (err) { showError("Could not load your account: " + err.message); }
  }

  function bindLogout() {
    const btn = document.getElementById("logoutBtn");
    if (btn) btn.addEventListener("click", async () => {
      if (liveMode) await DB.signOut(); else showLogin();
    });
  }

  /* ============================================================
     LIVE MODE — INVESTOR VIEW
     ============================================================ */
  async function renderInvestor(profile) {
    const body = document.getElementById("portalBody");
    body.innerHTML = `<div class="snap__loading">Loading your account…</div>`;
    const [account, latestNav, events, allNav, trades, positions, withdrawals, messages] = await Promise.all([
      DB.getMyAccount(), DB.getLatestNav(), DB.getMyCapitalEvents(),
      DB.getAllNavHistory(), DB.getTrades(60).catch(() => []), DB.getPositions().catch(() => []),
      DB.getMyWithdrawals().catch(() => []), DB.getMyMessages().catch(() => []),
    ]);
    const navPU  = latestNav ? +latestNav.nav_per_unit : null;
    const units  = account ? +account.units : 0;
    const curVal = navPU ? units * navPU : null;
    const totalDep  = events.filter(e => e.type === "deposit").reduce((a,e) => a + +e.amount, 0);
    const totalWith = events.filter(e => e.type === "withdrawal").reduce((a,e) => a + +e.amount, 0);
    const netInv = totalDep - totalWith;
    const gain   = curVal != null ? curVal - netInv : null;
    const retPct = curVal != null && netInv > 0 ? (gain / netInv) * 100 : null;
    const navSeries = allNav.length ? allNav : null;

    body.innerHTML = `
      <div>
        <div class="metricrow reveal">
          <div class="metric"><div class="metric__v">${curVal != null ? F.fmtMoney(curVal,0) : "—"}</div><div class="metric__l">Current value</div></div>
          <div class="metric"><div class="metric__v">${F.fmtMoney(netInv,0)}</div><div class="metric__l">Net invested</div></div>
          <div class="metric"><div class="metric__v ${gain!=null&&gain>=0?"pos":"neg"}">${gain!=null?F.fmtMoney(gain,0):"—"}</div><div class="metric__l">Total gain/loss</div></div>
          <div class="metric"><div class="metric__v ${retPct!=null&&retPct>=0?"pos":"neg"}">${retPct!=null?F.fmtPct(retPct):"—"}</div><div class="metric__l">Total return</div></div>
          <div class="metric"><div class="metric__v mono">${units.toFixed(4)}</div><div class="metric__l">Fund units</div></div>
        </div>
        ${navSeries ? `<div class="panel reveal"><div class="panel__head"><h2>Account value over time</h2></div><canvas id="acctChart" height="280"></canvas></div>` : ""}
        ${riskPanelHtml(account && account.risk_pref ? account.risk_pref : "balanced")}
        ${liveWithdrawPanelHtml(withdrawals)}
        <div class="panel reveal"><div class="panel__head"><h2>Capital events</h2></div>
          ${events.length ? `<div class="table-wrap"><table class="ttable"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Units</th><th>NAV at txn</th><th>Note</th></tr></thead><tbody>${events.map(ev=>`<tr><td class="mono">${ev.date}</td><td><span class="pill ${ev.type==="deposit"?"pill--buy":"pill--sell"}">${ev.type}</span></td><td class="mono">${F.fmtMoney(ev.amount,0)}</td><td class="mono">${ev.units!=null?F.fmtNum(ev.units,4):"—"}</td><td class="mono">${ev.nav_at_txn!=null?F.fmtNum(ev.nav_at_txn,2):"—"}</td><td>${ev.note||""}</td></tr>`).join("")}</tbody></table></div>` : `<p class="portal__note">No capital events yet.</p>`}
        </div>
        ${positionsPanel(positions)}
        ${tradesPanel(trades, {title:"Trade activity", sub:"Executions logged"})}
        ${liveMessagesPanelHtml(messages, "investor")}
        <p class="portal__note">NAV as of ${latestNav?latestNav.date:"—"}: ${navPU?F.fmtNum(navPU,2):"—"} per unit.</p>
      </div>`;

    revealAll();
    if (navSeries && units > 0) {
      const c = document.getElementById("acctChart");
      if (c) F.chart.lineChart(c, {
        labels: navSeries.map(n => n.date.slice(5)),
        series: [{values: navSeries.map(n => units * +n.nav_per_unit), color:"#5eead4", fill:"rgba(94,234,212,0.18)", width:2.4}],
        yFmt: v => "$"+(v/1000).toFixed(0)+"k",
      });
    }
    bindRiskPanel();
    bindLiveWithdraw();
    bindLiveMessages("investor", null);
    DB.markMessagesRead().catch(() => {});
  }

  /* ---------- live withdrawal request panel (investor) ---------- */
  function liveWithdrawPanelHtml(withdrawals) {
    return `
      <div class="panel reveal">
        <div class="panel__head"><h2>Request a withdrawal</h2><span class="panel__sub">Reviewed by the fund manager</span></div>
        <form class="mgr-form" id="liveWdForm">
          <div class="field"><label>Amount ($)</label><input type="number" id="liveWdAmount" min="1" step="0.01" required placeholder="5000" /></div>
          <div class="field field--full"><label>Note (optional)</label><input type="text" id="liveWdNote" placeholder="Reason or instructions" /></div>
          <button type="submit" class="btn btn--ghost btn--sm">Submit request</button>
          <p class="cta__note" id="liveWdMsg" role="status" aria-live="polite"></p>
        </form>
        ${withdrawals.length ? `
        <div class="table-wrap" style="margin-top:14px"><table class="ttable">
          <thead><tr><th>Requested</th><th>Amount</th><th>Note</th><th>Status</th></tr></thead>
          <tbody>${withdrawals.map(w => `
            <tr>
              <td class="mono">${(w.requested_at||"").slice(0,10)}</td>
              <td class="mono">${F.fmtMoney(w.amount,0)}</td>
              <td>${esc(w.note||"")}</td>
              <td><span class="status-pill status-pill--${w.status === "approved" ? "active" : w.status === "pending" ? "pending" : "closed"}">${w.status}</span></td>
            </tr>`).join("")}</tbody></table></div>` : ""}
      </div>`;
  }

  function bindLiveWithdraw() {
    const form = document.getElementById("liveWdForm");
    if (!form) return;
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const msg = document.getElementById("liveWdMsg");
      const amount = parseFloat(document.getElementById("liveWdAmount").value);
      if (!amount || amount <= 0) return;
      try {
        await DB.requestWithdrawal({ amount, note: (document.getElementById("liveWdNote").value||"").trim() });
        msg.classList.remove("is-error");
        msg.textContent = "✓ Request submitted — the manager will review it shortly.";
        form.reset();
      } catch (err) {
        msg.textContent = "Error: " + err.message;
        msg.classList.add("is-error");
      }
    });
  }

  /* ---------- live message center (investor + manager reply) ---------- */
  function dbMsgToBubble(row) {
    return {
      from: row.sender_role === "manager" ? "manager" : "investor",
      fromName: row.sender_role === "manager" ? (CFG.brand.full || "Manager") : (row.profiles && row.profiles.name) || "You",
      subject: row.subject, body: row.body, date: row.created_at,
    };
  }

  function liveMessagesPanelHtml(messages, viewerRole, threadInvestorId) {
    const rows = [...messages].sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    return `
      <div class="panel reveal">
        <div class="panel__head"><h2>Messages</h2><span class="panel__sub">${viewerRole === "investor" ? "Your conversation with " + esc(CFG.brand.full || "the fund") : "Investor thread"}</span></div>
        <div class="msg-thread" id="liveMsgThread">
          ${rows.length ? rows.map(r => msgBubbleHtml(dbMsgToBubble(r), viewerRole)).join("") : `<p class="portal__note">No messages yet — send the first one below.</p>`}
        </div>
        <div class="msg-compose">
          <div class="field"><label for="liveMsgSubject">Subject</label><input id="liveMsgSubject" type="text" placeholder="Question about my account…" /></div>
          <div class="field"><label for="liveMsgBody">Message</label><textarea id="liveMsgBody" rows="3" placeholder="Write your message…"></textarea></div>
          <div class="msg-compose__actions">
            <button class="btn btn--primary btn--sm" id="liveSendBtn" data-thread="${threadInvestorId || ""}">Send</button>
            <span class="cta__note" id="liveMsgNote" role="status" aria-live="polite"></span>
          </div>
        </div>
      </div>`;
  }

  function bindLiveMessages(viewerRole, threadInvestorId) {
    const btn = document.getElementById("liveSendBtn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const note = document.getElementById("liveMsgNote");
      const subject = (document.getElementById("liveMsgSubject").value||"").trim();
      const bodyTxt = (document.getElementById("liveMsgBody").value||"").trim();
      if (!bodyTxt) { note.textContent = "Please enter a message."; note.classList.add("is-error"); return; }
      try {
        const row = await DB.sendMessage({
          investorId: threadInvestorId, senderRole: viewerRole,
          subject, body: bodyTxt,
        });
        const thread = document.getElementById("liveMsgThread");
        if (thread) {
          const d = document.createElement("div");
          d.innerHTML = msgBubbleHtml(dbMsgToBubble(row), viewerRole);
          thread.appendChild(d.firstElementChild);
          thread.scrollTop = thread.scrollHeight;
        }
        document.getElementById("liveMsgSubject").value = "";
        document.getElementById("liveMsgBody").value = "";
        note.classList.remove("is-error");
        note.textContent = "✓ Sent.";
      } catch (err) {
        note.textContent = "Error: " + err.message;
        note.classList.add("is-error");
      }
    });
  }

  /* ============================================================
     LIVE MODE — MANAGER VIEW
     ============================================================ */
  let _liveTab = "dashboard";
  let _liveProfileId = null;

  async function renderManager() {
    const body = document.getElementById("portalBody");
    body.innerHTML = `
      <div class="portal-tabs" role="tablist">
        ${[["dashboard","Dashboard"],["investors","Investors"],["capital","Capital"],["cashflow","Cash Flow"],["trading","Trading"],["messages","Messages"]]
          .map(([k,l]) => `<button class="portal-tab admin-tab ${k===_liveTab?"is-active":""}" data-atab="${k}" role="tab">${l}</button>`).join("")}
      </div>
      <div id="adminTabContent"></div>`;
    revealAll();
    await switchLiveTab(_liveTab);
  }

  async function switchLiveTab(tab) {
    _liveTab = tab;
    document.querySelectorAll(".admin-tab").forEach(b =>
      b.classList.toggle("is-active", b.dataset.atab === tab)
    );
    const el = document.getElementById("adminTabContent");
    if (!el) return;
    el.innerHTML = `<div class="snap__loading">Loading…</div>`;
    try {
      if      (tab === "dashboard") await liveDashboardTab(el);
      else if (tab === "investors") await liveInvestorsTab(el);
      else if (tab === "capital")   await liveCapitalTab(el);
      else if (tab === "cashflow")  await liveCashflowTab(el);
      else if (tab === "trading")   await liveTradingTab(el);
      else if (tab === "messages")  await liveMessagesTab(el);
    } catch (err) {
      el.innerHTML = `<div class="snap__loading">Could not load this tab: ${esc(err.message)}</div>`;
    }
    revealAll();
  }

  /* NAV as of a date from live nav_history rows (latest ≤ date) */
  function liveNavAt(navHistory, ds) {
    let v = null;
    for (const p of navHistory) { if (p.date <= ds) v = +p.nav_per_unit; else break; }
    return v != null ? v : (navHistory.length ? +navHistory[0].nav_per_unit : null);
  }

  const signedUnits = e => (e.units != null ? (e.type === "deposit" ? +e.units : -+e.units) : 0);

  /* ---------- LIVE TAB: Dashboard ---------- */
  async function liveDashboardTab(el) {
    const [investors, latestNav, navHistory, events] = await Promise.all([
      DB.getAllInvestors().catch(()=>[]), DB.getLatestNav().catch(()=>null),
      DB.getAllNavHistory().catch(()=>[]), DB.getAllCapitalEvents().catch(()=>[]),
    ]);
    const navPU = latestNav ? +latestNav.nav_per_unit : null;
    const totalUnits = investors.reduce((a,i) => a + +i.units, 0);
    const aum = navPU != null ? totalUnits * navPU : 0;
    const dep = events.filter(e=>e.type==="deposit").reduce((a,e)=>a + +e.amount, 0);
    const wd  = events.filter(e=>e.type==="withdrawal").reduce((a,e)=>a + +e.amount, 0);
    const netInv = dep - wd;
    const pnl = aum - netInv;
    const active = investors.filter(i => (i.status||"active") === "active").length;
    const recent = events.slice(0, 6);

    el.innerHTML = `
      <div class="metricrow reveal">
        <div class="metric"><div class="metric__v">${F.fmtMoney(aum,0)}</div><div class="metric__l">AUM</div></div>
        <div class="metric"><div class="metric__v">${F.fmtMoney(netInv,0)}</div><div class="metric__l">Net invested</div></div>
        <div class="metric"><div class="metric__v ${pnl>=0?"pos":"neg"}">${pnl>=0?"+":""}${F.fmtMoney(pnl,0)}</div><div class="metric__l">Total P&amp;L</div></div>
        <div class="metric"><div class="metric__v">${active}</div><div class="metric__l">Active investors</div></div>
        <div class="metric"><div class="metric__v mono">${navPU!=null?F.fmtNum(navPU,4):"—"}</div><div class="metric__l">NAV / unit</div></div>
      </div>
      ${mgrNavPanel(navPU != null ? navPU : "", navHistory)}
      ${navHistory.length > 1 ? `
      <div class="panel reveal">
        <div class="panel__head"><h2>Capital timeline</h2><span class="panel__sub">Fund value vs net invested; the gap is P&amp;L</span></div>
        <canvas id="capTimelineLive" height="280" role="img" aria-label="Capital timeline"></canvas>
        <p class="portal__note" style="margin-top:12px">
          AUM ${F.fmtMoney(aum,0)} = deposits ${F.fmtMoney(dep,0)} − withdrawals ${F.fmtMoney(wd,0)}
          + P&amp;L <span class="${pnl>=0?"pos":"neg"}">${pnl>=0?"+":""}${F.fmtMoney(pnl,0)}</span>
        </p>
      </div>` : `<p class="portal__note">The capital timeline chart appears once there are two or more NAV entries.</p>`}
      <div class="panel reveal">
        <div class="panel__head"><h2>Recent capital activity</h2></div>
        ${recent.length ? `<div class="table-wrap"><table class="ttable">
          <thead><tr><th>Date</th><th>Investor</th><th>Type</th><th>Amount</th><th>NAV</th><th>Units</th></tr></thead>
          <tbody>${recent.map(e => `
            <tr>
              <td class="mono">${e.date}</td>
              <td><b>${esc(e.profiles ? e.profiles.name : "—")}</b></td>
              <td><span class="pill ${e.type==="deposit"?"pill--buy":"pill--sell"}">${e.type}</span></td>
              <td class="mono">${F.fmtMoney(+e.amount,0)}</td>
              <td class="mono">${e.nav_at_txn!=null?F.fmtNum(+e.nav_at_txn,4):"—"}</td>
              <td class="mono">${e.units!=null?(e.type==="deposit"?"+":"−")+F.fmtNum(+e.units,4):"—"}</td>
            </tr>`).join("")}</tbody></table></div>` : `<p class="portal__note">No capital events yet — record the first deposit from the Capital tab.</p>`}
      </div>`;

    bindManagerForms(navPU);

    const c = document.getElementById("capTimelineLive");
    if (c && navHistory.length > 1) {
      const asc = [...events].sort((a,b) => a.date.localeCompare(b.date));
      const labels = [], invested = [], value = [];
      navHistory.forEach(p => {
        const upTo = asc.filter(e => e.date <= p.date);
        invested.push(upTo.reduce((a,e) => a + (e.type==="deposit" ? +e.amount : -+e.amount), 0));
        value.push(upTo.reduce((a,e) => a + signedUnits(e), 0) * +p.nav_per_unit);
        labels.push(p.date.slice(5));
      });
      F.chart.lineChart(c, {
        labels,
        series: [
          { values: value,    color:"#5eead4", fill:"rgba(94,234,212,0.14)", width:2.4 },
          { values: invested, color:"#818cf8", width:2 },
        ],
        yFmt: v => "$" + (v/1000).toFixed(1) + "k",
      });
    }
  }

  /* ---------- LIVE TAB: Investors ---------- */
  async function liveInvestorsTab(el) {
    if (_liveProfileId) return liveInvestorProfile(el, _liveProfileId);
    const [profiles, accounts, latestNav, events, leads] = await Promise.all([
      DB.getInvestorProfiles().catch(()=>[]), DB.getAllInvestors().catch(()=>[]),
      DB.getLatestNav().catch(()=>null), DB.getAllCapitalEvents().catch(()=>[]), DB.getLeads().catch(()=>[]),
    ]);
    const navPU = latestNav ? +latestNav.nav_per_unit : null;
    const acctOf = id => accounts.find(a => a.investor_id === id);
    const investedOf = id => events.filter(e => e.investor_id === id)
      .reduce((a,e) => a + (e.type==="deposit" ? +e.amount : -+e.amount), 0);

    el.innerHTML = `
      <div class="panel reveal">
        <div class="panel__head"><h2>Investor accounts</h2><span class="panel__sub">Click a row for the full profile</span></div>
        ${profiles.length ? `<div class="table-wrap"><table class="ttable">
          <thead><tr><th>Investor</th><th>Status</th><th>Units</th><th>Value</th><th>Invested</th><th>Return</th><th>Since</th></tr></thead>
          <tbody>${profiles.map(p => {
            const a = acctOf(p.id);
            const units = a ? +a.units : 0;
            const value = navPU != null ? units * navPU : null;
            const inv = investedOf(p.id);
            const ret = value != null && inv > 0 ? ((value - inv) / inv) * 100 : null;
            return `<tr class="inv-row" data-id="${p.id}">
              <td><b>${esc(p.name)}</b></td>
              <td><span class="status-pill status-pill--${a ? a.status || "active" : "pending"}">${a ? a.status || "active" : "pending"}</span></td>
              <td class="mono">${F.fmtNum(units,4)}</td>
              <td class="mono">${value!=null?F.fmtMoney(value,0):"—"}</td>
              <td class="mono">${F.fmtMoney(inv,0)}</td>
              <td class="mono ${ret!=null&&ret>=0?"pos":ret!=null?"neg":""}">${ret!=null?(ret>=0?"+":"")+ret.toFixed(1)+"%":"—"}</td>
              <td class="mono">${a && a.since ? a.since : "—"}</td>
            </tr>`;
          }).join("")}</tbody></table></div>` : `<p class="portal__note">No investors yet — invite them below.</p>`}
      </div>
      <div class="panel reveal">
        <div class="panel__head"><h2>Add investor</h2></div>
        <p class="portal__note">Invite investors from the Supabase dashboard: <b>Authentication → Users → Invite user</b>. They set their own password from the emailed link and appear here automatically. Record their first deposit from the Capital tab to activate them.</p>
      </div>
      ${mgrLeadsPanel(leads)}`;

    el.querySelectorAll(".inv-row").forEach(r =>
      r.addEventListener("click", () => { _liveProfileId = r.dataset.id; switchLiveTab("investors"); })
    );
  }

  async function liveInvestorProfile(el, id) {
    const [profiles, accounts, latestNav, events] = await Promise.all([
      DB.getInvestorProfiles().catch(()=>[]), DB.getAllInvestors().catch(()=>[]),
      DB.getLatestNav().catch(()=>null), DB.getInvestorCapitalEvents(id).catch(()=>[]),
    ]);
    const p = profiles.find(x => x.id === id);
    const a = accounts.find(x => x.investor_id === id);
    if (!p) { _liveProfileId = null; return liveInvestorsTab(el); }
    const navPU = latestNav ? +latestNav.nav_per_unit : null;
    const units = a ? +a.units : 0;
    const value = navPU != null ? units * navPU : null;
    const inv = events.reduce((acc,e) => acc + (e.type==="deposit" ? +e.amount : -+e.amount), 0);
    const gain = value != null ? value - inv : null;
    const ret = value != null && inv > 0 ? (gain / inv) * 100 : null;
    const status = a ? a.status || "active" : "pending";
    const riskOpt = RISK_OPTIONS.find(r => r.key === (a && a.risk_pref)) || RISK_OPTIONS[1];
    const yearFrac = (Date.now() - new Date(new Date().getFullYear(), 0, 1)) / (365 * 864e5);
    const mgmtFee = inv > 0 && value != null ? 0.02 * ((inv + value) / 2) * yearFrac : 0;
    const perfFee = gain != null ? Math.max(0, gain) * 0.20 : 0;

    el.innerHTML = `
      <button class="btn btn--ghost btn--sm reveal" id="liveBackBtn">&larr; All investors</button>
      <div class="panel reveal" style="margin-top:14px">
        <div class="inv-profile__head">
          <div>
            <h2 style="margin-bottom:4px">${esc(p.name)}</h2>
            <p class="inv-email">${a && a.phone ? esc(a.phone) + " · " : ""}${a && a.since ? "investor since " + a.since : "no deposits yet"} · email in Supabase Auth dashboard</p>
          </div>
          <div class="inv-profile__controls">
            <label class="inv-ctl-label">Status
              <select id="liveProfStatus">
                ${["pending","active","redeeming","closed"].map(s => `<option value="${s}" ${s===status?"selected":""}>${s[0].toUpperCase()+s.slice(1)}</option>`).join("")}
              </select>
            </label>
            <span class="status-pill status-pill--${status}">${status}</span>
          </div>
        </div>
        <div class="metricrow" style="margin-top:18px">
          <div class="metric"><div class="metric__v">${value!=null?F.fmtMoney(value,0):"—"}</div><div class="metric__l">Current value</div></div>
          <div class="metric"><div class="metric__v">${F.fmtMoney(inv,0)}</div><div class="metric__l">Net invested</div></div>
          <div class="metric"><div class="metric__v ${gain!=null&&gain>=0?"pos":"neg"}">${gain!=null?(gain>=0?"+":"")+F.fmtMoney(gain,0):"—"}</div><div class="metric__l">Gain / loss</div></div>
          <div class="metric"><div class="metric__v ${ret!=null&&ret>=0?"pos":"neg"}">${ret!=null?(ret>=0?"+":"")+ret.toFixed(1)+"%":"—"}</div><div class="metric__l">Return</div></div>
          <div class="metric"><div class="metric__v mono">${F.fmtNum(units,4)}</div><div class="metric__l">Units</div></div>
        </div>
        <p class="portal__note" style="margin-top:10px">Risk preference (set by the investor): <b>${riskOpt.label} (${riskOpt.target})</b></p>
      </div>
      <div class="panel reveal">
        <div class="panel__head"><h2>Capital history</h2></div>
        ${events.length ? `<div class="table-wrap"><table class="ttable">
          <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>NAV at txn</th><th>Units</th><th>Note</th></tr></thead>
          <tbody>${events.map(e => `
            <tr>
              <td class="mono">${e.date}</td>
              <td><span class="pill ${e.type==="deposit"?"pill--buy":"pill--sell"}">${e.type}</span></td>
              <td class="mono">${F.fmtMoney(+e.amount,0)}</td>
              <td class="mono">${e.nav_at_txn!=null?F.fmtNum(+e.nav_at_txn,4):"—"}</td>
              <td class="mono">${e.units!=null?(e.type==="deposit"?"+":"−")+F.fmtNum(+e.units,4):"—"}</td>
              <td>${esc(e.note||"")}</td>
            </tr>`).join("")}</tbody></table></div>` : `<p class="portal__note">No capital events yet — record their first deposit from the Capital tab.</p>`}
      </div>
      <div class="panel reveal">
        <div class="panel__head"><h2>Fees (accrued estimate — memo only)</h2><span class="panel__sub">2% management / 20% performance</span></div>
        <div class="fee-grid">
          <div class="fee-item"><span class="fee-item__l">Management fee YTD</span><span class="fee-item__v mono">${F.fmtMoney(mgmtFee,0)}</span></div>
          <div class="fee-item"><span class="fee-item__l">Performance fee accrued</span><span class="fee-item__v mono">${F.fmtMoney(perfFee,0)}</span></div>
          <div class="fee-item"><span class="fee-item__l">High-water mark</span><span class="fee-item__v mono">${value!=null?F.fmtMoney(Math.max(value, inv),0):"—"}</span></div>
        </div>
      </div>
      <div class="panel reveal">
        <div class="panel__head"><h2>Private notes</h2><span class="panel__sub">Only visible to you</span></div>
        <textarea id="liveProfNotes" class="csv-textarea" rows="3">${esc(a && a.mgr_notes || "")}</textarea>
        <div style="margin-top:10px;display:flex;align-items:center;gap:12px">
          <button class="btn btn--ghost btn--sm" id="liveSaveNotesBtn">Save notes</button>
          <span class="cta__note" id="liveNotesNote" role="status" aria-live="polite"></span>
        </div>
      </div>`;

    document.getElementById("liveBackBtn").addEventListener("click", () => {
      _liveProfileId = null; switchLiveTab("investors");
    });
    document.getElementById("liveProfStatus").addEventListener("change", async (e) => {
      try { await DB.updateInvestorMeta({ investorId: id, status: e.target.value }); switchLiveTab("investors"); }
      catch (err) { alert("Could not update status: " + err.message); }
    });
    document.getElementById("liveSaveNotesBtn").addEventListener("click", async () => {
      const note = document.getElementById("liveNotesNote");
      try {
        await DB.updateInvestorMeta({ investorId: id, mgrNotes: document.getElementById("liveProfNotes").value });
        note.classList.remove("is-error"); note.textContent = "✓ Saved.";
      } catch (err) { note.textContent = "Error: " + err.message; note.classList.add("is-error"); }
    });
  }

  /* ---------- LIVE TAB: Capital ---------- */
  async function liveCapitalTab(el) {
    const [profiles, pending, events] = await Promise.all([
      DB.getInvestorProfiles().catch(()=>[]), DB.getPendingWithdrawals().catch(()=>[]),
      DB.getAllCapitalEvents().catch(()=>[]),
    ]);
    el.innerHTML = `
      ${mgrLiveCapitalPanel(profiles)}
      ${mgrLiveQueuePanel(pending)}
      <div class="panel reveal">
        <div class="panel__head"><h2>All capital events</h2></div>
        ${events.length ? `<div class="table-wrap"><table class="ttable">
          <thead><tr><th>Date</th><th>Investor</th><th>Type</th><th>Amount</th><th>NAV</th><th>Units</th><th>Note</th></tr></thead>
          <tbody>${events.map(e => `
            <tr>
              <td class="mono">${e.date}</td>
              <td><b>${esc(e.profiles ? e.profiles.name : "—")}</b></td>
              <td><span class="pill ${e.type==="deposit"?"pill--buy":"pill--sell"}">${e.type}</span></td>
              <td class="mono">${F.fmtMoney(+e.amount,0)}</td>
              <td class="mono">${e.nav_at_txn!=null?F.fmtNum(+e.nav_at_txn,4):"—"}</td>
              <td class="mono">${e.units!=null?(e.type==="deposit"?"+":"−")+F.fmtNum(+e.units,4):"—"}</td>
              <td>${esc(e.note||"")}</td>
            </tr>`).join("")}</tbody></table></div>` : `<p class="portal__note">No capital events yet.</p>`}
      </div>`;
    bindMgrLiveExtras();
  }

  /* ---------- LIVE TAB: Cash Flow ---------- */
  async function liveCashflowTab(el) {
    const [investors, latestNav, navHistory, events, pending, positions] = await Promise.all([
      DB.getAllInvestors().catch(()=>[]), DB.getLatestNav().catch(()=>null),
      DB.getAllNavHistory().catch(()=>[]), DB.getAllCapitalEvents().catch(()=>[]),
      DB.getPendingWithdrawals().catch(()=>[]), DB.getPositions().catch(()=>[]),
    ]);
    const navPU = latestNav ? +latestNav.nav_per_unit : null;
    const aum = navPU != null ? investors.reduce((a,i) => a + +i.units, 0) * navPU : 0;
    const deployed = positions.reduce((a,pos) => a + +pos.qty * +pos.avg_cost, 0);
    const reserved = pending.reduce((a,w) => a + +w.amount, 0);
    const cash = Math.max(0, aum - deployed);
    const deployable = Math.max(0, cash - reserved);
    const rows = liveMonthlyStatement(navHistory, events);
    const tot = rows.reduce((a,r) => ({dep:a.dep+r.dep, wd:a.wd+r.wd, pnl:a.pnl+r.pnl, fee:a.fee+r.fee, net:a.net+r.net}), {dep:0,wd:0,pnl:0,fee:0,net:0});

    el.innerHTML = `
      <div class="metricrow reveal">
        <div class="metric"><div class="metric__v">${F.fmtMoney(cash,0)}</div><div class="metric__l">Cash (est.)</div></div>
        <div class="metric"><div class="metric__v">${F.fmtMoney(deployed,0)}</div><div class="metric__l">Deployed (positions)</div></div>
        <div class="metric"><div class="metric__v">${F.fmtMoney(reserved,0)}</div><div class="metric__l">Reserved (withdrawals)</div></div>
        <div class="metric"><div class="metric__v pos">${F.fmtMoney(deployable,0)}</div><div class="metric__l">Deployable</div></div>
      </div>
      <div class="panel reveal">
        <div class="panel__head"><h2>Monthly cash-flow statement — ${new Date().getFullYear()}</h2>
          <button class="btn btn--ghost btn--sm" id="liveCsvExportBtn">Export CSV</button>
        </div>
        ${rows.length ? `<div class="table-wrap"><table class="ttable">
          <thead><tr><th>Month</th><th>Deposits in</th><th>Withdrawals out</th><th>Trading P&amp;L</th><th>Mgmt fee (memo)</th><th>Net change</th></tr></thead>
          <tbody>${rows.map(r => `
            <tr>
              <td><b>${r.name}</b></td>
              <td class="mono">${r.dep ? F.fmtMoney(r.dep,0) : "—"}</td>
              <td class="mono">${r.wd ? F.fmtMoney(r.wd,0) : "—"}</td>
              <td class="mono ${r.pnl>=0?"pos":"neg"}">${r.pnl>=0?"+":""}${F.fmtMoney(r.pnl,0)}</td>
              <td class="mono">${F.fmtMoney(r.fee,0)}</td>
              <td class="mono ${r.net>=0?"pos":"neg"}">${r.net>=0?"+":""}${F.fmtMoney(r.net,0)}</td>
            </tr>`).join("")}</tbody>
          <tfoot><tr>
            <td><b>Total</b></td>
            <td class="mono"><b>${F.fmtMoney(tot.dep,0)}</b></td>
            <td class="mono"><b>${F.fmtMoney(tot.wd,0)}</b></td>
            <td class="mono ${tot.pnl>=0?"pos":"neg"}"><b>${tot.pnl>=0?"+":""}${F.fmtMoney(tot.pnl,0)}</b></td>
            <td class="mono"><b>${F.fmtMoney(tot.fee,0)}</b></td>
            <td class="mono ${tot.net>=0?"pos":"neg"}"><b>${tot.net>=0?"+":""}${F.fmtMoney(tot.net,0)}</b></td>
          </tr></tfoot>
        </table></div>` : `<p class="portal__note">The statement appears once there is NAV history for this year.</p>`}
        <p class="portal__note" style="margin-top:10px">Trading P&amp;L is derived from NAV changes × units outstanding. Management fee is an accrued memo — NAV is reported gross of fees. "Deployed" uses position cost basis; cash figures are estimates until brokerage cash is tracked directly.</p>
      </div>`;

    const btn = document.getElementById("liveCsvExportBtn");
    if (btn) btn.addEventListener("click", () => {
      const lines = ["Month,Deposits,Withdrawals,Trading P&L,Mgmt fee (memo),Net change"];
      rows.forEach(r => lines.push([r.name, r.dep, r.wd, r.pnl.toFixed(2), r.fee.toFixed(2), r.net.toFixed(2)].join(",")));
      const blob = new Blob([lines.join("\n")], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "bpsquant-cashflow-" + new Date().getFullYear() + ".csv";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  function liveMonthlyStatement(navHistory, events) {
    if (!navHistory.length) return [];
    const now = new Date();
    const year = now.getFullYear();
    const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const latest = +navHistory[navHistory.length - 1].nav_per_unit;
    const asc = [...events].sort((a,b) => a.date.localeCompare(b.date));
    const out = [];
    for (let m = 0; m <= now.getMonth(); m++) {
      const mm = String(m + 1).padStart(2, "0");
      const mStart = `${year}-${mm}-01`;
      const nStart = liveNavAt(navHistory, mStart);
      const nEnd = m < now.getMonth()
        ? liveNavAt(navHistory, `${year}-${String(m + 2).padStart(2, "0")}-01`)
        : latest;
      if (nStart == null || nEnd == null) continue;
      const inMonth = asc.filter(e => e.date.slice(0, 7) === `${year}-${mm}`);
      const unitsStart = asc.filter(e => e.date < mStart).reduce((a,e) => a + signedUnits(e), 0);
      let pnl = unitsStart * (nEnd - nStart);
      inMonth.forEach(e => { pnl += signedUnits(e) * (nEnd - (e.nav_at_txn != null ? +e.nav_at_txn : nStart)); });
      const dep = inMonth.filter(e=>e.type==="deposit").reduce((a,e)=>a + +e.amount, 0);
      const wd  = inMonth.filter(e=>e.type==="withdrawal").reduce((a,e)=>a + +e.amount, 0);
      const unitsEnd = unitsStart + inMonth.reduce((a,e) => a + signedUnits(e), 0);
      out.push({ name: names[m], dep, wd, pnl, fee: (0.02/12) * unitsEnd * nEnd, net: dep - wd + pnl });
    }
    return out;
  }

  /* ---------- LIVE TAB: Trading ---------- */
  async function liveTradingTab(el) {
    const [recentTrades, positions] = await Promise.all([
      DB.getTrades(80).catch(()=>[]), DB.getPositions().catch(()=>[]),
    ]);
    el.innerHTML = `
      ${mgrTradePanel()}
      ${mgrCsvPanel()}
      ${tradesPanel(recentTrades, {title:"Recent trades", sub:"Most recent executions"})}
      ${mgrPositionsPanel(positions)}`;
    bindManagerForms(null);
  }

  /* ---------- LIVE TAB: Messages ---------- */
  async function liveMessagesTab(el) {
    const [allMsgs, profiles] = await Promise.all([
      DB.getAllMessages().catch(()=>[]), DB.getInvestorProfiles().catch(()=>[]),
    ]);
    el.innerHTML = mgrLiveThreadsPanel(allMsgs, profiles);
    bindMgrLiveExtras();
  }

  /* ---------- live: record deposit/withdrawal (atomic, server-side) ---------- */
  function mgrLiveCapitalPanel(profiles) {
    const today = new Date().toISOString().slice(0,10);
    return `
      <div class="panel reveal">
        <div class="panel__head"><h2>Record deposit / withdrawal</h2><span class="panel__sub">Units computed automatically from NAV on the date — one atomic transaction</span></div>
        ${profiles.length ? `
        <form class="mgr-form" id="liveCapForm">
          <div class="field"><label>Investor</label>
            <select name="investorId">${profiles.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select>
          </div>
          <div class="field"><label>Type</label>
            <select name="type"><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option></select>
          </div>
          <div class="field"><label>Amount ($)</label><input type="number" name="amount" min="1" step="0.01" required placeholder="10000" /></div>
          <div class="field"><label>Date</label><input type="date" name="date" value="${today}" required /></div>
          <div class="field field--full"><label>Note</label><input type="text" name="note" placeholder="Optional" /></div>
          <button type="submit" class="btn btn--primary">Save transaction</button>
          <p class="cta__note" id="liveCapNote" role="status" aria-live="polite"></p>
        </form>` : `<p class="portal__note">No investor profiles yet — invite investors from the Supabase dashboard (Authentication → Invite user).</p>`}
      </div>`;
  }

  /* ---------- live: pending withdrawal queue ---------- */
  function mgrLiveQueuePanel(pending) {
    return `
      <div class="panel reveal">
        <div class="panel__head"><h2>Withdrawal requests</h2><span class="panel__sub">Approve executes the redemption at today's NAV</span></div>
        ${pending.length ? pending.map(w => `
          <div class="wd-request">
            <div class="wd-request__info">
              <b>${esc(w.profiles ? w.profiles.name : "—")}</b> requests <b class="mono">${F.fmtMoney(w.amount,0)}</b>
              <div class="inv-email">${(w.requested_at||"").slice(0,10)}${w.note ? " · " + esc(w.note) : ""}</div>
            </div>
            <div class="wd-request__actions">
              <button class="btn btn--primary btn--sm live-wd-approve" data-wid="${w.id}">Approve</button>
              <button class="btn btn--ghost btn--sm live-wd-deny" data-wid="${w.id}">Deny</button>
            </div>
          </div>`).join("") : `<p class="portal__note">No pending requests.</p>`}
        <p class="cta__note" id="liveWdActionNote" role="status" aria-live="polite"></p>
      </div>`;
  }

  /* ---------- live: message threads grouped per investor ---------- */
  function mgrLiveThreadsPanel(allMsgs, profiles) {
    const byInvestor = {};
    allMsgs.forEach(m => { (byInvestor[m.investor_id] = byInvestor[m.investor_id] || []).push(m); });
    const nameOf = id => {
      const p = profiles.find(x => x.id === id);
      if (p) return p.name;
      const m = (byInvestor[id] || []).find(x => x.profiles && x.profiles.name);
      return m ? m.profiles.name : id.slice(0, 8);
    };
    const ids = Object.keys(byInvestor);
    return `
      <div class="panel reveal">
        <div class="panel__head"><h2>Investor messages</h2><span class="panel__sub">One thread per investor</span></div>
        ${ids.length ? ids.map(id => `
          <details class="mgr-details" ${ids.length === 1 ? "open" : ""}>
            <summary>${esc(nameOf(id))} — ${byInvestor[id].length} message${byInvestor[id].length !== 1 ? "s" : ""}</summary>
            <div class="msg-thread" style="margin-top:10px">
              ${byInvestor[id].map(r => msgBubbleHtml(dbMsgToBubble(r), "manager")).join("")}
            </div>
            <div class="msg-compose" style="margin-top:12px">
              <div class="field"><label>Reply</label><textarea class="live-reply-body" rows="2" placeholder="Reply to ${esc(nameOf(id))}…"></textarea></div>
              <div class="msg-compose__actions">
                <button class="btn btn--ghost btn--sm live-reply-btn" data-investor="${id}">Send reply</button>
                <span class="cta__note live-reply-note" role="status"></span>
              </div>
            </div>
          </details>`).join("") : `<p class="portal__note">No investor messages yet.</p>`}
      </div>`;
  }

  function bindMgrLiveExtras() {
    const capForm = document.getElementById("liveCapForm");
    if (capForm) capForm.addEventListener("submit", async e => {
      e.preventDefault();
      const note = document.getElementById("liveCapNote");
      const t = capForm.elements;
      try {
        note.classList.remove("is-error"); note.textContent = "Saving…";
        const row = await DB.recordCapitalEvent({
          investorId: t.investorId.value, type: t.type.value,
          amount: parseFloat(t.amount.value), date: t.date.value,
          note: t.note.value.trim() || null,
        });
        note.textContent = `✓ Booked ${row.type} of ${F.fmtMoney(+row.amount,0)} = ${F.fmtNum(+row.units,4)} units at NAV ${F.fmtNum(+row.nav_at_txn,2)}.`;
        capForm.reset();
      } catch (err) { note.textContent = "Error: " + err.message; note.classList.add("is-error"); }
    });

    document.querySelectorAll(".live-wd-approve, .live-wd-deny").forEach(btn =>
      btn.addEventListener("click", async () => {
        const note = document.getElementById("liveWdActionNote");
        const approve = btn.classList.contains("live-wd-approve");
        btn.disabled = true;
        try {
          await DB.resolveWithdrawal(btn.dataset.wid, approve);
          await switchLiveTab(_liveTab);
        } catch (err) {
          btn.disabled = false;
          if (note) { note.textContent = "Error: " + err.message; note.classList.add("is-error"); }
        }
      })
    );

    document.querySelectorAll(".live-reply-btn").forEach(btn =>
      btn.addEventListener("click", async () => {
        const wrap = btn.closest(".msg-compose");
        const body = wrap.querySelector(".live-reply-body").value.trim();
        const note = wrap.querySelector(".live-reply-note");
        if (!body) { note.textContent = "Enter a reply."; note.classList.add("is-error"); return; }
        try {
          await DB.sendMessage({ investorId: btn.dataset.investor, senderRole: "manager", subject: null, body });
          note.classList.remove("is-error"); note.textContent = "✓ Sent.";
          wrap.querySelector(".live-reply-body").value = "";
          const thread = btn.closest("details").querySelector(".msg-thread");
          if (thread) {
            const d = document.createElement("div");
            d.innerHTML = msgBubbleHtml({ from:"manager", fromName: CFG.brand.full || "Manager", subject:null, body, date: new Date().toISOString() }, "manager");
            thread.appendChild(d.firstElementChild);
            thread.scrollTop = thread.scrollHeight;
          }
        } catch (err) { note.textContent = "Error: " + err.message; note.classList.add("is-error"); }
      })
    );
  }

  /* ============================================================
     DEMO MODE
     ============================================================ */
  function initDemo() {
    document.getElementById("loginView").hidden = false;
    document.getElementById("appView").hidden   = true;

    const banner = document.createElement("div");
    banner.className = "demo-banner";
    banner.innerHTML = `<b>Preview mode</b> — the portal below runs on sample data for demonstration.`;
    document.getElementById("loginView").prepend(banner);

    document.querySelectorAll(".demo-cred").forEach(b =>
      b.addEventListener("click", () => {
        document.getElementById("lemail").value = b.dataset.email;
        document.getElementById("lpass").value  = b.dataset.pass;
      })
    );

    const form = document.getElementById("loginForm");
    const note = document.getElementById("loginNote");
    if (form) form.addEventListener("submit", e => {
      e.preventDefault();
      const email = document.getElementById("lemail").value.trim().toLowerCase();
      const pass  = document.getElementById("lpass").value;
      const user  = (CFG.demoUsers||[]).find(u => u.email.toLowerCase()===email && u.password===pass);
      if (!user) { note.textContent = "Incorrect demo credentials."; note.classList.add("is-error"); return; }
      sessionStorage.setItem("jss_demo_session", JSON.stringify(user));
      showDemoApp(user);
    });

    const existing = (() => { try { return JSON.parse(sessionStorage.getItem("jss_demo_session")); } catch { return null; } })();
    if (existing) showDemoApp(existing);

    document.getElementById("logoutBtn")?.addEventListener("click", () => {
      sessionStorage.removeItem("jss_demo_session"); showLogin();
    });
    bindForgot();
  }

  function showDemoApp(user) {
    document.getElementById("loginView").hidden = true;
    document.getElementById("appView").hidden   = false;
    document.getElementById("greeting").textContent = "Welcome, " + user.name;
    document.getElementById("roleLine").textContent = user.role === "manager" ? "Fund manager (demo)" : "Investor account (demo)";
    const body = document.getElementById("portalBody");
    if (user.role === "manager") { body.innerHTML = demoManagerBody(); revealAll(); switchAdminTab(_adminTab); }
    else { body.innerHTML = demoInvestorShell(user); revealAll(); switchDemoTab("overview", user); }
  }

  /* ============================================================
     DEMO INVESTOR — tabbed shell
     ============================================================ */
  function demoInvestorShell(user) {
    const msgs     = initDemoMsgs();
    const unread   = msgs.filter(m => !m.read && m.from === "manager").length;
    return `
      <div class="demo-banner">Sample account — all figures are illustrative demo data.</div>
      ${tabNav("overview", unread)}
      <div id="tabContent"></div>`;
  }

  function tabNav(active, unread) {
    const badge = unread > 0 ? `<span class="tab-badge">${unread}</span>` : "";
    return `
      <div class="portal-tabs" id="portalTabs" role="tablist">
        <button class="portal-tab ${active==="overview"?"is-active":""}" data-tab="overview" role="tab">Overview</button>
        <button class="portal-tab ${active==="results"?"is-active":""}"  data-tab="results"  role="tab">2026 Results</button>
        <button class="portal-tab ${active==="trades"?"is-active":""}"   data-tab="trades"   role="tab">Trade Details</button>
        <button class="portal-tab ${active==="messages"?"is-active":""}" data-tab="messages" role="tab">Messages${badge}</button>
      </div>`;
  }

  function switchDemoTab(tab, user) {
    _activeTab = tab;
    document.querySelectorAll(".portal-tab").forEach(b =>
      b.classList.toggle("is-active", b.dataset.tab === tab)
    );
    const el = document.getElementById("tabContent");
    if (!el) return;
    if      (tab === "overview")  { el.innerHTML = overviewHtml(user);    drawOverviewCharts(user); bindWithdrawRequest(); }
    else if (tab === "results")   { el.innerHTML = results2026Html();      drawResultsChart(); }
    else if (tab === "trades")    { el.innerHTML = tradesDetailHtml();     bindTradeToggles(); bindTradeFilter(); }
    else if (tab === "messages")  { el.innerHTML = messagesHtml("investor"); bindMsgForm("investor"); markMsgsRead(); }
    revealAll();

    document.querySelectorAll(".portal-tab").forEach(b =>
      b.addEventListener("click", () => switchDemoTab(b.dataset.tab, user), {once:true})
    );
  }

  /* ============================================================
     TAB 1 — OVERVIEW
     ============================================================ */
  function overviewHtml(user) {
    const inv     = user.invested || 25000;
    const curVal  = inv * 1.242;  // 2026 demo growth
    const gain    = curVal - inv;
    const retPct  = (gain / inv) * 100;
    const risk    = localStorage.getItem(DEMO_RISK_KEY) || "balanced";

    const months   = ["Jan","Feb","Mar","Apr","May","Jun"];
    const monthly  = [1270, 200, 620, 1360, 1250, 1350];
    const cumPnl   = monthly.reduce((acc,v,i) => { acc.push((acc[i-1]||0)+v); return acc; }, []);
    const portVals = cumPnl.map(p => inv + p);

    return `
      <div class="metricrow reveal">
        <div class="metric"><div class="metric__v">${F.fmtMoney(curVal,0)}</div><div class="metric__l">Current value</div></div>
        <div class="metric"><div class="metric__v">${F.fmtMoney(inv,0)}</div><div class="metric__l">Invested</div></div>
        <div class="metric"><div class="metric__v pos">${F.fmtMoney(gain,0)}</div><div class="metric__l">Total gain (2026)</div></div>
        <div class="metric"><div class="metric__v pos">+${retPct.toFixed(1)}%</div><div class="metric__l">Total return</div></div>
        <div class="metric"><div class="metric__v pos">+${F.fmtMoney(1350,0)}</div><div class="metric__l">Jun income</div></div>
      </div>

      <div class="panel reveal">
        <div class="panel__head"><h2>Account value — 2026</h2><span class="panel__sub">Monthly NAV × units</span></div>
        <canvas id="acctChart" height="260" role="img" aria-label="Account value"></canvas>
      </div>

      <div class="panel reveal">
        <div class="panel__head"><h2>Monthly income</h2><span class="panel__sub">P&amp;L per month (bar = closed trades)</span></div>
        <canvas id="monthlyMiniChart" height="180" role="img" aria-label="Monthly P&L"></canvas>
      </div>

      ${riskPanelHtml(risk)}

      ${withdrawPanelHtml()}

      <div class="panel reveal">
        <div class="panel__head"><h2>Portfolio holdings</h2><span class="panel__sub">Illustrative allocation</span></div>
        <div class="port-alloc">
          <canvas id="allocChart" width="180" height="180" style="flex-shrink:0"></canvas>
          <div class="port-legend">
            <div class="port-leg"><span class="port-leg__dot" style="background:#5eead4"></span><span>SPY S&P 500 ETF</span><span class="mono">45%</span></div>
            <div class="port-leg"><span class="port-leg__dot" style="background:#818cf8"></span><span>QQQ Nasdaq-100</span><span class="mono">35%</span></div>
            <div class="port-leg"><span class="port-leg__dot" style="background:#fbbf24"></span><span>DIA Dow Jones</span><span class="mono">15%</span></div>
            <div class="port-leg"><span class="port-leg__dot" style="background:#94a3b8"></span><span>Cash &amp; premiums</span><span class="mono">5%</span></div>
          </div>
        </div>
      </div>`;
  }

  function drawOverviewCharts(user) {
    const inv    = user.invested || 25000;
    const months = ["Jan","Feb","Mar","Apr","May","Jun"];
    const cumPnl = [1270,1470,2090,3450,4700,6050];
    const portV  = cumPnl.map(p => inv + p);

    const acct = document.getElementById("acctChart");
    if (acct) F.chart.lineChart(acct, {
      labels: months,
      series: [{values: portV, color:"#5eead4", fill:"rgba(94,234,212,0.15)", width:2.4}],
      yFmt: v => "$"+(v/1000).toFixed(1)+"k",
    });

    const mini = document.getElementById("monthlyMiniChart");
    if (mini) F.chart.barChart(mini, {
      groups: [1270,200,620,1360,1250,1350].map((v,i) => ({
        label: months[i],
        bars: [{value:v, color: v>=0?"#5eead4":"#f87171"}],
      })),
      yFmt: v => "$"+(v/1000).toFixed(1)+"k",
    });

    const alloc = document.getElementById("allocChart");
    if (alloc) F.chart.donut(alloc, [
      {value:45, color:"#5eead4", label:"SPY"},
      {value:35, color:"#818cf8", label:"QQQ"},
      {value:15, color:"#fbbf24", label:"DIA"},
      {value: 5, color:"#94a3b8", label:"Cash"},
    ]);
  }

  /* ============================================================
     RISK PANEL (shared)
     ============================================================ */
  const RISK_OPTIONS = [
    { key:"conservative", icon:"🛡️", label:"Conservative", target:"5–8% / yr",  desc:"Iron condors & covered calls only. Low delta, wide wings." },
    { key:"balanced",     icon:"⚖️", label:"Balanced",     target:"10–15% / yr", desc:"Full strategy suite, moderate position sizing. (Default)" },
    { key:"growth",       icon:"📈", label:"Growth",        target:"18–25% / yr", desc:"Higher theta exposure, tighter spreads, larger contracts." },
    { key:"aggressive",   icon:"🚀", label:"Aggressive",   target:"25%+ / yr",   desc:"Full capital deployment, maximum risk/reward. Volatility expected." },
  ];

  function riskPanelHtml(current) {
    return `
      <div class="panel reveal" id="riskPanel">
        <div class="panel__head"><h2>Portfolio risk preference</h2><span class="panel__sub">Request your risk profile — manager reviews and adjusts</span></div>
        <div class="risk-grid">
          ${RISK_OPTIONS.map(r => `
          <div class="risk-card ${r.key===current?"is-selected":""}" data-risk="${r.key}" role="button" tabindex="0">
            <div class="risk-card__icon">${r.icon}</div>
            <div class="risk-card__level">${r.label}</div>
            <div class="risk-card__target">${r.target}</div>
            <div class="risk-card__desc">${r.desc}</div>
          </div>`).join("")}
        </div>
        <div class="risk-save-bar">
          <button class="btn btn--ghost btn--sm" id="saveRiskBtn">Save preference</button>
          <span class="cta__note" id="riskNote" role="status" aria-live="polite"></span>
        </div>
      </div>`;
  }

  function bindRiskPanel() {
    const panel = document.getElementById("riskPanel");
    if (!panel) return;
    panel.querySelectorAll(".risk-card").forEach(c =>
      c.addEventListener("click", () => {
        panel.querySelectorAll(".risk-card").forEach(x => x.classList.remove("is-selected"));
        c.classList.add("is-selected");
      })
    );
    const saveBtn  = document.getElementById("saveRiskBtn");
    const riskNote = document.getElementById("riskNote");
    if (saveBtn) saveBtn.addEventListener("click", () => {
      const sel = panel.querySelector(".risk-card.is-selected");
      if (!sel) return;
      const key = sel.dataset.risk;
      localStorage.setItem(DEMO_RISK_KEY, key);
      const opt = RISK_OPTIONS.find(r => r.key === key);
      riskNote.textContent = `Preference saved: ${opt.label} (${opt.target}). Manager notified.`;
    });
  }

  /* ============================================================
     WITHDRAWAL REQUEST (investor → manager approval queue)
     ============================================================ */
  const DEMO_INVESTOR_ID = "inv_a"; // demo investor maps to Alex Nguyen

  function withdrawPanelHtml() {
    const d = getAdminData();
    const mine = d.withdrawals.filter(w => w.investorId === DEMO_INVESTOR_ID);
    return `
      <div class="panel reveal">
        <div class="panel__head"><h2>Request a withdrawal</h2><span class="panel__sub">Reviewed by the fund manager, usually within 1 business day</span></div>
        <form class="mgr-form" id="wdReqForm">
          <div class="field"><label>Amount ($)</label><input type="number" id="wdReqAmount" min="100" step="100" required placeholder="5000" /></div>
          <div class="field field--full"><label>Note (optional)</label><input type="text" id="wdReqNote" placeholder="Reason or instructions" /></div>
          <button type="submit" class="btn btn--ghost btn--sm">Submit request</button>
          <p class="cta__note" id="wdReqMsg" role="status" aria-live="polite"></p>
        </form>
        ${mine.length ? `
        <div class="table-wrap" style="margin-top:14px"><table class="ttable">
          <thead><tr><th>Date</th><th>Amount</th><th>Note</th><th>Status</th></tr></thead>
          <tbody>${mine.map(w => `
            <tr>
              <td class="mono">${w.date}</td>
              <td class="mono">${F.fmtMoney(w.amount,0)}</td>
              <td>${esc(w.note||"")}</td>
              <td><span class="status-pill status-pill--${w.status === "approved" ? "active" : w.status === "denied" ? "closed" : "pending"}">${w.status}</span></td>
            </tr>`).join("")}</tbody></table></div>` : ""}
      </div>`;
  }

  function bindWithdrawRequest() {
    const form = document.getElementById("wdReqForm");
    if (!form) return;
    form.addEventListener("submit", e => {
      e.preventDefault();
      const msg = document.getElementById("wdReqMsg");
      const amount = parseFloat(document.getElementById("wdReqAmount").value);
      if (!amount || amount <= 0) return;
      const d = getAdminData();
      const inv = d.investors.find(i => i.id === DEMO_INVESTOR_ID);
      const value = inv ? inv.units * latestNavPU(d) : 0;
      if (amount > value) {
        msg.textContent = "Amount exceeds your account value of " + F.fmtMoney(value,0) + ".";
        msg.classList.add("is-error");
        return;
      }
      d.withdrawals.push({
        id: "w" + Date.now(), investorId: DEMO_INVESTOR_ID,
        date: new Date().toISOString().slice(0,10),
        amount, note: (document.getElementById("wdReqNote").value||"").trim(),
        status: "pending",
      });
      saveAdminData(d);
      msg.classList.remove("is-error");
      msg.textContent = "✓ Request submitted — the manager will review it shortly.";
      form.reset();
    });
  }

  /* ============================================================
     TAB 2 — 2026 RESULTS
     ============================================================ */
  function results2026Html() {
    const trades = DEMO_TRADES.filter(t => t.createdAt.startsWith("2026"));
    const totalPnl   = trades.reduce((a,t) => a+t.pnl, 0);
    const wins       = trades.filter(t => t.pnl > 0).length;
    const winRate    = (wins / trades.length * 100).toFixed(0);
    const bestMonth  = "April";
    const months     = ["Jan","Feb","Mar","Apr","May","Jun"];
    const byMonth    = [0,1,2,3,4,5].map(m =>
      trades.filter(t => new Date(t.createdAt).getMonth() === m).reduce((a,t) => a+t.pnl, 0)
    );
    const maxAbs = Math.max(...byMonth.map(Math.abs), 1);

    return `
      <div class="pnl-hero reveal">
        <div class="pnl-stat"><div class="pnl-stat__v pos">+${F.fmtMoney(totalPnl,0)}</div><div class="pnl-stat__l">Total 2026 P&amp;L</div></div>
        <div class="pnl-stat"><div class="pnl-stat__v">${trades.length}</div><div class="pnl-stat__l">Closed trades</div></div>
        <div class="pnl-stat"><div class="pnl-stat__v pos">${winRate}%</div><div class="pnl-stat__l">Win rate</div></div>
        <div class="pnl-stat"><div class="pnl-stat__v pos">${bestMonth}</div><div class="pnl-stat__l">Best month</div></div>
      </div>

      <div class="panel reveal">
        <div class="panel__head"><h2>Monthly P&amp;L — 2026</h2></div>
        <canvas id="resultsChart" height="200" role="img" aria-label="Monthly P&L chart"></canvas>
      </div>

      <div class="panel reveal">
        <div class="panel__head"><h2>Monthly breakdown</h2></div>
        <div class="monthly-grid">
          ${months.map((m,i) => {
            const v = byMonth[i];
            const pct = Math.abs(v)/maxAbs*100;
            return `
              <div class="monthly-row">
                <span class="monthly-row__lbl">${m}</span>
                <div class="monthly-row__bar-wrap">
                  <div class="monthly-row__bar ${v>=0?"pos":"neg"}" style="width:${pct.toFixed(1)}%"></div>
                </div>
                <span class="monthly-row__val ${v>=0?"pos":"neg"}">${v>=0?"+":""}${F.fmtMoney(v,0)}</span>
              </div>`;
          }).join("")}
        </div>
      </div>

      <div class="panel reveal">
        <div class="panel__head"><h2>Trade log — 2026</h2><span class="panel__sub">Column C (P&amp;L $) drives results; all other columns are context</span></div>
        <div class="table-wrap">
          <table class="ttable">
            <thead><tr><th>Trade name</th><th>Strategy</th><th>Opened</th><th>Expired</th><th>Net credit</th><th>Chance</th><th>P&amp;L $</th><th>Return %</th><th>Status</th></tr></thead>
            <tbody>
              ${trades.map(t => `
              <tr>
                <td><b>${esc(t.name)}</b></td>
                <td><span class="trade-group-badge ${groupClass(t.group)}">${esc(t.group)}</span></td>
                <td class="mono">${t.createdAt}</td>
                <td class="mono">${t.expiration}</td>
                <td class="mono">${F.fmtMoney(t.netCredit,0)}</td>
                <td class="mono">${t.chance}%</td>
                <td class="mono ${t.pnl>=0?"pos":"neg"}"><b>${t.pnl>=0?"+":""}${F.fmtMoney(t.pnl,0)}</b></td>
                <td class="mono ${t.returnPct>=0?"pos":"neg"}">${t.returnPct>=0?"+":""}${t.returnPct.toFixed(1)}%</td>
                <td><span class="pill ${t.status==="open"?"pill--buy":"pill--sell"}">${t.status}</span></td>
              </tr>`).join("")}
            </tbody>
            <tfoot><tr>
              <td colspan="6"><b>Total 2026</b></td>
              <td class="mono pos"><b>+${F.fmtMoney(totalPnl,0)}</b></td>
              <td colspan="2" class="muted">Avg win rate ${winRate}%</td>
            </tr></tfoot>
          </table>
        </div>
      </div>`;
  }

  function drawResultsChart() {
    const c = document.getElementById("resultsChart");
    if (!c) return;
    const months  = ["Jan","Feb","Mar","Apr","May","Jun"];
    const byMonth = [1270, 200, 620, 1360, 1250, 1350];
    F.chart.barChart(c, {
      groups: byMonth.map((v,i) => ({
        label: months[i],
        bars: [{value:v, color: v>=0?"#5eead4":"#f87171"}],
      })),
      yFmt: v => "$"+(v/1000).toFixed(1)+"k",
    });
  }

  /* ============================================================
     TAB 3 — TRADE DETAILS (Excel format)
     ============================================================ */
  function tradesDetailHtml() {
    const groups = ["All", ...new Set(DEMO_TRADES.map(t => t.group))];
    return `
      <div class="trade-filter-chips reveal" id="tradeFilterChips">
        ${groups.map((g,i) => `<button class="trade-chip ${i===0?"is-active":""}" data-filter="${g}">${g}</button>`).join("")}
      </div>
      <div class="trade-cards reveal" id="tradeCardsWrap">
        ${DEMO_TRADES.map(tradeCardHtml).join("")}
      </div>`;
  }

  function tradeCardHtml(t) {
    const pnlClass = t.pnl >= 0 ? "pos" : "neg";
    const pnlSign  = t.pnl >= 0 ? "+" : "";
    return `
      <div class="trade-card" data-id="${t.id}" data-group="${esc(t.group)}">
        <div class="trade-card__head">
          <div class="trade-card__info">
            <span class="trade-group-badge ${groupClass(t.group)}">${esc(t.group)}</span>
            <div class="trade-card__name">${esc(t.name)}</div>
            <div class="trade-card__dates">${t.createdAt} → ${t.expiration} &nbsp;·&nbsp; <span class="pill ${t.status==="open"?"pill--buy":"pill--sell"}">${t.status}</span></div>
          </div>
          <div class="trade-card__pnl ${pnlClass}">
            <span class="trade-card__pnl-val">${pnlSign}${F.fmtMoney(t.pnl,0)}</span>
            <span class="trade-card__pnl-pct">${pnlSign}${t.returnPct.toFixed(1)}%</span>
          </div>
        </div>
        <div class="trade-card__summary">
          <span class="trade-kv"><span class="trade-kv__l">Net Credit</span><span class="trade-kv__v">${F.fmtMoney(t.netCredit,0)}</span></span>
          <span class="trade-kv"><span class="trade-kv__l">Chance</span><span class="trade-kv__v">${t.chance}%</span></span>
          <span class="trade-kv"><span class="trade-kv__l">Max Loss</span><span class="trade-kv__v neg">${t.maxLoss!=null?F.fmtMoney(t.maxLoss,0):"Unlimited"}</span></span>
          <span class="trade-kv"><span class="trade-kv__l">Max Profit</span><span class="trade-kv__v pos">${F.fmtMoney(t.maxProfit,0)}</span></span>
          ${t.high!=null?`<span class="trade-kv"><span class="trade-kv__l">High</span><span class="trade-kv__v">${F.fmtNum(t.high,0)}</span></span>`:""}
          ${t.low!=null ?`<span class="trade-kv"><span class="trade-kv__l">Low</span><span class="trade-kv__v">${F.fmtNum(t.low,0)}</span></span>`:""}
          <span class="trade-kv"><span class="trade-kv__l">IV</span><span class="trade-kv__v">${t.iv.toFixed(1)}%</span></span>
        </div>
        <div class="trade-card__expanders">
          <button class="trade-toggle" data-target="legs-${t.id}">&#9654; Position legs</button>
          <button class="trade-toggle" data-target="greeks-${t.id}">&#9654; Greeks &amp; details</button>
        </div>
        <div class="trade-legs" id="legs-${t.id}" hidden>
          <div class="table-wrap">
            <table class="ttable">
              <thead><tr><th>Symbol</th><th>Qty</th><th>Entry Price</th><th>Current Price</th><th>Close Price</th></tr></thead>
              <tbody>
                ${t.legs.map(leg => `
                <tr>
                  <td><b>${esc(leg.symbol)}</b></td>
                  <td class="mono ${leg.qty<0?"neg":"pos"}">${leg.qty>0?"+":""}${leg.qty}</td>
                  <td class="mono">${F.fmtNum(leg.entry,2)}</td>
                  <td class="mono">${leg.current!=null?F.fmtNum(leg.current,2):"—"}</td>
                  <td class="mono">${leg.close!=null?F.fmtNum(leg.close,2):"—"}</td>
                </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>
        <div class="trade-greeks" id="greeks-${t.id}" hidden>
          <div class="trade-greeks__grid">
            <div class="greek-kv"><span class="greek-kv__l">Δ Delta</span><span class="greek-kv__v">${t.delta.toFixed(3)}</span></div>
            <div class="greek-kv"><span class="greek-kv__l">Θ Theta</span><span class="greek-kv__v">+${t.theta.toFixed(1)}</span></div>
            <div class="greek-kv"><span class="greek-kv__l">Γ Gamma</span><span class="greek-kv__v">${t.gamma.toFixed(3)}</span></div>
            <div class="greek-kv"><span class="greek-kv__l">V Vega</span><span class="greek-kv__v">${t.vega.toFixed(1)}</span></div>
            <div class="greek-kv"><span class="greek-kv__l">ρ Rho</span><span class="greek-kv__v">${t.rho.toFixed(1)}</span></div>
            <div class="greek-kv"><span class="greek-kv__l">IV</span><span class="greek-kv__v">${t.iv.toFixed(1)}%</span></div>
          </div>
          <p class="trade-greeks__note">Theta (+${t.theta.toFixed(1)}) = daily premium decay earned. Delta (${t.delta.toFixed(3)}) = directional exposure. These are for educational context — the final P&amp;L result is shown above.</p>
        </div>
      </div>`;
  }

  function bindTradeToggles() {
    document.querySelectorAll(".trade-toggle").forEach(btn =>
      btn.addEventListener("click", () => {
        const el = document.getElementById(btn.dataset.target);
        if (!el) return;
        const nowOpen = el.hidden;
        el.hidden = !nowOpen;
        btn.classList.toggle("is-open", nowOpen);
        btn.textContent = btn.textContent.replace(/[▶▼►]/,"");
        btn.innerHTML   = (nowOpen ? "&#9660;" : "&#9654;") + " " + btn.textContent.trim();
      })
    );
  }

  function bindTradeFilter() {
    const chips = document.querySelectorAll(".trade-chip");
    const wrap  = document.getElementById("tradeCardsWrap");
    chips.forEach(chip =>
      chip.addEventListener("click", () => {
        chips.forEach(c => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        const f = chip.dataset.filter;
        wrap.querySelectorAll(".trade-card").forEach(card =>
          card.hidden = f !== "All" && card.dataset.group !== f
        );
      })
    );
  }

  function groupClass(group) {
    const map = {
      "Iron Condor":"group--iron-condor",
      "The Wheel":"group--the-wheel",
      "Bull Put Spread":"group--bull-put",
      "Cash-Secured Put":"group--csp",
    };
    return map[group] || "group--iron-condor";
  }

  /* ============================================================
     TAB 4 — MESSAGES
     ============================================================ */
  function messagesHtml(role) {
    const msgs   = initDemoMsgs();
    const sorted = [...msgs].sort((a,b) => new Date(a.date)-new Date(b.date));
    return `
      <div class="msg-center reveal">
        <div class="panel">
          <div class="panel__head"><h2>Messages</h2><span class="panel__sub">Your conversation with BPSQuant</span></div>
          <div class="msg-thread" id="msgThread">
            ${sorted.map(m => msgBubbleHtml(m, role)).join("")}
          </div>
          <div class="msg-compose">
            <div class="field"><label for="msgSubject">Subject</label><input id="msgSubject" type="text" placeholder="Question about my account…" /></div>
            <div class="field"><label for="msgBody">Message</label><textarea id="msgBody" rows="4" placeholder="Write your message here…"></textarea></div>
            <div class="msg-compose__actions">
              <button class="btn btn--primary btn--sm" id="sendMsgBtn">Send message</button>
              <span class="cta__note" id="msgNote" role="status" aria-live="polite"></span>
            </div>
          </div>
        </div>
      </div>`;
  }

  function msgBubbleHtml(m, viewerRole) {
    const isOwn = m.from === viewerRole;
    const cls   = isOwn ? "msg-bubble--investor" : "msg-bubble--manager";
    const ts    = new Date(m.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
    return `
      <div class="msg-bubble ${cls}">
        <div class="msg-bubble__meta">${esc(m.fromName)} · ${ts}</div>
        ${m.subject?`<div class="msg-bubble__subject">${esc(m.subject)}</div>`:""}
        <div>${esc(m.body)}</div>
      </div>`;
  }

  function bindMsgForm(role) {
    const btn  = document.getElementById("sendMsgBtn");
    const note = document.getElementById("msgNote");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const subj = (document.getElementById("msgSubject").value||"").trim();
      const body = (document.getElementById("msgBody").value||"").trim();
      if (!body) { note.textContent = "Please enter a message."; note.classList.add("is-error"); return; }
      const msgs = initDemoMsgs();
      msgs.push({
        id: "m"+Date.now(), from:"investor", fromName:"You",
        subject: subj, body, date: new Date().toISOString(), read:true,
      });
      saveDemoMsgs(msgs);
      const thread = document.getElementById("msgThread");
      if (thread) {
        const div = document.createElement("div");
        div.innerHTML = msgBubbleHtml(msgs[msgs.length-1], "investor");
        thread.appendChild(div.firstElementChild);
        thread.scrollTop = thread.scrollHeight;
      }
      document.getElementById("msgSubject").value = "";
      document.getElementById("msgBody").value    = "";
      note.classList.remove("is-error");
      note.textContent = "Message sent — BPSQuant will reply within 1 business day.";
    });
  }

  function markMsgsRead() {
    const msgs = getDemoMsgs();
    if (!msgs) return;
    msgs.forEach(m => { if (m.from === "manager") m.read = true; });
    saveDemoMsgs(msgs);
    // Clear badge
    document.querySelectorAll(".tab-badge").forEach(b => b.remove());
  }

  /* ============================================================
     ADMIN DATA STORE (demo — localStorage; mirrors Supabase schema)
     ============================================================ */
  const ADMIN_KEY = "jss_admin_v1";

  function adminSeed() {
    return {
      navHistory: [
        { date:"2026-01-01", nav:1000 },
        { date:"2026-02-01", nav:1052 },
        { date:"2026-03-01", nav:1060 },
        { date:"2026-04-01", nav:1086 },
        { date:"2026-05-01", nav:1142 },
        { date:"2026-06-01", nav:1194 },
        { date:"2026-06-28", nav:1242 },
      ],
      investors: [
        { id:"inv_a", name:"Alex Nguyen", email:"alex@example.com", phone:"+1 555-0101",
          status:"active", since:"2026-01-02", units:25, riskPref:"balanced",
          notes:"Referred by family friend. Prefers annual summaries." },
        { id:"inv_b", name:"Bao Tran", email:"bao@example.com", phone:"+1 555-0102",
          status:"active", since:"2026-01-02", units:50, riskPref:"growth",
          notes:"Largest account. Asked about performance fees in May." },
        { id:"inv_c", name:"Chi Le", email:"chi@example.com", phone:"+1 555-0103",
          status:"active", since:"2026-03-02", units:12.5, riskPref:"conservative",
          notes:"Wants capital preservation. Check in quarterly." },
        { id:"inv_d", name:"Dana Pham", email:"dana@example.com", phone:"+1 555-0104",
          status:"pending", since:null, units:0, riskPref:"balanced",
          notes:"Met at investor meetup — waiting on funding decision." },
      ],
      capitalEvents: [
        { id:"e1", investorId:"inv_a", date:"2026-01-02", type:"deposit", amount:25000, nav:1000, units:25 },
        { id:"e2", investorId:"inv_b", date:"2026-01-02", type:"deposit", amount:50000, nav:1000, units:50 },
        { id:"e3", investorId:"inv_c", date:"2026-03-02", type:"deposit", amount:13250, nav:1060, units:12.5 },
      ],
      withdrawals: [
        { id:"w1", investorId:"inv_b", date:"2026-06-25", amount:5000, note:"Partial — home renovation", status:"pending" },
      ],
    };
  }

  function getAdminData() {
    try {
      const d = JSON.parse(localStorage.getItem(ADMIN_KEY));
      if (d && d.investors) return d;
    } catch {}
    const s = adminSeed();
    saveAdminData(s);
    return s;
  }
  function saveAdminData(d) { localStorage.setItem(ADMIN_KEY, JSON.stringify(d)); }

  /* NAV as of a date (latest entry ≤ date; clamps to first/last) */
  function navAt(d, dateStr) {
    let nav = d.navHistory[0].nav;
    for (const p of d.navHistory) { if (p.date <= dateStr) nav = p.nav; else break; }
    return nav;
  }
  function latestNavPU(d) { return d.navHistory[d.navHistory.length - 1].nav; }

  function invDerived(inv, d) {
    const evs  = d.capitalEvents.filter(e => e.investorId === inv.id);
    const dep  = evs.filter(e => e.type === "deposit").reduce((a,e) => a + e.amount, 0);
    const wd   = evs.filter(e => e.type === "withdrawal").reduce((a,e) => a + e.amount, 0);
    const invested = dep - wd;
    const value = inv.units * latestNavPU(d);
    const gain  = value - invested;
    const retPct = invested > 0 ? (gain / invested) * 100 : null;
    return { deposits:dep, withdrawals:wd, invested, value, gain, retPct, events:evs };
  }

  function fundTotals(d) {
    const units = d.investors.reduce((a,i) => a + i.units, 0);
    const aum   = units * latestNavPU(d);
    const dep   = d.capitalEvents.filter(e => e.type === "deposit").reduce((a,e) => a + e.amount, 0);
    const wd    = d.capitalEvents.filter(e => e.type === "withdrawal").reduce((a,e) => a + e.amount, 0);
    return { units, aum, deposits:dep, withdrawals:wd, netInvested:dep - wd, pnl:aum - (dep - wd) };
  }

  /* Collateral tied up by an open trade (max loss, or CSP strike × 100 × qty) */
  function openCollateral(t) {
    if (t.maxLoss != null) return t.maxLoss;
    const leg = t.legs[0];
    const strike = parseFloat((leg.symbol.split(" ")[1] || "0"));
    return strike * 100 * Math.abs(leg.qty);
  }

  /* Monthly cash-flow statement rows computed from NAV history + events */
  function monthlyStatement(d) {
    const months = ["2026-01","2026-02","2026-03","2026-04","2026-05","2026-06"];
    const names  = ["Jan","Feb","Mar","Apr","May","Jun"];
    return months.map((m, i) => {
      const mStart = m + "-01";
      const nStart = navAt(d, mStart);
      const nEnd   = i < 5 ? navAt(d, months[i+1] + "-01") : latestNavPU(d);
      const inMonth = d.capitalEvents.filter(e => e.date.slice(0,7) === m);
      const before  = d.capitalEvents.filter(e => e.date < mStart);
      const unitsStart = before.reduce((a,e) => a + (e.type === "deposit" ? e.units : -e.units), 0);
      let pnl = unitsStart * (nEnd - nStart);
      inMonth.forEach(e => { pnl += (e.type === "deposit" ? e.units : -e.units) * (nEnd - e.nav); });
      const dep = inMonth.filter(e => e.type === "deposit").reduce((a,e) => a + e.amount, 0);
      const wd  = inMonth.filter(e => e.type === "withdrawal").reduce((a,e) => a + e.amount, 0);
      const unitsEnd = unitsStart + inMonth.reduce((a,e) => a + (e.type === "deposit" ? e.units : -e.units), 0);
      const mgmtFee = (0.02 / 12) * unitsEnd * nEnd;
      return { name:names[i], deposits:dep, withdrawals:wd, pnl, mgmtFee, net:dep - wd + pnl };
    });
  }

  /* ============================================================
     ADMIN PORTAL SHELL + TABS
     ============================================================ */
  let _adminTab = "dashboard";

  function demoManagerBody() {
    return `
      <div class="demo-banner">Sample data — changes are stored locally in your browser.</div>
      <div class="portal-tabs" role="tablist">
        ${[["dashboard","Dashboard"],["investors","Investors"],["capital","Capital"],["cashflow","Cash Flow"],["trading","Trading"],["messages","Messages"]]
          .map(([k,l]) => `<button class="portal-tab admin-tab ${k===_adminTab?"is-active":""}" data-atab="${k}" role="tab">${l}</button>`).join("")}
      </div>
      <div id="adminTabContent"></div>`;
  }

  function switchAdminTab(tab) {
    _adminTab = tab;
    document.querySelectorAll(".admin-tab").forEach(b =>
      b.classList.toggle("is-active", b.dataset.atab === tab)
    );
    const el = document.getElementById("adminTabContent");
    if (!el) return;
    if      (tab === "dashboard") { el.innerHTML = adminDashboardHtml(); drawAdminDashboard(); }
    else if (tab === "investors") { el.innerHTML = adminInvestorsHtml(); bindInvestorsTab(); }
    else if (tab === "capital")   { el.innerHTML = adminCapitalHtml();   bindCapitalTab(); }
    else if (tab === "cashflow")  { el.innerHTML = adminCashflowHtml();  drawCashflow(); bindCsvExport(); }
    else if (tab === "trading")   { el.innerHTML = adminTradingHtml();   bindTradeToggles(); }
    else if (tab === "messages")  { el.innerHTML = adminMessagesHtml(); }
    revealAll();
  }

  /* ---------- TAB: Dashboard ---------- */
  function adminDashboardHtml() {
    const d = getAdminData();
    const t = fundTotals(d);
    const active = d.investors.filter(i => i.status === "active").length;
    const recent = [...d.capitalEvents].sort((a,b) => b.date.localeCompare(a.date)).slice(0,5);
    const byId = Object.fromEntries(d.investors.map(i => [i.id, i]));
    return `
      <div class="metricrow reveal">
        <div class="metric"><div class="metric__v">${F.fmtMoney(t.aum,0)}</div><div class="metric__l">AUM</div></div>
        <div class="metric"><div class="metric__v">${F.fmtMoney(t.netInvested,0)}</div><div class="metric__l">Net invested</div></div>
        <div class="metric"><div class="metric__v ${t.pnl>=0?"pos":"neg"}">${t.pnl>=0?"+":""}${F.fmtMoney(t.pnl,0)}</div><div class="metric__l">Total P&amp;L</div></div>
        <div class="metric"><div class="metric__v">${active}</div><div class="metric__l">Active investors</div></div>
        <div class="metric"><div class="metric__v mono">${F.fmtNum(latestNavPU(d),2)}</div><div class="metric__l">NAV / unit</div></div>
      </div>
      <div class="panel reveal">
        <div class="panel__head"><h2>Capital timeline — 2026</h2><span class="panel__sub">Fund value vs net invested; the gap is P&amp;L</span></div>
        <canvas id="capTimeline" height="280" role="img" aria-label="Capital timeline"></canvas>
        <p class="portal__note" style="margin-top:12px">
          AUM ${F.fmtMoney(t.aum,0)} = deposits ${F.fmtMoney(t.deposits,0)}
          − withdrawals ${F.fmtMoney(t.withdrawals,0)}
          + P&amp;L <span class="pos">${t.pnl>=0?"+":""}${F.fmtMoney(t.pnl,0)}</span>
        </p>
      </div>
      <div class="panel reveal">
        <div class="panel__head"><h2>Recent capital activity</h2></div>
        ${recent.length ? `<div class="table-wrap"><table class="ttable">
          <thead><tr><th>Date</th><th>Investor</th><th>Type</th><th>Amount</th><th>NAV</th><th>Units</th></tr></thead>
          <tbody>${recent.map(e => `
            <tr>
              <td class="mono">${e.date}</td>
              <td><b>${esc(byId[e.investorId] ? byId[e.investorId].name : "—")}</b></td>
              <td><span class="pill ${e.type==="deposit"?"pill--buy":"pill--sell"}">${e.type}</span></td>
              <td class="mono">${F.fmtMoney(e.amount,0)}</td>
              <td class="mono">${F.fmtNum(e.nav,0)}</td>
              <td class="mono">${e.type==="deposit"?"+":"−"}${F.fmtNum(e.units,4)}</td>
            </tr>`).join("")}</tbody></table></div>` : `<p class="portal__note">No capital events yet.</p>`}
      </div>`;
  }

  function drawAdminDashboard() {
    const c = document.getElementById("capTimeline");
    if (!c) return;
    const d = getAdminData();
    const labels = [], invested = [], value = [];
    d.navHistory.forEach(p => {
      const evs = d.capitalEvents.filter(e => e.date <= p.date);
      const inv = evs.reduce((a,e) => a + (e.type==="deposit" ? e.amount : -e.amount), 0);
      const un  = evs.reduce((a,e) => a + (e.type==="deposit" ? e.units : -e.units), 0);
      labels.push(p.date.slice(5));
      invested.push(inv);
      value.push(un * p.nav);
    });
    F.chart.lineChart(c, {
      labels,
      series: [
        { values: value,    color:"#5eead4", fill:"rgba(94,234,212,0.14)", width:2.4 },
        { values: invested, color:"#818cf8", width:2 },
      ],
      yFmt: v => "$" + (v/1000).toFixed(0) + "k",
    });
  }

  /* ---------- TAB: Investors ---------- */
  let _profileId = null;

  function adminInvestorsHtml() {
    if (_profileId) return investorProfileHtml(_profileId);
    const d = getAdminData();
    return `
      <div class="panel reveal">
        <div class="panel__head"><h2>Investor accounts</h2><span class="panel__sub">Click a row to open the full profile</span></div>
        <div class="table-wrap"><table class="ttable">
          <thead><tr><th>Investor</th><th>Status</th><th>Units</th><th>Value</th><th>Invested</th><th>Return</th><th>Since</th></tr></thead>
          <tbody>${d.investors.map(inv => {
            const x = invDerived(inv, d);
            return `<tr class="inv-row" data-id="${inv.id}">
              <td><b>${esc(inv.name)}</b><div class="inv-email">${esc(inv.email)}</div></td>
              <td><span class="status-pill status-pill--${inv.status}">${inv.status}</span></td>
              <td class="mono">${F.fmtNum(inv.units,4)}</td>
              <td class="mono">${F.fmtMoney(x.value,0)}</td>
              <td class="mono">${F.fmtMoney(x.invested,0)}</td>
              <td class="mono ${x.retPct!=null&&x.retPct>=0?"pos":x.retPct!=null?"neg":""}">${x.retPct!=null?(x.retPct>=0?"+":"")+x.retPct.toFixed(1)+"%":"—"}</td>
              <td class="mono">${inv.since||"—"}</td>
            </tr>`;
          }).join("")}</tbody>
        </table></div>
      </div>
      <div class="panel reveal">
        <div class="panel__head"><h2>Add investor</h2><span class="panel__sub">Creates a profile with zero units — fund it from the Capital tab</span></div>
        <form class="mgr-form" id="addInvForm">
          <div class="field"><label>Name</label><input type="text" name="name" required placeholder="Full name" /></div>
          <div class="field"><label>Email</label><input type="email" name="email" required placeholder="name@email.com" /></div>
          <div class="field"><label>Phone</label><input type="text" name="phone" placeholder="+1 …" /></div>
          <div class="field"><label>Status</label>
            <select name="status"><option value="pending">Pending</option><option value="active">Active</option></select>
          </div>
          <button type="submit" class="btn btn--primary">Add investor</button>
          <p class="cta__note" id="addInvNote" role="status" aria-live="polite"></p>
        </form>
      </div>`;
  }

  function investorProfileHtml(id) {
    const d = getAdminData();
    const inv = d.investors.find(i => i.id === id);
    if (!inv) { _profileId = null; return adminInvestorsHtml(); }
    const x = invDerived(inv, d);
    const riskOpt = RISK_OPTIONS.find(r => r.key === inv.riskPref);
    const hwm = Math.max(x.value, x.invested);
    const mgmtFee = x.invested > 0 ? 0.02 * ((x.invested + x.value) / 2) * 0.5 : 0;
    const perfFee = Math.max(0, x.gain) * 0.20;
    return `
      <button class="btn btn--ghost btn--sm reveal" id="backToInvestors">&larr; All investors</button>
      <div class="panel reveal" style="margin-top:14px">
        <div class="inv-profile__head">
          <div>
            <h2 style="margin-bottom:4px">${esc(inv.name)}</h2>
            <p class="inv-email">${esc(inv.email)}${inv.phone ? " · " + esc(inv.phone) : ""}${inv.since ? " · investor since " + inv.since : ""}</p>
          </div>
          <div class="inv-profile__controls">
            <label class="inv-ctl-label">Status
              <select id="profStatus">
                ${["pending","active","redeeming","closed"].map(s => `<option value="${s}" ${s===inv.status?"selected":""}>${s[0].toUpperCase()+s.slice(1)}</option>`).join("")}
              </select>
            </label>
            <span class="status-pill status-pill--${inv.status}">${inv.status}</span>
          </div>
        </div>
        <div class="metricrow" style="margin-top:18px">
          <div class="metric"><div class="metric__v">${F.fmtMoney(x.value,0)}</div><div class="metric__l">Current value</div></div>
          <div class="metric"><div class="metric__v">${F.fmtMoney(x.invested,0)}</div><div class="metric__l">Net invested</div></div>
          <div class="metric"><div class="metric__v ${x.gain>=0?"pos":"neg"}">${x.gain>=0?"+":""}${F.fmtMoney(x.gain,0)}</div><div class="metric__l">Gain / loss</div></div>
          <div class="metric"><div class="metric__v ${x.retPct!=null&&x.retPct>=0?"pos":"neg"}">${x.retPct!=null?(x.retPct>=0?"+":"")+x.retPct.toFixed(1)+"%":"—"}</div><div class="metric__l">Return</div></div>
          <div class="metric"><div class="metric__v mono">${F.fmtNum(inv.units,4)}</div><div class="metric__l">Units</div></div>
        </div>
        <p class="portal__note" style="margin-top:10px">Risk preference: <b>${riskOpt ? riskOpt.label + " (" + riskOpt.target + ")" : inv.riskPref}</b></p>
      </div>
      <div class="panel reveal">
        <div class="panel__head"><h2>Capital history</h2></div>
        ${x.events.length ? `<div class="table-wrap"><table class="ttable">
          <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>NAV at txn</th><th>Units</th></tr></thead>
          <tbody>${x.events.map(e => `
            <tr>
              <td class="mono">${e.date}</td>
              <td><span class="pill ${e.type==="deposit"?"pill--buy":"pill--sell"}">${e.type}</span></td>
              <td class="mono">${F.fmtMoney(e.amount,0)}</td>
              <td class="mono">${F.fmtNum(e.nav,2)}</td>
              <td class="mono">${e.type==="deposit"?"+":"−"}${F.fmtNum(e.units,4)}</td>
            </tr>`).join("")}</tbody></table></div>` : `<p class="portal__note">No capital events yet — add a deposit from the Capital tab.</p>`}
      </div>
      <div class="panel reveal">
        <div class="panel__head"><h2>Fees (accrued estimate — memo only)</h2><span class="panel__sub">2% management / 20% performance above high-water mark</span></div>
        <div class="fee-grid">
          <div class="fee-item"><span class="fee-item__l">Management fee YTD</span><span class="fee-item__v mono">${F.fmtMoney(mgmtFee,0)}</span></div>
          <div class="fee-item"><span class="fee-item__l">Performance fee accrued</span><span class="fee-item__v mono">${F.fmtMoney(perfFee,0)}</span></div>
          <div class="fee-item"><span class="fee-item__l">High-water mark</span><span class="fee-item__v mono">${F.fmtMoney(hwm,0)}</span></div>
        </div>
      </div>
      <div class="panel reveal">
        <div class="panel__head"><h2>Private notes</h2><span class="panel__sub">Only visible to you</span></div>
        <textarea id="profNotes" class="csv-textarea" rows="3">${esc(inv.notes||"")}</textarea>
        <div style="margin-top:10px;display:flex;align-items:center;gap:12px">
          <button class="btn btn--ghost btn--sm" id="saveNotesBtn">Save notes</button>
          <span class="cta__note" id="notesNote" role="status" aria-live="polite"></span>
        </div>
      </div>`;
  }

  function bindInvestorsTab() {
    document.querySelectorAll(".inv-row").forEach(r =>
      r.addEventListener("click", () => { _profileId = r.dataset.id; switchAdminTab("investors"); })
    );
    const back = document.getElementById("backToInvestors");
    if (back) back.addEventListener("click", () => { _profileId = null; switchAdminTab("investors"); });

    const addForm = document.getElementById("addInvForm");
    if (addForm) addForm.addEventListener("submit", e => {
      e.preventDefault();
      const d = getAdminData();
      const t = addForm.elements;
      d.investors.push({
        id: "inv_" + Date.now(), name: t.name.value.trim(), email: t.email.value.trim(),
        phone: t.phone.value.trim(), status: t.status.value,
        since: t.status.value === "active" ? new Date().toISOString().slice(0,10) : null,
        units: 0, riskPref: "balanced", notes: "",
      });
      saveAdminData(d);
      switchAdminTab("investors");
    });

    const statusSel = document.getElementById("profStatus");
    if (statusSel) statusSel.addEventListener("change", () => {
      const d = getAdminData();
      const inv = d.investors.find(i => i.id === _profileId);
      if (!inv) return;
      inv.status = statusSel.value;
      if (statusSel.value === "active" && !inv.since) inv.since = new Date().toISOString().slice(0,10);
      saveAdminData(d);
      switchAdminTab("investors");
    });

    const saveNotes = document.getElementById("saveNotesBtn");
    if (saveNotes) saveNotes.addEventListener("click", () => {
      const d = getAdminData();
      const inv = d.investors.find(i => i.id === _profileId);
      if (!inv) return;
      inv.notes = document.getElementById("profNotes").value;
      saveAdminData(d);
      document.getElementById("notesNote").textContent = "✓ Saved.";
    });
  }

  /* ---------- TAB: Capital ---------- */
  function adminCapitalHtml() {
    const d = getAdminData();
    const pending = d.withdrawals.filter(w => w.status === "pending");
    const byId = Object.fromEntries(d.investors.map(i => [i.id, i]));
    const today = new Date().toISOString().slice(0,10);
    const history = [...d.capitalEvents].sort((a,b) => b.date.localeCompare(a.date));
    return `
      <div class="panel reveal">
        <div class="panel__head"><h2>Record deposit / withdrawal</h2><span class="panel__sub">Units are computed automatically from NAV on the transaction date</span></div>
        <form class="mgr-form" id="capForm">
          <div class="field"><label>Investor</label>
            <select name="investorId" id="capInv">
              ${d.investors.filter(i => i.status !== "closed").map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label>Type</label>
            <select name="type" id="capType"><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option></select>
          </div>
          <div class="field"><label>Amount ($)</label><input type="number" name="amount" id="capAmount" min="1" step="0.01" required placeholder="10000" /></div>
          <div class="field"><label>Date</label><input type="date" name="date" id="capDate" value="${today}" required /></div>
          <div class="field field--full">
            <div class="cap-preview" id="capPreview">Enter an amount to preview the unit math.</div>
          </div>
          <button type="submit" class="btn btn--primary">Save transaction</button>
          <p class="cta__note" id="capNote" role="status" aria-live="polite"></p>
        </form>
      </div>
      <div class="panel reveal">
        <div class="panel__head"><h2>Withdrawal requests</h2><span class="panel__sub">Submitted by investors from their portal</span></div>
        ${pending.length ? pending.map(w => {
          const inv = byId[w.investorId];
          const x = inv ? invDerived(inv, getAdminData()) : null;
          return `
          <div class="wd-request" data-wid="${w.id}">
            <div class="wd-request__info">
              <b>${inv ? esc(inv.name) : "—"}</b> requests <b class="mono">${F.fmtMoney(w.amount,0)}</b>
              <div class="inv-email">${w.date}${w.note ? " · " + esc(w.note) : ""}${x ? " · account value " + F.fmtMoney(x.value,0) : ""}</div>
            </div>
            <div class="wd-request__actions">
              <button class="btn btn--primary btn--sm wd-approve" data-wid="${w.id}">Approve</button>
              <button class="btn btn--ghost btn--sm wd-deny" data-wid="${w.id}">Deny</button>
            </div>
          </div>`;
        }).join("") : `<p class="portal__note">No pending requests.</p>`}
        <p class="cta__note" id="wdActionNote" role="status" aria-live="polite"></p>
      </div>
      <div class="panel reveal">
        <div class="panel__head"><h2>All capital events</h2></div>
        ${history.length ? `<div class="table-wrap"><table class="ttable">
          <thead><tr><th>Date</th><th>Investor</th><th>Type</th><th>Amount</th><th>NAV</th><th>Units</th></tr></thead>
          <tbody>${history.map(e => `
            <tr>
              <td class="mono">${e.date}</td>
              <td><b>${byId[e.investorId] ? esc(byId[e.investorId].name) : "—"}</b></td>
              <td><span class="pill ${e.type==="deposit"?"pill--buy":"pill--sell"}">${e.type}</span></td>
              <td class="mono">${F.fmtMoney(e.amount,0)}</td>
              <td class="mono">${F.fmtNum(e.nav,2)}</td>
              <td class="mono">${e.type==="deposit"?"+":"−"}${F.fmtNum(e.units,4)}</td>
            </tr>`).join("")}</tbody></table></div>` : `<p class="portal__note">No capital events yet.</p>`}
      </div>`;
  }

  function bindCapitalTab() {
    const form = document.getElementById("capForm");
    if (!form) return;
    const preview = document.getElementById("capPreview");

    function updatePreview() {
      const d = getAdminData();
      const amount = parseFloat(document.getElementById("capAmount").value);
      const date = document.getElementById("capDate").value;
      const type = document.getElementById("capType").value;
      const invId = document.getElementById("capInv").value;
      if (!amount || amount <= 0 || !date) { preview.textContent = "Enter an amount to preview the unit math."; return; }
      const nav = navAt(d, date);
      const units = amount / nav;
      const inv = d.investors.find(i => i.id === invId);
      const after = inv ? (type === "deposit" ? inv.units + units : inv.units - units) : 0;
      preview.innerHTML =
        `NAV on ${date}: <b class="mono">${F.fmtNum(nav,2)}</b> / unit → ` +
        `${type === "deposit" ? "issues" : "redeems"} <b class="mono">${F.fmtNum(units,4)}</b> units. ` +
        `${inv ? esc(inv.name) + " will hold <b class='mono'>" + F.fmtNum(after,4) + "</b> units after." : ""}` +
        (type === "withdrawal" && after < 0 ? ` <span class="neg"><b>Insufficient units!</b></span>` : "");
    }
    ["capAmount","capDate","capType","capInv"].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.addEventListener("input", updatePreview); el.addEventListener("change", updatePreview); }
    });

    form.addEventListener("submit", e => {
      e.preventDefault();
      const note = document.getElementById("capNote");
      const d = getAdminData();
      const amount = parseFloat(document.getElementById("capAmount").value);
      const date = document.getElementById("capDate").value;
      const type = document.getElementById("capType").value;
      const invId = document.getElementById("capInv").value;
      const inv = d.investors.find(i => i.id === invId);
      if (!inv || !amount || amount <= 0) return;
      const nav = navAt(d, date);
      const units = amount / nav;
      if (type === "withdrawal" && units > inv.units + 1e-9) {
        note.textContent = "Error: withdrawal exceeds " + inv.name + "'s " + F.fmtNum(inv.units,4) + " units.";
        note.classList.add("is-error");
        return;
      }
      d.capitalEvents.push({ id:"e" + Date.now(), investorId:invId, date, type, amount, nav, units:+units.toFixed(6) });
      inv.units = +(type === "deposit" ? inv.units + units : inv.units - units).toFixed(6);
      if (inv.status === "pending" && type === "deposit") { inv.status = "active"; inv.since = date; }
      saveAdminData(d);
      switchAdminTab("capital");
    });

    document.querySelectorAll(".wd-approve").forEach(btn =>
      btn.addEventListener("click", () => {
        const d = getAdminData();
        const w = d.withdrawals.find(x => x.id === btn.dataset.wid);
        if (!w) return;
        const inv = d.investors.find(i => i.id === w.investorId);
        const today = new Date().toISOString().slice(0,10);
        const nav = navAt(d, today);
        const units = w.amount / nav;
        const note = document.getElementById("wdActionNote");
        if (!inv || units > inv.units + 1e-9) {
          if (note) { note.textContent = "Cannot approve: exceeds available units."; note.classList.add("is-error"); }
          return;
        }
        d.capitalEvents.push({ id:"e" + Date.now(), investorId:inv.id, date:today, type:"withdrawal", amount:w.amount, nav, units:+units.toFixed(6) });
        inv.units = +(inv.units - units).toFixed(6);
        w.status = "approved";
        saveAdminData(d);
        switchAdminTab("capital");
      })
    );
    document.querySelectorAll(".wd-deny").forEach(btn =>
      btn.addEventListener("click", () => {
        const d = getAdminData();
        const w = d.withdrawals.find(x => x.id === btn.dataset.wid);
        if (!w) return;
        w.status = "denied";
        saveAdminData(d);
        switchAdminTab("capital");
      })
    );
  }

  /* ---------- TAB: Cash Flow ---------- */
  function adminCashflowHtml() {
    const d = getAdminData();
    const t = fundTotals(d);
    const openTrades = DEMO_TRADES.filter(x => x.status === "open");
    const deployed = openTrades.reduce((a,x) => a + openCollateral(x), 0);
    const reserved = d.withdrawals.filter(w => w.status === "pending").reduce((a,w) => a + w.amount, 0);
    const cash = Math.max(0, t.aum - deployed);
    const deployable = Math.max(0, cash - reserved);
    const rows = monthlyStatement(d);
    const tot = rows.reduce((a,r) => ({deposits:a.deposits+r.deposits, withdrawals:a.withdrawals+r.withdrawals, pnl:a.pnl+r.pnl, mgmtFee:a.mgmtFee+r.mgmtFee, net:a.net+r.net}), {deposits:0,withdrawals:0,pnl:0,mgmtFee:0,net:0});
    return `
      <div class="metricrow reveal">
        <div class="metric"><div class="metric__v">${F.fmtMoney(cash,0)}</div><div class="metric__l">Cash on hand</div></div>
        <div class="metric"><div class="metric__v">${F.fmtMoney(deployed,0)}</div><div class="metric__l">Deployed (collateral)</div></div>
        <div class="metric"><div class="metric__v">${F.fmtMoney(reserved,0)}</div><div class="metric__l">Reserved (withdrawals)</div></div>
        <div class="metric"><div class="metric__v pos">${F.fmtMoney(deployable,0)}</div><div class="metric__l">Deployable capital</div></div>
      </div>
      <div class="panel reveal">
        <div class="panel__head"><h2>Capital allocation</h2></div>
        <div class="port-alloc">
          <canvas id="cashDonut" width="180" height="180" style="flex-shrink:0"></canvas>
          <div class="port-legend">
            <div class="port-leg"><span class="port-leg__dot" style="background:#818cf8"></span><span>Deployed as option collateral</span><span class="mono">${F.fmtMoney(deployed,0)}</span></div>
            <div class="port-leg"><span class="port-leg__dot" style="background:#fbbf24"></span><span>Reserved for withdrawals</span><span class="mono">${F.fmtMoney(reserved,0)}</span></div>
            <div class="port-leg"><span class="port-leg__dot" style="background:#5eead4"></span><span>Free cash (deployable)</span><span class="mono">${F.fmtMoney(deployable,0)}</span></div>
          </div>
        </div>
      </div>
      <div class="panel reveal">
        <div class="panel__head"><h2>Monthly cash-flow statement — 2026</h2>
          <button class="btn btn--ghost btn--sm" id="csvExportBtn">Export CSV</button>
        </div>
        <div class="table-wrap"><table class="ttable" id="cfTable">
          <thead><tr><th>Month</th><th>Deposits in</th><th>Withdrawals out</th><th>Trading P&amp;L</th><th>Mgmt fee (memo)</th><th>Net change</th></tr></thead>
          <tbody>${rows.map(r => `
            <tr>
              <td><b>${r.name}</b></td>
              <td class="mono">${r.deposits ? F.fmtMoney(r.deposits,0) : "—"}</td>
              <td class="mono">${r.withdrawals ? F.fmtMoney(r.withdrawals,0) : "—"}</td>
              <td class="mono ${r.pnl>=0?"pos":"neg"}">${r.pnl>=0?"+":""}${F.fmtMoney(r.pnl,0)}</td>
              <td class="mono">${F.fmtMoney(r.mgmtFee,0)}</td>
              <td class="mono ${r.net>=0?"pos":"neg"}">${r.net>=0?"+":""}${F.fmtMoney(r.net,0)}</td>
            </tr>`).join("")}</tbody>
          <tfoot><tr>
            <td><b>Total</b></td>
            <td class="mono"><b>${F.fmtMoney(tot.deposits,0)}</b></td>
            <td class="mono"><b>${F.fmtMoney(tot.withdrawals,0)}</b></td>
            <td class="mono pos"><b>+${F.fmtMoney(tot.pnl,0)}</b></td>
            <td class="mono"><b>${F.fmtMoney(tot.mgmtFee,0)}</b></td>
            <td class="mono pos"><b>+${F.fmtMoney(tot.net,0)}</b></td>
          </tr></tfoot>
        </table></div>
        <p class="portal__note" style="margin-top:10px">Trading P&amp;L is derived from NAV changes × units outstanding. Management fee is shown as an accrued memo — NAV is currently reported gross of fees.</p>
      </div>
      <div class="panel reveal">
        <div class="panel__head"><h2>Projected obligations</h2><span class="panel__sub">Open positions — worst-case cash needs by expiry</span></div>
        ${openTrades.length ? `<div class="table-wrap"><table class="ttable">
          <thead><tr><th>Position</th><th>Expires</th><th>Collateral / max loss</th><th>Credit held</th><th>Win chance</th></tr></thead>
          <tbody>${openTrades.map(x => `
            <tr>
              <td><b>${esc(x.name)}</b></td>
              <td class="mono">${x.expiration}</td>
              <td class="mono neg">${F.fmtMoney(openCollateral(x),0)}</td>
              <td class="mono pos">+${F.fmtMoney(x.netCredit,0)}</td>
              <td class="mono">${x.chance}%</td>
            </tr>`).join("")}</tbody></table></div>` : `<p class="portal__note">No open positions.</p>`}
      </div>`;
  }

  function drawCashflow() {
    const c = document.getElementById("cashDonut");
    if (!c) return;
    const d = getAdminData();
    const t = fundTotals(d);
    const openTrades = DEMO_TRADES.filter(x => x.status === "open");
    const deployed = openTrades.reduce((a,x) => a + openCollateral(x), 0);
    const reserved = d.withdrawals.filter(w => w.status === "pending").reduce((a,w) => a + w.amount, 0);
    const free = Math.max(0, t.aum - deployed - reserved);
    F.chart.donut(c, [
      { value: deployed, color:"#818cf8", label:"Deployed" },
      { value: reserved, color:"#fbbf24", label:"Reserved" },
      { value: free,     color:"#5eead4", label:"Free" },
    ]);
  }

  function bindCsvExport() {
    const btn = document.getElementById("csvExportBtn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const rows = monthlyStatement(getAdminData());
      const lines = ["Month,Deposits,Withdrawals,Trading P&L,Mgmt fee (memo),Net change"];
      rows.forEach(r => lines.push([r.name, r.deposits, r.withdrawals, r.pnl.toFixed(2), r.mgmtFee.toFixed(2), r.net.toFixed(2)].join(",")));
      const blob = new Blob([lines.join("\n")], { type:"text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "bpsquant-cashflow-2026.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  /* ---------- TAB: Trading ---------- */
  function adminTradingHtml() {
    return `
      <div class="panel reveal">
        <div class="panel__head"><h2>2026 Trade Log</h2><span class="panel__sub">All positions — Column C is final P&amp;L</span></div>
        <div class="trade-cards">${DEMO_TRADES.map(tradeCardHtml).join("")}</div>
      </div>
      ${positionsPanel(demoPositions())}
      ${tradesPanel(demoTradesRaw(), {title:"Recent executions (demo)", sub:"Sample broker fills"})}
      <p class="portal__note">Trade logging and CSV upload are enabled in live mode (Supabase).</p>`;
  }

  /* ---------- TAB: Messages ---------- */
  function adminMessagesHtml() {
    const msgs = initDemoMsgs();
    return `
      <div class="panel reveal">
        <div class="panel__head"><h2>Investor messages</h2></div>
        <div class="msg-thread" id="msgThreadMgr">
          ${[...msgs].sort((a,b)=>new Date(a.date)-new Date(b.date)).map(m=>msgBubbleHtml(m,"manager")).join("")}
        </div>
        <div class="msg-compose" style="margin-top:16px">
          <div class="field"><label for="mgrMsgSubject">Reply subject</label><input id="mgrMsgSubject" type="text" placeholder="RE: …" /></div>
          <div class="field"><label for="mgrMsgBody">Reply</label><textarea id="mgrMsgBody" rows="3" placeholder="Reply to investor…"></textarea></div>
          <div class="msg-compose__actions">
            <button class="btn btn--ghost btn--sm" id="sendMgrMsgBtn">Send reply</button>
            <span class="cta__note" id="mgrMsgNote" role="status"></span>
          </div>
        </div>
      </div>`;
  }

  /* ============================================================
     MANAGER LIVE PANELS
     ============================================================ */
  function mgrNavPanel(navPU, navHistory) {
    return `
      <div class="panel reveal">
        <div class="panel__head"><h2>Update NAV</h2><span class="panel__sub">Set today's NAV per unit</span></div>
        <form class="mgr-form" id="navForm">
          <div class="field"><label>Date</label><input type="date" name="date" value="${new Date().toISOString().slice(0,10)}" required /></div>
          <div class="field"><label>NAV per unit</label><input type="number" name="nav" step="0.0001" min="0" required placeholder="1242.00" value="${navPU||""}" /></div>
          <div class="field"><label>AUM ($, optional)</label><input type="number" name="aum" step="0.01" min="0" /></div>
          <div class="field field--full"><label>Note</label><input type="text" name="note" /></div>
          <button type="submit" class="btn btn--primary">Save NAV</button>
          <p class="cta__note" id="navNote" role="status" aria-live="polite"></p>
        </form>
        ${navHistory.length ? `<div class="table-wrap" style="margin-top:18px"><table class="ttable"><thead><tr><th>Date</th><th>NAV / unit</th><th>AUM</th><th>Note</th></tr></thead><tbody>${navHistory.slice().reverse().slice(0,12).map(n=>`<tr><td class="mono">${n.date}</td><td class="mono">${F.fmtNum(n.nav_per_unit,2)}</td><td class="mono">${n.aum?F.fmtMoney(n.aum,0):"—"}</td><td>${n.note||""}</td></tr>`).join("")}</tbody></table></div>` : ""}
      </div>`;
  }

  function mgrTradePanel() {
    return `
      <div class="panel reveal">
        <div class="panel__head"><h2>Log a trade</h2><span class="panel__sub">Manual entry or paste from broker</span></div>
        <form class="mgr-form" id="tradeForm">
          <div class="field"><label>Symbol</label><select name="symbol">${(CFG.tickers||[]).map(t=>`<option>${t.symbol}</option>`).join("")}</select></div>
          <div class="field"><label>Side</label><select name="side"><option>BUY</option><option>SELL</option></select></div>
          <div class="field"><label>Qty</label><input type="number" name="qty" step="0.0001" min="0.0001" required /></div>
          <div class="field"><label>Price ($)</label><input type="number" name="price" step="0.0001" min="0" required /></div>
          <div class="field"><label>Strategy</label><select name="strategy">${["Iron Condor","The Wheel","Bull Put Spread","Cash-Secured Put","Covered Call","Trend","Momentum","Manual"].map(s=>`<option>${s}</option>`).join("")}</select></div>
          <div class="field"><label>Executed at</label><input type="datetime-local" name="executedAt" /></div>
          <div class="field field--full"><label>Note</label><input type="text" name="note" /></div>
          <button type="submit" class="btn btn--primary">Add trade</button>
          <p class="cta__note" id="tradeNote" role="status" aria-live="polite"></p>
        </form>
      </div>`;
  }

  function mgrCsvPanel() {
    return `
      <div class="panel reveal">
        <div class="panel__head"><h2>Upload trades via CSV</h2></div>
        <p class="portal__note" style="margin-bottom:14px">Required columns: <code class="csv-header-hint">Date,Time,Symbol,Side,Qty,Price,Strategy,Note</code></p>
        <div class="csv-upload">
          <div class="field field--full"><label>Upload CSV</label><input type="file" id="csvFile" accept=".csv,text/csv" class="csv-file-input" /></div>
          <div class="field field--full"><label>Or paste CSV</label><textarea id="csvText" class="csv-textarea" rows="5" placeholder="Date,Time,Symbol,Side,Qty,Price,Strategy,Note&#10;2026-01-06,09:30:00,SPY,SELL,4,2.05,Iron Condor,"></textarea></div>
          <button id="csvParseBtn" class="btn btn--ghost">Preview</button>
          <div id="csvPreview" class="csv-preview" hidden></div>
          <div id="csvActions" hidden>
            <button id="csvConfirmBtn" class="btn btn--primary">Confirm &amp; upload</button>
            <p class="cta__note" id="csvNote" role="status" aria-live="polite"></p>
          </div>
        </div>
      </div>`;
  }

  function mgrPositionsPanel(positions) {
    return `
      <div class="panel reveal">
        <div class="panel__head"><h2>Open positions</h2></div>
        ${positions.length ? `<div class="table-wrap"><table class="ttable"><thead><tr><th>Symbol</th><th>Qty</th><th>Avg cost</th><th>Updated</th></tr></thead><tbody>${positions.map(p=>`<tr><td><b>${p.symbol}</b></td><td class="mono">${F.fmtNum(p.qty,2)}</td><td class="mono">${F.fmtNum(p.avg_cost,2)}</td><td class="mono">${new Date(p.updated_at).toLocaleDateString()}</td></tr>`).join("")}</tbody></table></div>` : `<p class="portal__note">No open positions.</p>`}
        <details class="mgr-details"><summary>Update / add position</summary>
          <form class="mgr-form mgr-form--sm" id="posForm">
            <div class="field"><label>Symbol</label><select name="symbol">${(CFG.tickers||[]).map(t=>`<option>${t.symbol}</option>`).join("")}</select></div>
            <div class="field"><label>Qty</label><input type="number" name="qty" step="0.0001" required /></div>
            <div class="field"><label>Avg cost</label><input type="number" name="avgCost" step="0.0001" required /></div>
            <button type="submit" class="btn btn--ghost btn--sm">Save</button>
            <p class="cta__note" id="posNote" role="status" aria-live="polite"></p>
          </form>
        </details>
      </div>`;
  }

  function mgrLeadsPanel(leads) {
    return `
      <div class="panel reveal">
        <div class="panel__head"><h2>Contact leads</h2><span class="panel__sub">from homepage form</span></div>
        ${leads.length ? `<div class="table-wrap"><table class="ttable"><thead><tr><th>Name</th><th>Email</th><th>Message</th><th>When</th></tr></thead><tbody>${leads.map(l=>`<tr><td>${esc(l.name)}</td><td>${esc(l.email)}</td><td>${esc(l.message||"")}</td><td class="mono">${new Date(l.created_at).toLocaleDateString()}</td></tr>`).join("")}</tbody></table></div>` : `<p class="portal__note">No leads yet.</p>`}
      </div>`;
  }

  /* ============================================================
     MANAGER FORMS (live mode)
     ============================================================ */
  function bindManagerForms(navPU) {
    const navForm = document.getElementById("navForm");
    if (navForm) navForm.addEventListener("submit", async e => {
      e.preventDefault();
      const note = document.getElementById("navNote");
      try {
        await DB.upsertNav({date:navForm.elements.date.value, navPerUnit:parseFloat(navForm.elements.nav.value), aum:navForm.elements.aum.value?parseFloat(navForm.elements.aum.value):null, note:navForm.elements.note.value.trim()||null});
        note.textContent = "✓ NAV saved."; note.classList.remove("is-error");
      } catch(err) { note.textContent = "Error: "+err.message; note.classList.add("is-error"); }
    });

    const tradeForm = document.getElementById("tradeForm");
    if (tradeForm) tradeForm.addEventListener("submit", async e => {
      e.preventDefault();
      const note = document.getElementById("tradeNote");
      try {
        const t = tradeForm.elements;
        await DB.addTrade({symbol:t.symbol.value, side:t.side.value, qty:parseFloat(t.qty.value), price:parseFloat(t.price.value), strategy:t.strategy.value, note:t.note.value.trim()||null, executedAt:t.executedAt.value?new Date(t.executedAt.value).toISOString():null});
        note.textContent = "✓ Trade added."; note.classList.remove("is-error"); tradeForm.reset();
      } catch(err) { note.textContent = "Error: "+err.message; note.classList.add("is-error"); }
    });

    const posForm = document.getElementById("posForm");
    if (posForm) posForm.addEventListener("submit", async e => {
      e.preventDefault();
      const note = document.getElementById("posNote");
      try {
        const t = posForm.elements;
        await DB.upsertPosition({symbol:t.symbol.value, qty:parseFloat(t.qty.value), avgCost:parseFloat(t.avgCost.value)});
        note.textContent = "✓ Position updated."; note.classList.remove("is-error");
      } catch(err) { note.textContent = "Error: "+err.message; note.classList.add("is-error"); }
    });

    let parsedCsvTrades = [];
    const csvFile = document.getElementById("csvFile");
    if (csvFile) csvFile.addEventListener("change", () => {
      const file = csvFile.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => { document.getElementById("csvText").value = ev.target.result; };
      reader.readAsText(file);
    });

    const csvParseBtn = document.getElementById("csvParseBtn");
    if (csvParseBtn) csvParseBtn.addEventListener("click", () => {
      const text = document.getElementById("csvText").value.trim();
      const note = document.getElementById("csvNote");
      const preview = document.getElementById("csvPreview");
      const actions = document.getElementById("csvActions");
      parsedCsvTrades = []; preview.hidden = true; actions.hidden = true;
      if (!text) return;
      const result = parseCsvTrades(text);
      if (result.errors.length) { preview.innerHTML = `<p style="color:var(--red,#f87171);margin:0">${esc(result.errors.join("; "))}</p>`; preview.hidden=false; return; }
      if (!result.trades.length) { preview.innerHTML = `<p style="color:var(--muted);margin:0">No valid rows found.</p>`; preview.hidden=false; return; }
      parsedCsvTrades = result.trades;
      preview.innerHTML = `<p style="margin-bottom:10px;color:var(--muted)">${parsedCsvTrades.length} trade(s) — review before uploading:</p><div class="table-wrap"><table class="ttable"><thead><tr><th>Date/Time</th><th>Symbol</th><th>Side</th><th>Qty</th><th>Price</th><th>Strategy</th></tr></thead><tbody>${parsedCsvTrades.map(t=>`<tr><td class="mono">${esc(t.executedAt.slice(0,16).replace("T"," "))}</td><td><b>${esc(t.symbol)}</b></td><td><span class="pill ${t.side==="BUY"?"pill--buy":"pill--sell"}">${esc(t.side)}</span></td><td class="mono">${t.qty}</td><td class="mono">${F.fmtMoney(t.price)}</td><td>${esc(t.strategy||"—")}</td></tr>`).join("")}</tbody></table></div>`;
      preview.hidden=false; if (note) note.textContent=""; actions.hidden=false;
    });

    const csvConfirmBtn = document.getElementById("csvConfirmBtn");
    if (csvConfirmBtn) csvConfirmBtn.addEventListener("click", async () => {
      const note = document.getElementById("csvNote");
      if (!parsedCsvTrades.length) return;
      csvConfirmBtn.disabled = true;
      note.textContent = "Uploading…"; note.classList.remove("is-error");
      try {
        await DB.bulkAddTrades(parsedCsvTrades);
        note.textContent = `✓ ${parsedCsvTrades.length} trade(s) uploaded.`;
        parsedCsvTrades=[]; document.getElementById("csvText").value="";
        if(csvFile) csvFile.value="";
        document.getElementById("csvPreview").hidden=true;
        document.getElementById("csvActions").hidden=true;
      } catch(err) { note.textContent="Error: "+err.message; note.classList.add("is-error"); }
      finally { csvConfirmBtn.disabled=false; }
    });
  }

  /* ============================================================
     SHARED HELPERS
     ============================================================ */
  function showError(msg) {
    const body = document.getElementById("portalBody");
    if (body) body.innerHTML = `<div class="snap__loading">${esc(msg)}</div>`;
    document.getElementById("loginView").hidden = true;
    document.getElementById("appView").hidden   = false;
  }

  function revealAll() {
    requestAnimationFrame(() => document.querySelectorAll(".reveal").forEach(e => e.classList.add("is-visible")));
  }

  function esc(s) {
    return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function normaliseTrade(raw) {
    return {
      t: new Date(raw.executed_at || raw.created_at),
      sym: raw.symbol, side: (raw.side||"").toUpperCase(),
      qty: +raw.qty, px: +raw.price, strat: raw.strategy||"—",
    };
  }

  function tradesPanel(trades, opts) {
    opts = opts||{};
    const rows = (trades||[]).map(normaliseTrade);
    return `
      <div class="panel reveal">
        <div class="panel__head"><h2>${esc(opts.title||"Trade activity")}</h2>${opts.sub?`<span class="panel__sub">${esc(opts.sub)}</span>`:""}</div>
        ${rows.length ? `<div class="table-wrap"><table class="ttable"><thead><tr><th>Date</th><th>Ticker</th><th>Side</th><th>Qty</th><th>Price</th><th>Strategy</th></tr></thead><tbody>${rows.map(t=>`<tr><td class="mono">${t.t.toLocaleDateString()} ${t.t.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</td><td><b>${esc(t.sym)}</b></td><td><span class="pill ${t.side==="BUY"?"pill--buy":"pill--sell"}">${esc(t.side)}</span></td><td class="mono">${F.fmtNum(t.qty,0)}</td><td class="mono">${F.fmtMoney(t.px)}</td><td>${esc(t.strat)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="portal__note">No trades recorded yet.</p>`}
      </div>`;
  }

  function positionsPanel(positions) {
    const list = positions||[];
    return `
      <div class="panel reveal">
        <div class="panel__head"><h2>Open positions</h2></div>
        ${list.length ? `<div class="table-wrap"><table class="ttable"><thead><tr><th>Symbol</th><th>Qty</th><th>Avg cost</th></tr></thead><tbody>${list.map(p=>`<tr><td><b>${esc(p.symbol)}</b></td><td class="mono">${F.fmtNum(p.qty,0)}</td><td class="mono">${F.fmtNum(p.avg_cost,2)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="portal__note">No open positions.</p>`}
      </div>`;
  }

  function demoTradesRaw() {
    const syms = ["SPY","QQQ","DIA"];
    const strat = ["Iron Condor","The Wheel","Bull Put Spread","Cash-Secured Put"];
    const px = {SPY:560, QQQ:470, DIA:408};
    return Array.from({length:8},(_,i) => {
      const s = syms[i%3];
      return {executed_at:new Date(Date.now()-i*86400000*1.4).toISOString(), symbol:s, side:i%2?"SELL":"BUY", qty:Math.round(50+i*30), price:px[s]*(1+(i%2?-1:1)*0.005), strategy:strat[i%strat.length]};
    });
  }

  function demoPositions() {
    return [
      {symbol:"SPY", qty:400, avg_cost:545.8},
      {symbol:"QQQ", qty:275, avg_cost:470.9},
      {symbol:"DIA", qty:200, avg_cost:402.6},
    ];
  }

  function parseCsvTrades(text) {
    const lines  = text.split("\n").map(l=>l.trim()).filter(Boolean);
    const errors = [], trades = [];
    if (!lines.length) { errors.push("Empty input"); return {trades,errors}; }
    const rawHeader = lines[0].split(",").map(h=>h.trim().toLowerCase());
    const EXPECTED  = ["date","time","symbol","side","qty","price"];
    const missing   = EXPECTED.filter(h=>!rawHeader.includes(h));
    if (missing.length) { errors.push("Missing columns: "+missing.join(", ")); return {trades,errors}; }
    const idx = name => rawHeader.indexOf(name);
    for (let i=1;i<lines.length;i++) {
      const cols     = lines[i].split(",").map(c=>c.trim());
      const date     = cols[idx("date")]||"";
      const time     = cols[idx("time")]||"00:00:00";
      const symbol   = (cols[idx("symbol")]||"").toUpperCase();
      const side     = (cols[idx("side")]||"").toUpperCase();
      const qtyRaw   = cols[idx("qty")]||"";
      const priceRaw = cols[idx("price")]||"";
      const strategy = idx("strategy")>=0?(cols[idx("strategy")]||""):"";
      const note     = idx("note")>=0?(cols[idx("note")]||""):"";
      if (!date||!symbol||!side||!qtyRaw||!priceRaw) { errors.push(`Row ${i+1}: missing required field`); continue; }
      if (!["BUY","SELL"].includes(side)) { errors.push(`Row ${i+1}: Side must be BUY or SELL`); continue; }
      const qty=parseFloat(qtyRaw), price=parseFloat(priceRaw);
      if (isNaN(qty)||qty<=0) { errors.push(`Row ${i+1}: invalid Qty`); continue; }
      if (isNaN(price)||price<=0) { errors.push(`Row ${i+1}: invalid Price`); continue; }
      const executedAt = new Date(`${date}T${time}`).toISOString();
      if (executedAt==="Invalid Date") { errors.push(`Row ${i+1}: invalid date`); continue; }
      trades.push({symbol,side,qty,price,strategy:strategy||null,note:note||null,executedAt,status:"filled"});
    }
    return {trades,errors};
  }

  /* bind tab clicks after any render */
  document.addEventListener("click", e => {
    const btn = e.target.closest(".portal-tab");
    if (!btn || !btn.dataset.tab) return;
    const session = (() => { try { return JSON.parse(sessionStorage.getItem("jss_demo_session")); } catch { return null; } })();
    if (session && session.role === "investor") switchDemoTab(btn.dataset.tab, session);
  });

  /* admin tab clicks (manager role) — live vs demo routing */
  document.addEventListener("click", e => {
    const btn = e.target.closest(".admin-tab");
    if (!btn || !btn.dataset.atab) return;
    if (liveMode) { _liveProfileId = null; switchLiveTab(btn.dataset.atab); }
    else { _profileId = null; switchAdminTab(btn.dataset.atab); }
  });

  /* bind risk panel via delegation */
  document.addEventListener("click", e => {
    const card = e.target.closest(".risk-card");
    if (!card) return;
    document.querySelectorAll(".risk-card").forEach(c => c.classList.remove("is-selected"));
    card.classList.add("is-selected");
  });
  document.addEventListener("click", e => {
    if (e.target.id !== "saveRiskBtn") return;
    const sel  = document.querySelector(".risk-card.is-selected");
    const note = document.getElementById("riskNote");
    if (!sel||!note) return;
    const opt = RISK_OPTIONS.find(r=>r.key===sel.dataset.risk);
    if (liveMode) {
      note.textContent = "Saving…";
      DB.setMyRiskPref(sel.dataset.risk)
        .then(() => { note.classList.remove("is-error"); note.textContent = `Saved: ${opt.label} (${opt.target}) — manager notified.`; })
        .catch(err => { note.textContent = "Error: " + err.message; note.classList.add("is-error"); });
    } else {
      localStorage.setItem(DEMO_RISK_KEY, sel.dataset.risk);
      note.textContent = `Saved: ${opt.label} (${opt.target}) — manager notified.`;
    }
  });

  /* Manager reply button */
  document.addEventListener("click", e => {
    if (e.target.id !== "sendMgrMsgBtn") return;
    const subj = (document.getElementById("mgrMsgSubject")?.value||"").trim();
    const body = (document.getElementById("mgrMsgBody")?.value||"").trim();
    const note = document.getElementById("mgrMsgNote");
    if (!body) { if(note){note.textContent="Enter a reply.";note.classList.add("is-error");} return; }
    const msgs = initDemoMsgs();
    msgs.push({id:"m"+Date.now(),from:"manager",fromName:"BPSQuant",subject:subj,body,date:new Date().toISOString(),read:false});
    saveDemoMsgs(msgs);
    const thread = document.getElementById("msgThreadMgr");
    if (thread) {
      const d=document.createElement("div");
      d.innerHTML=msgBubbleHtml(msgs[msgs.length-1],"manager");
      thread.appendChild(d.firstElementChild);
      thread.scrollTop=thread.scrollHeight;
    }
    if(document.getElementById("mgrMsgSubject"))document.getElementById("mgrMsgSubject").value="";
    if(document.getElementById("mgrMsgBody"))document.getElementById("mgrMsgBody").value="";
    if(note){note.classList.remove("is-error");note.textContent="Reply sent.";}
  });
})();
