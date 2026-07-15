/* ============================================================
   BPSQuant — Operations console (hidden page)
   Two locks:
     1. Supabase manager sign-in — the REAL security boundary.
        Row Level Security rejects writes from any other account,
        so bypassing the passcode gains nothing.
     2. Master passcode — a second gate. Only its SHA-256 hash
        lives in this file; the passcode itself is never stored.
   ============================================================ */
(function () {
  "use strict";
  const F  = window.JSS;
  const DB = window.JSSDB;

  /* SHA-256 of the master passcode (see: ask Claude to rotate it) */
  const PASS_HASH = "1682444aefbc8e479be607128b0d78d3a4934dd720d371f132382c1fc0522fc5";
  const GATE_KEY  = "bpsq_ops_ok";

  let investors = [];
  let selectedId = null;
  let selEvents = [];

  const $ = (id) => document.getElementById(id);
  const esc = (s) => (s == null ? "" : String(s)).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

  async function sha256(s) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!DB || !DB.init()) {
      $("opsFatal").textContent = "Live database is not configured — this console requires Supabase.";
      return;
    }
    $("opsLoginForm").addEventListener("submit", onLogin);
    $("opsGateForm").addEventListener("submit", onGate);
    $("opsLockBtn").addEventListener("click", () => {
      sessionStorage.removeItem(GATE_KEY);
      location.reload();
    });
    try {
      const session = await DB.getSession();
      if (session) await afterAuth(); else show("opsLogin");
    } catch { show("opsLogin"); }
  });

  function show(id) {
    ["opsLogin", "opsGate", "opsConsole"].forEach(x => { $(x).hidden = x !== id; });
  }

  async function onLogin(e) {
    e.preventDefault();
    const note = $("opsLoginNote");
    note.classList.remove("is-error"); note.textContent = "Signing in…";
    try {
      await DB.signIn($("opsEmail").value.trim().toLowerCase(), $("opsPass").value);
      note.textContent = "";
      await afterAuth();
    } catch (err) {
      note.textContent = err.message || "Sign-in failed.";
      note.classList.add("is-error");
    }
  }

  async function afterAuth() {
    let profile = null;
    try { profile = await DB.getProfile(true); } catch {}
    if (!profile || profile.role !== "manager") {
      show("opsLogin");
      const note = $("opsLoginNote");
      note.textContent = "This console is restricted to the fund manager account.";
      note.classList.add("is-error");
      try { await DB.signOut(); } catch {}
      return;
    }
    if (sessionStorage.getItem(GATE_KEY) === "1") return openConsole();
    show("opsGate");
  }

  async function onGate(e) {
    e.preventDefault();
    const note = $("opsGateNote");
    const hash = await sha256($("opsCode").value);
    if (hash === PASS_HASH) {
      sessionStorage.setItem(GATE_KEY, "1");
      note.textContent = "";
      openConsole();
    } else {
      note.textContent = "Incorrect passcode.";
      note.classList.add("is-error");
    }
  }

  /* ============================================================
     CONSOLE
     ============================================================ */
  async function openConsole() {
    show("opsConsole");
    investors = await DB.getInvestorProfiles().catch(() => []);
    const sel = $("opsInvestorSel");
    sel.innerHTML = `<option value="">— choose —</option>` +
      investors.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
    sel.addEventListener("change", () => loadInvestor(sel.value));
    $("opsProfileForm").addEventListener("submit", saveProfile);
    await loadTrades();
    await loadPositions();
  }

  async function loadInvestor(id) {
    selectedId = id || null;
    $("opsInvestorSections").hidden = !selectedId;
    if (!selectedId) return;
    const [accounts, events] = await Promise.all([
      DB.getAllInvestors().catch(() => []),
      DB.getInvestorCapitalEvents(selectedId).catch(() => []),
    ]);
    const p = investors.find(x => x.id === selectedId);
    const a = accounts.find(x => x.investor_id === selectedId);
    selEvents = events;

    const f = $("opsProfileForm").elements;
    f.name.value   = p ? p.name : "";
    f.phone.value  = a && a.phone ? a.phone : "";
    f.status.value = a && a.status ? a.status : "pending";
    f.risk.value   = a && a.risk_pref ? a.risk_pref : "balanced";
    f.notes.value  = a && a.mgr_notes ? a.mgr_notes : "";

    renderUnitsBox(a, events);
    renderEventsBox(events);
  }

  async function saveProfile(e) {
    e.preventDefault();
    const note = $("opsProfileNote");
    const f = $("opsProfileForm").elements;
    try {
      note.classList.remove("is-error"); note.textContent = "Saving…";
      await DB.updateProfileName(selectedId, f.name.value.trim());
      await DB.updateInvestorMeta({
        investorId: selectedId, status: f.status.value, riskPref: f.risk.value,
        phone: f.phone.value.trim(), mgrNotes: f.notes.value,
      });
      note.textContent = "✓ Saved.";
      investors = await DB.getInvestorProfiles().catch(() => investors);
    } catch (err) { note.textContent = "Error: " + err.message; note.classList.add("is-error"); }
  }

  /* ---------- units / ledger reconciliation ---------- */
  function ledgerUnits(events) {
    return events.reduce((s, e) => s + (e.units != null ? (e.type === "deposit" ? +e.units : -+e.units) : 0), 0);
  }

  function renderUnitsBox(account, events) {
    const stored = account ? +account.units : 0;
    const ledger = ledgerUnits(events);
    const match = Math.abs(stored - ledger) < 1e-6;
    $("opsUnitsBox").innerHTML = `
      <div class="fee-grid">
        <div class="fee-item"><span class="fee-item__l">Stored units</span><span class="fee-item__v mono">${stored.toFixed(6)}</span></div>
        <div class="fee-item"><span class="fee-item__l">Ledger total</span><span class="fee-item__v mono">${ledger.toFixed(6)}</span></div>
        <div class="fee-item"><span class="fee-item__l">Check</span><span class="fee-item__v ${match ? "pos" : "neg"}">${match ? "✓ In sync" : "✕ Mismatch"}</span></div>
      </div>
      <div class="mgr-form" style="margin-top:14px">
        ${match ? "" : `<button class="btn btn--primary btn--sm" id="opsReconcileBtn">Set stored units to ledger total (${ledger.toFixed(6)})</button>`}
        <div class="field"><label>Or set stored units manually</label><input type="number" id="opsUnitsManual" step="0.000001" min="0" value="${stored.toFixed(6)}" /></div>
        <button class="btn btn--ghost btn--sm" id="opsUnitsSetBtn">Set units</button>
        <p class="cta__note" id="opsUnitsNote" role="status" aria-live="polite"></p>
      </div>`;
    const rec = $("opsReconcileBtn");
    if (rec) rec.addEventListener("click", () => setUnits(ledger));
    $("opsUnitsSetBtn").addEventListener("click", () => setUnits(parseFloat($("opsUnitsManual").value)));
  }

  async function setUnits(units) {
    const note = $("opsUnitsNote");
    if (isNaN(units) || units < 0) { note.textContent = "Invalid units."; note.classList.add("is-error"); return; }
    try {
      await DB.setInvestorUnits(selectedId, +units.toFixed(6));
      await loadInvestor(selectedId);
    } catch (err) { note.textContent = "Error: " + err.message; note.classList.add("is-error"); }
  }

  /* ---------- capital events editor ---------- */
  function renderEventsBox(events) {
    if (!events.length) {
      $("opsEventsBox").innerHTML = `<p class="portal__note">No capital events for this investor.</p>`;
      return;
    }
    $("opsEventsBox").innerHTML = `
      <div class="table-wrap"><table class="ttable">
        <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Units</th><th>NAV</th><th>Note</th><th></th></tr></thead>
        <tbody>
          ${events.map(ev => `
          <tr data-eid="${ev.id}">
            <td><input type="date" class="ops-cell" data-f="date" value="${ev.date}" /></td>
            <td><select class="ops-cell" data-f="type">
              <option value="deposit" ${ev.type==="deposit"?"selected":""}>deposit</option>
              <option value="withdrawal" ${ev.type==="withdrawal"?"selected":""}>withdrawal</option>
            </select></td>
            <td><input type="number" class="ops-cell mono" data-f="amount" step="0.01" value="${+ev.amount}" /></td>
            <td><input type="number" class="ops-cell mono" data-f="units" step="0.000001" value="${ev.units!=null?+ev.units:""}" /></td>
            <td><input type="number" class="ops-cell mono" data-f="nav" step="0.0001" value="${ev.nav_at_txn!=null?+ev.nav_at_txn:""}" /></td>
            <td><input type="text" class="ops-cell" data-f="note" value="${esc(ev.note||"")}" /></td>
            <td style="white-space:nowrap">
              <button class="btn btn--ghost btn--sm ops-ev-save" data-eid="${ev.id}">Save</button>
              <button class="btn btn--ghost btn--sm ops-ev-del" data-eid="${ev.id}">Delete</button>
            </td>
          </tr>`).join("")}
        </tbody>
      </table></div>
      <p class="cta__note" id="opsEventsNote" role="status" aria-live="polite"></p>`;

    document.querySelectorAll(".ops-ev-save").forEach(btn =>
      btn.addEventListener("click", async () => {
        const note = $("opsEventsNote");
        const row = btn.closest("tr");
        const get = f => row.querySelector(`.ops-cell[data-f="${f}"]`).value;
        try {
          await DB.updateCapitalEvent(btn.dataset.eid, {
            date: get("date"), type: get("type"),
            amount: parseFloat(get("amount")),
            units: get("units") !== "" ? parseFloat(get("units")) : null,
            navAtTxn: get("nav") !== "" ? parseFloat(get("nav")) : null,
            note: get("note").trim() || null,
          });
          note.classList.remove("is-error");
          note.textContent = "✓ Event saved — check the units reconciliation above.";
          await loadInvestor(selectedId);
        } catch (err) { note.textContent = "Error: " + err.message; note.classList.add("is-error"); }
      })
    );
    document.querySelectorAll(".ops-ev-del").forEach(btn =>
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this capital event? Units are NOT adjusted automatically — reconcile after.")) return;
        const note = $("opsEventsNote");
        try {
          await DB.deleteCapitalEvent(btn.dataset.eid);
          await loadInvestor(selectedId);
        } catch (err) { note.textContent = "Error: " + err.message; note.classList.add("is-error"); }
      })
    );
  }

  /* ---------- trades ---------- */
  async function loadTrades() {
    const trades = await DB.getTrades(50).catch(() => []);
    $("opsTradesBox").innerHTML = trades.length ? `
      <div class="table-wrap"><table class="ttable">
        <thead><tr><th>Executed</th><th>Symbol</th><th>Side</th><th>Qty</th><th>Price</th><th>Strategy</th><th></th></tr></thead>
        <tbody>${trades.map(t => `
          <tr>
            <td class="mono">${new Date(t.executed_at).toLocaleString()}</td>
            <td><b>${esc(t.symbol)}</b></td>
            <td><span class="pill ${t.side==="BUY"?"pill--buy":"pill--sell"}">${esc(t.side)}</span></td>
            <td class="mono">${F.fmtNum(+t.qty,0)}</td>
            <td class="mono">${F.fmtMoney(+t.price)}</td>
            <td>${esc(t.strategy||"—")}</td>
            <td><button class="btn btn--ghost btn--sm ops-trade-del" data-id="${t.id}">Delete</button></td>
          </tr>`).join("")}</tbody>
      </table></div>
      <p class="cta__note" id="opsTradesNote" role="status" aria-live="polite"></p>`
      : `<p class="portal__note">No trades logged.</p>`;
    document.querySelectorAll(".ops-trade-del").forEach(btn =>
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this trade permanently?")) return;
        const note = $("opsTradesNote");
        try { await DB.deleteTrade(btn.dataset.id); await loadTrades(); }
        catch (err) { if (note) { note.textContent = "Error: " + err.message; note.classList.add("is-error"); } }
      })
    );
  }

  /* ---------- positions ---------- */
  async function loadPositions() {
    const positions = await DB.getPositions().catch(() => []);
    $("opsPositionsBox").innerHTML = `
      ${positions.length ? `
      <div class="table-wrap"><table class="ttable">
        <thead><tr><th>Symbol</th><th>Qty</th><th>Avg cost</th><th></th></tr></thead>
        <tbody>${positions.map(p => `
          <tr>
            <td><b>${esc(p.symbol)}</b></td>
            <td class="mono">${F.fmtNum(+p.qty,2)}</td>
            <td class="mono">${F.fmtNum(+p.avg_cost,2)}</td>
            <td><button class="btn btn--ghost btn--sm ops-pos-del" data-symbol="${esc(p.symbol)}">Delete</button></td>
          </tr>`).join("")}</tbody>
      </table></div>` : `<p class="portal__note">No open positions.</p>`}
      <form class="mgr-form mgr-form--sm" id="opsPosForm" style="margin-top:14px">
        <div class="field"><label>Symbol</label><input type="text" name="symbol" required placeholder="SPY" /></div>
        <div class="field"><label>Qty</label><input type="number" name="qty" step="0.0001" required /></div>
        <div class="field"><label>Avg cost</label><input type="number" name="avgCost" step="0.0001" required /></div>
        <button type="submit" class="btn btn--ghost btn--sm">Add / update</button>
        <p class="cta__note" id="opsPosNote" role="status" aria-live="polite"></p>
      </form>`;
    document.querySelectorAll(".ops-pos-del").forEach(btn =>
      btn.addEventListener("click", async () => {
        if (!confirm(`Delete position ${btn.dataset.symbol}?`)) return;
        try { await DB.deletePosition(btn.dataset.symbol); await loadPositions(); }
        catch (err) { alert("Error: " + err.message); }
      })
    );
    $("opsPosForm").addEventListener("submit", async e => {
      e.preventDefault();
      const note = $("opsPosNote");
      const f = e.target.elements;
      try {
        await DB.upsertPosition({ symbol: f.symbol.value.trim().toUpperCase(), qty: parseFloat(f.qty.value), avgCost: parseFloat(f.avgCost.value) });
        await loadPositions();
      } catch (err) { note.textContent = "Error: " + err.message; note.classList.add("is-error"); }
    });
  }
})();
