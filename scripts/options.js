/* ============================================================
   BPSQuant — Options Lab (interface)

   The arithmetic lives in optionsmath.js and is tested there. This file
   only draws and listens. The whole page is rebuilt from `state` when the
   language changes, so nothing is stored in the DOM that is not in `state`.
   ============================================================ */
(function () {
  "use strict";
  const O = window.JSSOptions;
  const NO_I18N = { t: (k) => k, lang: "en", other: () => "en", set() {}, onChange() {} };
  const I = new Proxy({}, {
    get(_, p) { const live = window.JSSI18N || NO_I18N; const v = live[p]; return typeof v === "function" ? v.bind(live) : v; },
  });
  const t = (k, v) => I.t(k, v);
  const root = document.getElementById("optApp");
  if (!root || !O) return;

  /* Starting points only. They are placeholders to be overwritten with the
     broker's quote, which the page says in so many words. */
  const SYMBOLS = {
    SPY: { spot: 600, iv: 0.16, q: 0.012 },
    QQQ: { spot: 520, iv: 0.22, q: 0.006 },
    DIA: { spot: 440, iv: 0.16, q: 0.017 },
    CUSTOM: { spot: 100, iv: 0.25, q: 0 },
  };
  const STRATEGIES = Object.keys(O.TEMPLATES);

  const state = {
    symbol: "SPY", spot: SYMBOLS.SPY.spot, iv: SYMBOLS.SPY.iv, r: 0.04, q: SYMBOLS.SPY.q,
    days: 35, width: 6, offset: 12, strategy: "iron_condor",
    legs: [], elapsed: 0, ivShift: 0, rangePct: 20,
    chain: null, expiry: null, target: null, loading: false, label: null, pnl: "$",
    farDays: 70, farExp: null, chainExp: null, optScope: "one",
  };
  let spotBase = 0;                  // the price slider is centred here, and does not move while dragging
  let spotTouched = false;
  let optResults = [];
  const SAVE_KEY = "bps_opt_saved";
  const readSaved = () => { try { const v = JSON.parse(localStorage.getItem(SAVE_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
  const writeSaved = (v) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(v)); } catch (_) { /* private mode */ } };
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- helpers ---------- */
  const num = (v, d) => { const n = parseFloat(v); return isFinite(n) ? n : d; };
  const round2 = (x) => Math.round(x * 100) / 100;
  const usd = (v, d) => {
    if (v === Infinity) return t("opt.unlimited");
    if (v === -Infinity) return "−" + t("opt.unlimited");
    const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
    return (v < -0.005 ? "−$" : "$") + s;
  };
  const sgn = (v) => (v > 0.005 ? "+" : "");
  const dateIn = (n) => {
    const d = new Date(); d.setDate(d.getDate() + n);
    return d.toLocaleDateString(I.lang === "vi" ? "vi-VN" : "en-GB", { day: "numeric", month: "short" });
  };

  const $ = (id) => document.getElementById(id);
  const stepOf = () => (state.spot < 30 ? 0.5 : 1);
  const snapK = (x) => O.roundStrike(x, state.spot);
  /* A slider with a number box beside it. `id` is the box, `id`+"R" the slider. */
  function pick(id, label, o) {
    return `<div class="opt-pick opt-pick--full">
      <span>${label}: <b id="${id}V"></b></span>
      <div class="opt-pick__row">
        <input id="${id}R" type="range" min="${o.min}" max="${o.max}" step="${o.step}" value="${o.value}" aria-label="${label}" />
        <input id="${id}" type="number" min="${o.nmin ?? o.min}" ${o.nmax != null ? `max="${o.nmax}"` : ""} step="${o.step}" value="${o.value}" inputmode="decimal" aria-label="${label}" />
      </div></div>`;
  }

  function defaultWidth() { return Math.max(1, Math.round(state.spot / 100)); }
  /* Short strikes sit about 3/4 of an expected move from the price. */
  function defaultOffset() { return Math.max(1, Math.round(0.75 * state.spot * state.iv * Math.sqrt(state.days / 365))); }
  function resetDistances() { state.width = defaultWidth(); state.offset = defaultOffset(); }

  /* Auto-priced legs track the model whenever an input changes; a leg whose
     price the user has typed keeps it. */
  function repriceAuto() {
    state.legs.forEach((l) => {
      if (!l.auto) return;
      if (l.type === "stock") { l.premium = round2(state.spot); l.iv = 0; return; }
      l.premium = round2(O.price(l.type, state.spot, l.strike, (l.dte || state.days) / 365, state.iv, state.r, state.q));
      l.iv = state.iv;
    });
  }

  /* ---------- live chain ----------
     With a chain loaded, option legs take the market midpoint for the
     selected expiry and the quoted volatility; their strikes snap to strikes
     that exist. A leg whose price the visitor types stops being a market leg. */
  const expData = () => (state.chain && state.expiry ? state.chain.chain[state.expiry] : null);
  /* Every option leg has its own expiry: `dte` days, and with a chain loaded
     `exp`, the listed expiry date it sits on. */
  const legData = (l) => (state.chain && l.exp ? state.chain.chain[l.exp] : null);
  const expInfo = (date) => (state.chain ? state.chain.expiries.find((x) => x.date === date) : null);
  function setLegExp(l, date) { const e = expInfo(date); if (e) { l.exp = e.date; l.dte = Math.max(1, Math.round(e.days)); } return l; }
  /* A new leg starts on the page's current expiry. */
  function stamp(l) { if (l.type !== "stock") { l.dte = state.days; if (state.expiry) l.exp = state.expiry; } return l; }
  const isCalendar = (n) => O.isMultiExpiry(n);   // calendars, diagonals, double calendar
  /* The later expiry a calendar's long leg sits on. */
  function farInfo() {
    if (!state.chain) return null;
    const ex = state.chain.expiries, near = expInfo(state.expiry);
    const later = ex.filter((e) => near && e.days > near.days + 0.5);
    if (!later.length) return null;
    return later.find((e) => e.date === state.farExp) || later.reduce((b, e) => (Math.abs(e.days - state.days * 2) < Math.abs(b.days - state.days * 2) ? e : b), later[0]);
  }
  function marketize(l) {
    const e = l.exp ? legData(l) : expData();
    if (!e || l.type === "stock") { if (l.type === "stock") { l.premium = round2(state.spot); l.iv = 0; } return false; }
    const k = O.nearestStrike(e.strikes, l.strike || state.spot), q = e[l.type][k];
    l.strike = k;
    if (!q || !(q.mid > 0)) return false;
    l.premium = q.mid; l.iv = q.iv > 0 ? q.iv : state.iv; l.auto = false; l.mkt = true;
    return true;
  }
  function pickExpiry(target) {
    const ex = state.chain.expiries;
    return ex.reduce((b, e) => (Math.abs(e.days - target) < Math.abs(b.days - target) ? e : b), ex[0]).date;
  }
  function setExpiry(date) {
    const e = state.chain.expiries.find((x) => x.date === date) || state.chain.expiries[0];
    state.expiry = e.date; state.chainExp = null;
    state.days = Math.max(1, Math.round(e.days));
    state.elapsed = Math.min(state.elapsed, state.days);
    const iv = O.atmIv(expData(), state.spot); if (iv) state.iv = round2(iv * 10000) / 10000;
  }
  // The time this page loaded the chain. Cboe's own timestamp has no stated
  // time zone, so it is not shown; the quotes are about 15 minutes older.
  const asOfText = () => {
    const a = state.chain && state.chain.fetchedAt;
    return a ? new Date(a).toLocaleTimeString(I.lang === "vi" ? "vi-VN" : "en-US", { hour: "numeric", minute: "2-digit" }) : "—";
  };

  /* The volatility each leg is repriced with: the global one for model-priced
     legs, or whatever the typed price implies. */
  function effectiveLegs() {
    return state.legs.map((l) => {
      const T = (l.dte || state.days) / 365;
      let iv = state.iv;
      if (l.type === "stock") iv = 0;
      else if (l.mkt && l.iv > 0) iv = l.iv;
      else if (!l.auto) {
        const imp = O.impliedVol(l.type, l.premium, state.spot, l.strike, T, state.r, state.q);
        if (imp) iv = imp;
      }
      return { type: l.type, side: l.side, strike: l.strike, qty: l.qty, premium: l.premium, iv, dte: l.type === "stock" ? undefined : (l.dte || state.days) };
    });
  }

  function build(name) {
    state.strategy = name; state.label = null;
    // A calendar sells the near expiry and buys a later one. When the selected
    // expiry is the last one listed there is nothing later, so it becomes the
    // long leg and the short leg moves to an earlier expiry.
    let cal = null;
    if (isCalendar(name) && state.chain) {
      const cur = expInfo(state.expiry), far = farInfo();
      if (far) cal = { near: cur, far };
      else {
        const earlier = state.chain.expiries.filter((e) => e.days < cur.days - 0.5);
        if (earlier.length) cal = { near: earlier.reduce((b, e) => (Math.abs(e.days - cur.days / 2) < Math.abs(b.days - cur.days / 2) ? e : b), earlier[0]), far: cur };
      }
    }
    const nearDays = cal ? Math.max(1, Math.round(cal.near.days)) : state.days;
    const farDays = cal ? Math.max(1, Math.round(cal.far.days)) : state.farDays;
    state.legs = O.buildTemplate(name, state.spot, state.width, state.iv, nearDays, state.r, state.q, state.offset, farDays);
    if (state.chain) {
      state.legs.forEach((l) => {
        if (l.type === "stock") return;
        if (cal) setLegExp(l, l.dte === farDays ? cal.far.date : cal.near.date); else stamp(l);
      });
    }                                          // without a chain the template already carries each leg's days
    if (state.chain) state.legs.forEach(marketize);
  }

  /* ---------- page text ---------- */
  function setHero() {
    const set = (id, k) => { const e = document.getElementById(id); if (e) e.textContent = t(k); };
    set("optEyebrow", "opt.eyebrow"); set("optTitle", "opt.title"); set("optLede", "opt.lede");
    document.title = t("nav.options") + " — BPSQuant";
  }

  /* ---------- static layout, built from state ---------- */
  function layout() {
    if (!(spotBase > 0) || state.spot < spotBase * 0.7 || state.spot > spotBase * 1.3) spotBase = state.spot;
    const sym = (s) => `<option value="${s}" ${state.symbol === s ? "selected" : ""}>${s === "CUSTOM" ? "—" : s}</option>`;
    root.innerHTML = `
      <aside class="opt__side">
        <div class="panel">
          <div class="panel__head"><h2>${t("opt.under")}</h2></div>
          <div class="opt-fields">
            <label class="field"><span>${t("opt.symbol")}</span>
              <select id="oSymbol">${Object.keys(SYMBOLS).map(sym).join("")}</select></label>
            ${pick("oSpot", t("opt.spot"), { min: Math.min(Math.max(0.5, snapK(spotBase * 0.7)), state.spot), max: Math.max(snapK(spotBase * 1.3), state.spot), step: stepOf(), value: state.spot, nmin: 0.01 })}
            ${pick("oIv", t("opt.iv"), { min: 5, max: 120, step: 0.5, value: round2(state.iv * 100), nmin: 1, nmax: 300 })}
            ${state.chain ? `<label class="field"><span>${t("opt.expiry")}</span>
              <select id="oExpiry">${state.chain.expiries.map(e => `<option value="${esc(e.date)}" ${e.date === state.expiry ? "selected" : ""}>${esc(expLabel(e))}</option>`).join("")}</select></label>`
            : pick("oDays", t("opt.days"), { min: 1, max: 365, step: 1, value: state.days, nmax: 1000 })}
            <label class="field"><span>${t("opt.rate")}</span>
              <input id="oRate" type="number" step="0.05" min="0" max="25" value="${round2(state.r * 100)}" inputmode="decimal" /></label>
            <label class="field"><span>${t("opt.div")}</span>
              <input id="oDiv" type="number" step="0.05" min="0" max="25" value="${round2(state.q * 100)}" inputmode="decimal" /></label>
          </div>
          <p class="portal__note opt-src" id="oSrc" style="margin:8px 0 0">${srcText()}</p>
        </div>

        <div class="panel">
          <div class="panel__head"><h2>${t("opt.strategy")}</h2></div>
          <label class="field"><span class="sr-only">${t("opt.strategy")}</span>
            <select id="oStrategy">${STRATEGIES.map(s => `<option value="${s}" ${state.strategy === s ? "selected" : ""}>${t("opt.s." + s)}</option>`).join("")}</select></label>
          <div class="opt-fields" style="margin-top:12px">
            ${pick("oWidth", t("opt.width"), { min: 1, max: Math.max(5, Math.round(state.spot * 0.15)), step: 1, value: state.width, nmin: 1 })}
            ${pick("oOffset", t("opt.offset"), { min: 1, max: Math.max(5, Math.round(state.spot * 0.2)), step: 1, value: state.offset, nmin: 1 })}
          </div>
          ${isCalendar(state.strategy) ? `<div class="opt-fields" style="margin-top:12px">${state.chain
            ? `<label class="field opt-pick--full"><span>${t("opt.farExp")}</span><select id="oFar">${state.chain.expiries.filter((e) => e.days > (expInfo(state.expiry) || { days: 0 }).days + 0.5).map((e) => `<option value="${esc(e.date)}" ${farInfo() && e.date === farInfo().date ? "selected" : ""}>${esc(expLabel(e))}</option>`).join("")}</select></label>`
            : pick("oFar", t("opt.farDays"), { min: 2, max: 365, step: 1, value: Math.max(state.farDays, state.days + 1), nmax: 1000 })}</div>` : ""}
          <div class="opt-row opt-row--end"><button class="btn btn--primary btn--sm" id="oBuild" type="button">${t("opt.build")}</button></div>
        </div>

        <div class="panel">
          <div class="panel__head"><h2>${t("opt.legs")}</h2></div>
          <div id="oLegs"></div>
          <div class="opt-row opt-row--end">
            <button class="btn btn--ghost btn--sm" id="oAdd" type="button">${t("opt.addLeg")}</button>
            <button class="btn btn--ghost btn--sm" id="oReprice" type="button">${t("opt.reprice")}</button>
            <button class="btn btn--ghost btn--sm" id="oClear" type="button">${t("opt.clear")}</button>
            <button class="btn btn--ghost btn--sm" id="oSave" type="button">${t("opt.save")}</button>
          </div>
          <p class="portal__note" style="margin:10px 0 0">${state.chain ? t("opt.marketNote") : t("opt.modelNote")}</p>
        </div>

        <div class="panel">
          <div class="panel__head"><h2>${t("opt.saved.title")}</h2></div>
          <div id="oSaved"></div>
        </div>
      </aside>

      <div class="opt__main">
        <div class="inc-cards" id="oStats"></div>

        <div class="panel">
          <div class="panel__head"><h2>${t("opt.chart.title")}</h2>
            <span class="opt-legend"><i class="opt-key opt-key--exp"></i><span id="oExpLbl">${t("opt.atExpiry")}</span>
              <i class="opt-key opt-key--now"></i>${t("opt.onDate")}<span id="oLegendX"></span></span></div>
          <div class="opt-chart" id="oChartWrap">
            <svg id="oChart" role="img" aria-label="${t("opt.chart.aria")}" preserveAspectRatio="xMidYMid meet"></svg>
            <div class="opt-tip" id="oTip" hidden></div>
          </div>
          <p class="opt-note" id="oMixed" hidden>${t("opt.mixed")}</p>
          <div class="opt-sliders">
            <label class="opt-slider"><span>${t("opt.date")}: <b id="oDateLbl"></b></span>
              <input id="oElapsed" type="range" min="0" max="${state.days}" step="1" value="${state.elapsed}" /></label>
            <label class="opt-slider"><span>${t("opt.ivChange")}: <b id="oIvLbl"></b></span>
              <input id="oIvShift" type="range" min="-30" max="30" step="1" value="${state.ivShift}" /></label>
            <label class="opt-slider"><span>${t("opt.range")}: <b id="oRangeLbl"></b></span>
              <input id="oRange" type="range" min="5" max="60" step="1" value="${state.rangePct}" /></label>
          </div>
        </div>

        <div class="panel">
          <div class="panel__head"><h2>${t("opt.greeks")}</h2><span class="panel__sub">${t("opt.greeksSub")}</span></div>
          <div class="inc-cards" id="oGreeks"></div>
        </div>

        <div class="panel">
          <div class="panel__head"><h2>${t("opt.heat.title")}</h2>
            <span class="opt-seg" role="group" aria-label="${t("opt.heat.title")}">
              <button type="button" data-pnl="$" class="${state.pnl === "$" ? "is-on" : ""}">${t("opt.pnlUsd")}</button>
              <button type="button" data-pnl="%" class="${state.pnl === "%" ? "is-on" : ""}">${t("opt.pnlPct")}</button></span></div>
          <p class="opt-note" style="margin:0 0 10px">${t("opt.pnlSub")}</p>
          <div class="table-wrap" id="oHeat"></div>
        </div>

        ${state.chain ? `<div class="panel">
          <div class="panel__head"><h2>${t("opt.chain.title")}</h2><span class="panel__sub">${t("opt.chain.sub")}</span></div>
          <div class="opt-chips" id="oChips"></div>
          <div class="table-wrap" id="oChain"></div>
        </div>

        <div class="panel">
          <div class="panel__head"><h2>${t("opt.term.title")}</h2><span class="panel__sub">${t("opt.term.sub")}</span></div>
          <div class="table-wrap" id="oTerm"></div>
        </div>

        <div class="panel">
          <div class="panel__head"><h2>${t("opt.optim.title")}</h2><span class="panel__sub">${t("opt.optim.sub")}</span></div>
          <div class="opt-row">
            ${pick("oTarget", t("opt.optim.target"), { min: Math.max(0.5, snapK(state.spot * 0.8)), max: snapK(state.spot * 1.2), step: stepOf(), value: state.target || snapK(state.spot * 1.03), nmin: 0.01 })}
            <label class="field"><span>${t("opt.optim.scope")}</span>
              <select id="oScope"><option value="one" ${state.optScope === "one" ? "selected" : ""}>${t("opt.optim.one")}</option>
                <option value="all" ${state.optScope === "all" ? "selected" : ""}>${t("opt.optim.all")}</option></select></label>
            <button class="btn btn--primary btn--sm" id="oOptimize" type="button">${t("opt.optim.run")}</button>
          </div>
          <div class="table-wrap" id="oOpt" style="margin-top:12px"></div>
        </div>` : ""}

        <p class="portal__note opt-disclaimer">${t(state.chain ? "opt.disclaimerLive" : "opt.disclaimer")}</p>
      </div>`;
    bind();
    legsHtml();
    chainHtml();
    termHtml();
    optHtml();
    savedHtml();
    refresh();
  }

  function expLabel(e) {
    const [y, m, d] = e.date.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12));
    return dt.toLocaleDateString(I.lang === "vi" ? "vi-VN" : "en-US", { month: "short", day: "numeric", year: y !== new Date().getFullYear() ? "2-digit" : undefined, timeZone: "UTC" }) + " · " + Math.max(1, Math.round(e.days)) + (I.lang === "vi" ? " ngày" : "d");
  }
  function srcText() {
    if (state.loading) return t("opt.src.loading");
    if (state.chain) return t("opt.src.live", { time: asOfText() });
    return t("opt.priceNote");
  }

  /* ---------- option chain ---------- */
  const chainExp = () => (state.chain && state.chain.chain[state.chainExp] ? state.chainExp : state.expiry);
  function chainHtml() {
    const host = document.getElementById("oChain"), e = state.chain ? state.chain.chain[chainExp()] : null;
    if (!host || !e) return;
    const chips = $("oChips");
    if (chips) chips.innerHTML = state.chain.expiries.map((x) => `<button type="button" class="opt-chip ${x.date === chainExp() ? "is-on" : ""}" data-chainexp="${esc(x.date)}">${esc(expLabel(x))}</button>`).join("");
    const ks = e.strikes, ai = ks.indexOf(O.nearestStrike(ks, state.spot));
    const rows = ks.slice(Math.max(0, ai - 12), ai + 13);
    const f = (v, d) => (v > 0 ? v.toFixed(d) : "—");
    const q2 = (side, type, k, v) => `<button class="opt-q" type="button" data-side="${side}" data-type="${type}" data-k="${k}" title="${t(side > 0 ? "opt.buy" : "opt.sell")}">${f(v, 2)}</button>`;
    const half = (type, k) => {
      const q = e[type][k];
      if (!q) return `<td colspan="5" class="opt-c-none">—</td>`;
      const cells = [`<td>${q.oi ? q.oi.toLocaleString("en-US") : "—"}</td>`, `<td>${q.iv > 0 ? (q.iv * 100).toFixed(1) + "%" : "—"}</td>`,
        `<td>${q.delta ? q.delta.toFixed(2) : "—"}</td>`, `<td>${q2(-1, type, k, q.bid)}</td>`, `<td>${q2(1, type, k, q.ask)}</td>`];
      return (type === "call" ? cells : cells.reverse()).join("");
    };
    const atm = ks[ai];
    host.innerHTML = `<table class="ttable opt-chain"><thead>
      <tr><th colspan="5">${t("opt.calls")}</th><th></th><th colspan="5">${t("opt.puts")}</th></tr>
      <tr><th>${t("opt.chain.oi")}</th><th>IV</th><th>Δ</th><th>${t("opt.chain.bid")}</th><th>${t("opt.chain.ask")}</th><th>${t("opt.strike")}</th>
      <th>${t("opt.chain.bid")}</th><th>${t("opt.chain.ask")}</th><th>Δ</th><th>IV</th><th>${t("opt.chain.oi")}</th></tr></thead>
      <tbody>${rows.map(k => `<tr class="${k === atm ? "is-spot" : ""}">${half("call", k)}<th class="opt-c-k ${k < state.spot ? "itm-c" : "itm-p"}">${k}</th>${half("put", k)}</tr>`).join("")}</tbody></table>`;
  }

  /* ---------- term structure: one row per expiry ---------- */
  function termHtml() {
    const host = $("oTerm"); if (!host || !state.chain) return;
    const rows = O.termStructure(state.chain, state.spot);
    host.innerHTML = `<table class="ttable opt-term"><thead><tr><th>${t("opt.expiry")}</th><th>${t("opt.term.days")}</th><th>${t("opt.term.iv")}</th><th>${t("opt.term.straddle")}</th><th>${t("opt.term.move")}</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><th>${esc(expLabel({ date: r.date, days: r.days }))}</th><td>${Math.max(1, Math.round(r.days))}</td>
        <td>${r.iv ? (r.iv * 100).toFixed(1) + "%" : "—"}</td><td>${r.straddle ? usd(r.straddle, 2) : "—"}</td><td>${r.move ? "±" + (r.move * 100).toFixed(1) + "%" : "—"}</td></tr>`).join("")}</tbody></table>`;
  }

  /* ---------- optimizer ---------- */
  function optHtml() {
    const host = document.getElementById("oOpt");
    if (!host) return;
    if (state.target == null) { host.innerHTML = `<p class="portal__note" style="margin:0">${t("opt.optim.empty")}</p>`; return; }
    if (!optResults.length) { host.innerHTML = `<p class="portal__note" style="margin:0">${t("opt.optim.none")}</p>`; return; }
    host.innerHTML = `<table class="ttable opt-optim"><thead><tr><th>${t("opt.strategy")}</th><th>${t("opt.expiry")}</th><th>${t("opt.optim.cost")}</th><th>${t("opt.maxLoss")}</th><th>${t("opt.maxProfit")}</th><th>${t("opt.optim.pl")}</th><th>${t("opt.optim.ret")}</th><th></th></tr></thead>
      <tbody>${optResults.map((r, i) => `<tr><th>${esc(t("opt.s." + r.kind))} <span class="opt-strikes">${r.strikes.join("/")}</span></th>
        <td>${r.expiry && expInfo(r.expiry) ? esc(expLabel(expInfo(r.expiry))) : "—"}</td>
        <td>${usd(r.cost, 0)}</td><td class="neg">${usd(r.maxLoss, 0)}</td><td class="pos">${r.maxProfit === Infinity ? t("opt.unlimited") : usd(r.maxProfit, 0)}</td>
        <td>${usd(r.pl, 0)}</td><td><b>${Math.round(r.ret * 100)}%</b></td>
        <td><button class="btn btn--ghost btn--sm" type="button" data-use="${i}">${t("opt.optim.use")}</button></td></tr>`).join("")}</tbody></table>`;
  }

  /* ---------- saved trades (this browser only) ---------- */
  function savedHtml() {
    const host = document.getElementById("oSaved");
    if (!host) return;
    const list = readSaved();
    if (!list.length) { host.innerHTML = `<p class="portal__note" style="margin:0">${t("opt.saved.empty")}</p>`; return; }
    host.innerHTML = list.map((s, i) => `<div class="opt-saved">
        <div><b>${esc(s.name)}</b><span>${esc(new Date(s.at).toLocaleString(I.lang === "vi" ? "vi-VN" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))}</span></div>
        <button class="btn btn--ghost btn--sm" type="button" data-load="${i}">${t("opt.saved.load")}</button>
        <button class="opt-x" type="button" data-unsave="${i}" aria-label="${t("opt.remove")}">×</button></div>`).join("") +
      `<p class="portal__note" style="margin:8px 0 0">${t("opt.saved.note")}</p>`;
  }

  /* ---------- legs editor ---------- */
  const strikeText = (l) => "$" + l.strike + " · " + (l.strike >= state.spot ? "+" : "−") + Math.abs((l.strike / state.spot - 1) * 100).toFixed(1) + "%";
  const expText = (l) => t("opt.expIn", { n: l.dte || state.days, date: dateIn(l.dte || state.days) });
  function legNote(l) {
    if (l.type === "stock") return "";
    if (l.mkt) return t("opt.marketLeg", { iv: round2((l.iv || 0) * 100) });
    if (l.auto) return t("opt.model");
    const imp = O.impliedVol(l.type, l.premium, state.spot, l.strike, (l.dte || state.days) / 365, state.r, state.q);
    return t("opt.manual") + (imp ? " · " + t("opt.impliedAt", { iv: round2(imp * 100) }) : "");
  }
  function legsHtml() {
    const host = document.getElementById("oLegs");
    if (!host) return;
    if (!state.legs.length) { host.innerHTML = `<p class="portal__note" style="margin:0">${t("opt.empty")}</p>`; return; }
    host.innerHTML = state.legs.map((l, i) => {
      const stock = l.type === "stock";
      const note = legNote(l);
      const b = { min: Math.min(l.strike, Math.max(stepOf(), snapK(state.spot * 0.75))), max: Math.max(l.strike, snapK(state.spot * 1.25)) };
      return `
        <div class="opt-leg" data-i="${i}">
          <div class="opt-leg__top">
            <select data-f="side" aria-label="${t("opt.side")}">
              <option value="1" ${l.side > 0 ? "selected" : ""}>${t("opt.buy")}</option>
              <option value="-1" ${l.side < 0 ? "selected" : ""}>${t("opt.sell")}</option></select>
            <select data-f="type" aria-label="${t("opt.type")}">
              <option value="call" ${l.type === "call" ? "selected" : ""}>${t("opt.call")}</option>
              <option value="put" ${l.type === "put" ? "selected" : ""}>${t("opt.put")}</option>
              <option value="stock" ${stock ? "selected" : ""}>${t("opt.stock")}</option></select>
            <span class="opt-qty">
              <button type="button" data-f="qtyDown" aria-label="${t("opt.fewer")}">−</button>
              <input data-f="qty" type="number" min="1" step="1" value="${l.qty}" aria-label="${t("opt.qty")}" inputmode="numeric" />
              <button type="button" data-f="qtyUp" aria-label="${t("opt.more")}">+</button></span>
            <button class="opt-x" data-f="remove" type="button" aria-label="${t("opt.remove")}">×</button>
          </div>
          ${stock ? "" : `<div>
            <span class="opt-leg__lbl">${t("opt.strike")}: <b data-o="strike">${strikeText(l)}</b></span>
            <div class="opt-pick__row">
              <input type="range" data-f="strike" min="${b.min}" max="${b.max}" step="${stepOf()}" value="${l.strike}" aria-label="${t("opt.strike")}" />
              <input type="number" data-f="strike" step="0.5" min="0.01" value="${l.strike}" inputmode="decimal" aria-label="${t("opt.strike")}" />
            </div></div>`}
          ${stock ? "" : state.chain
            ? `<div><span class="opt-leg__lbl">${t("opt.expiry")}</span><select data-f="exp" aria-label="${t("opt.expiry")}">${state.chain.expiries.map((e) => `<option value="${esc(e.date)}" ${e.date === l.exp ? "selected" : ""}>${esc(expLabel(e))}</option>`).join("")}</select></div>`
            : `<div><span class="opt-leg__lbl"><b data-o="exp">${expText(l)}</b></span><input type="range" data-f="dte" min="1" max="365" step="1" value="${l.dte || state.days}" aria-label="${t("opt.days")}" /></div>`}
          <div class="opt-leg__price">
            <label>${t("opt.premium")} <input data-f="premium" type="number" step="0.01" min="0" value="${l.premium}" inputmode="decimal" /></label>
            <span class="opt-leg__note" data-o="note">${note}</span>
          </div>
        </div>`;
    }).join("");
  }

  /* ---------- events ---------- */
  function bind() {
    const $ = (id) => document.getElementById(id);

    const onInput = () => {
      const oldDays = state.days;
      state.spot = Math.max(0.01, num($("oSpot").value, state.spot));
      state.iv = Math.min(3, Math.max(0.01, num($("oIv").value, state.iv * 100) / 100));
      if ($("oDays")) state.days = Math.min(1000, Math.max(1, Math.round(num($("oDays").value, state.days))));
      state.r = Math.max(0, num($("oRate").value, state.r * 100) / 100);
      state.q = Math.max(0, num($("oDiv").value, state.q * 100) / 100);
      if (state.days !== oldDays) state.legs.forEach((l) => { if (l.type !== "stock" && l.dte === oldDays) l.dte = state.days; });
      repriceAuto();
      legsHtml();
      refresh();
    };
    const label = () => {
      if ($("oSpotV")) $("oSpotV").textContent = "$" + state.spot;
      if ($("oIvV")) $("oIvV").textContent = round2(state.iv * 100) + "%";
      if ($("oDaysV")) $("oDaysV").textContent = state.days + " · " + dateIn(state.days);
    };
    ["oSpot", "oIv", "oDays", "oRate", "oDiv"].forEach((id) => {
      if (!$(id)) return;
      $(id).addEventListener("input", (e) => {
        if (id === "oSpot") {
          spotTouched = true;
          const v = num(e.target.value, 0);
          if (v > 0 && (v < spotBase * 0.7 || v > spotBase * 1.3)) { spotBase = v; const r = $("oSpotR"); r.min = Math.max(0.5, snapK(v * 0.7)); r.max = snapK(v * 1.3); }
        }
        if ($(id + "R")) $(id + "R").value = e.target.value;
        onInput(); label();
      });
      if ($(id + "R")) $(id + "R").addEventListener("input", (e) => {
        if (id === "oSpot") spotTouched = true;
        $(id).value = e.target.value; onInput(); label();
      });
    });
    label();
    // the other slider-and-box pairs
    [["oWidth", "width", 1], ["oOffset", "offset", 1]].forEach(([id, key, min]) => {
      const apply = (v) => { state[key] = Math.max(min, Math.round(num(v, state[key]))); $(id + "V").textContent = state[key]; };
      $(id + "R").addEventListener("input", (e) => { $(id).value = e.target.value; apply(e.target.value); });
      $(id).addEventListener("input", (e) => { $(id + "R").value = e.target.value; apply(e.target.value); });
      $(id + "V").textContent = state[key];
    });
    if ($("oFar")) {
      if ($("oFar").tagName === "SELECT") $("oFar").addEventListener("change", (e) => { state.farExp = e.target.value; });
      else {
        const apply = (v) => { state.farDays = Math.max(2, Math.round(num(v, state.farDays))); $("oFarV").textContent = state.farDays + " · " + dateIn(state.farDays); };
        $("oFarR").addEventListener("input", (e) => { $("oFar").value = e.target.value; apply(e.target.value); });
        $("oFar").addEventListener("input", (e) => { $("oFarR").value = e.target.value; apply(e.target.value); });
        apply($("oFar").value);
      }
    }
    if ($("oTarget")) {
      const tgl = () => { $("oTargetV").textContent = "$" + num($("oTarget").value, 0); };
      $("oTargetR").addEventListener("input", (e) => { $("oTarget").value = e.target.value; tgl(); });
      $("oTarget").addEventListener("input", (e) => { $("oTargetR").value = e.target.value; tgl(); });
      tgl();
    }
    document.querySelectorAll("[data-pnl]").forEach((b) => b.addEventListener("click", () => {
      state.pnl = b.dataset.pnl;
      document.querySelectorAll("[data-pnl]").forEach((x) => x.classList.toggle("is-on", x === b));
      refresh();
    }));

    $("oSymbol").addEventListener("change", (e) => {
      const d = SYMBOLS[e.target.value]; state.symbol = e.target.value;
      state.spot = d.spot; state.iv = d.iv; state.q = d.q; resetDistances(); spotTouched = false;
      state.chain = null; state.expiry = null; state.target = null; optResults = [];
      build(state.strategy); layout(); loadMarket();
    });
    $("oStrategy").addEventListener("change", (e) => { build(e.target.value); layout(); });
    $("oBuild").addEventListener("click", () => { build(state.strategy); layout(); });
    $("oAdd").addEventListener("click", () => {
      const k = O.roundStrike(state.spot, state.spot);
      const l = stamp({ type: "call", side: 1, strike: k, qty: 1, premium: 0, iv: state.iv, auto: true });
      state.legs.push(l); repriceAuto(); marketize(l); state.label = "opt.saved.custom"; legsHtml(); refresh();
    });
    $("oReprice").addEventListener("click", () => {
      state.legs.forEach(l => { l.auto = true; l.mkt = false; }); repriceAuto(); state.legs.forEach(marketize); legsHtml(); refresh();
    });
    if ($("oExpiry")) $("oExpiry").addEventListener("change", (e) => {
      const old = state.expiry;
      setExpiry(e.target.value);
      state.legs.forEach((l) => { if (l.type !== "stock" && l.exp === old) setLegExp(l, state.expiry); });
      state.farExp = null; repriceAuto(); state.legs.forEach(marketize); optResults = []; state.target = null; layout();
    });
    $("oSave").addEventListener("click", (e) => {
      if (!state.legs.length) return;
      const name = `${state.symbol === "CUSTOM" ? "—" : state.symbol} · ${t(state.label || "opt.s." + state.strategy)}${state.expiry ? " · " + state.expiry : ""}`;
      const list = readSaved();
      list.unshift({ name, sym: state.symbol, expiry: state.expiry, days: state.days, spot: state.spot, at: Date.now(),
        legs: state.legs.map(l => ({ type: l.type, side: l.side, strike: l.strike, qty: l.qty, premium: l.premium, iv: l.iv, exp: l.exp, dte: l.dte })) });
      writeSaved(list.slice(0, 50)); savedHtml();
      e.target.textContent = t("opt.saved.done"); setTimeout(() => { e.target.textContent = t("opt.save"); }, 1500);
    });
    if ($("oOptimize")) $("oOptimize").addEventListener("click", () => {
      const tg = num($("oTarget").value, 0); if (!(tg > 0)) return;
      state.target = tg; state.optScope = $("oScope") ? $("oScope").value : "one";
      optResults = state.optScope === "all"
        ? O.optimizeAll(state.chain, state.spot, tg, { limit: 30, perExpiry: 3 })
        : O.optimize(expData(), state.spot, tg, { limit: 15 }).map((r) => Object.assign({ expiry: state.expiry }, r));
      optHtml();
    });
    root.onclick = (e) => {
      const q = e.target.closest(".opt-q");
      if (q) {
        const l = stamp({ type: q.dataset.type, side: +q.dataset.side > 0 ? 1 : -1, strike: +q.dataset.k, qty: 1, premium: 0, iv: state.iv, auto: true });
        if (state.chain) setLegExp(l, chainExp());
        state.legs.push(l); marketize(l); state.label = "opt.saved.custom"; legsHtml(); refresh();
        const lg = $("oLegs"); if (lg && lg.scrollIntoView) lg.scrollIntoView({ block: "nearest", behavior: "smooth" });
        return;
      }
      const ce = e.target.closest("[data-chainexp]");
      if (ce) { state.chainExp = ce.dataset.chainexp; chainHtml(); return; }
      const u = e.target.closest("[data-use]");
      if (u) { const r = optResults[+u.dataset.use]; if (r) { state.legs = r.legs.map(l => { const x = stamp({ ...l, auto: false, mkt: true }); if (r.expiry && l.type !== "stock") setLegExp(x, r.expiry); return x; }); state.label = "opt.s." + r.kind; legsHtml(); refresh(); } return; }
      const ld = e.target.closest("[data-load]");
      if (ld) { loadSaved(readSaved()[+ld.dataset.load]); return; }
      const un = e.target.closest("[data-unsave]");
      if (un) { const list = readSaved(); list.splice(+un.dataset.unsave, 1); writeSaved(list); savedHtml(); }
    };
    $("oClear").addEventListener("click", () => { state.legs = []; legsHtml(); refresh(); });

    // one listener for every field of every leg
    const legs = $("oLegs");
    legs.addEventListener("input", legChange);
    legs.addEventListener("change", legChange);
    legs.addEventListener("click", (e) => {
      const q = e.target.closest("[data-f=qtyUp],[data-f=qtyDown]");
      if (q) {
        const l = state.legs[+q.closest(".opt-leg").dataset.i];
        l.qty = Math.max(1, l.qty + (q.dataset.f === "qtyUp" ? 1 : -1)); state.label = "opt.saved.custom";
        q.parentElement.querySelector("input").value = l.qty; refresh(); return;
      }
      const b = e.target.closest("[data-f=remove]");
      if (!b) return;
      state.legs.splice(+b.closest(".opt-leg").dataset.i, 1); state.label = "opt.saved.custom"; legsHtml(); refresh();
    });

    $("oElapsed").addEventListener("input", (e) => { state.elapsed = Math.round(num(e.target.value, 0)); refresh(); });
    $("oIvShift").addEventListener("input", (e) => { state.ivShift = num(e.target.value, 0); refresh(); });
    $("oRange").addEventListener("input", (e) => { state.rangePct = num(e.target.value, 20); refresh(); });
  }

  function legChange(e) {
    const f = e.target.dataset.f; if (!f || f === "remove") return;
    if (f !== "premium") state.label = "opt.saved.custom";
    const row = e.target.closest(".opt-leg"); const l = state.legs[+row.dataset.i]; if (!l) return;
    if (f === "side") l.side = +e.target.value > 0 ? 1 : -1;
    else if (f === "type") {
      l.type = e.target.value;
      if (l.type === "stock") { l.strike = 0; l.auto = true; l.mkt = false; l.dte = undefined; l.exp = undefined; } else { if (!l.strike) l.strike = O.roundStrike(state.spot, state.spot); if (!l.dte) stamp(l); }
      repriceAuto(); marketize(l); if (e.type === "change") legsHtml();
    }
    else if (f === "qty") l.qty = Math.max(1, Math.round(num(e.target.value, 1)));
    else if (f === "exp") { setLegExp(l, e.target.value); marketize(l); legsHtml(); refresh(); return; }
    else if (f === "dte") {
      l.dte = Math.max(1, Math.round(num(e.target.value, l.dte)));
      const x = row.querySelector("[data-o=exp]"); if (x) x.textContent = expText(l);
      if (l.auto) repriceAuto();
      const pr = row.querySelector("[data-f=premium]"); if (pr && l.auto) pr.value = l.premium;
    }
    else if (f === "strike") {
      l.strike = Math.max(0.01, num(e.target.value, l.strike));
      const isSlider = e.target.type === "range";
      if (expData() && (isSlider || e.type === "change")) {
        marketize(l);
        if (!isSlider) { legsHtml(); refresh(); return; }
      } else if (l.auto) repriceAuto();
      row.querySelectorAll("[data-f=strike]").forEach((x) => { if (x !== e.target && x !== document.activeElement) x.value = l.strike; });
      const sl = row.querySelector("input[type=range][data-f=strike]");
      if (sl && (l.strike < +sl.min || l.strike > +sl.max)) { sl.min = Math.min(l.strike, +sl.min); sl.max = Math.max(l.strike, +sl.max); }
      const lab = row.querySelector("[data-o=strike]"); if (lab) lab.textContent = strikeText(l);
      const pr = row.querySelector("[data-f=premium]"); if (pr && pr !== document.activeElement) pr.value = l.premium;
    }
    else if (f === "premium") { l.premium = Math.max(0, num(e.target.value, 0)); l.auto = false; l.mkt = false; }
    const nt = row.querySelector(".opt-leg__note"); if (nt) nt.textContent = legNote(l);
    if ((f === "strike" || f === "dte") && l.auto) { const p = row.querySelector("[data-f=premium]"); if (p && p !== document.activeElement) p.value = l.premium; }
    refresh();
  }

  /* ---------- everything that depends on the position ---------- */
  function refresh() {
    if (!$("oStats")) return;
    const legs = effectiveLegs();
    const ds = O.expiryDays(legs, state.days);         // each distinct expiry, soonest first
    const hz = ds[0], last = ds[ds.length - 1];
    const mixed = ds.length > 1;
    state.elapsed = Math.min(state.elapsed, last);
    const ivShift = state.ivShift / 100;

    const el = $("oElapsed"); el.max = last; el.value = state.elapsed;
    $("oDateLbl").textContent =
      (state.elapsed === 0 ? t("opt.dateToday") : state.elapsed >= last ? (mixed ? t("opt.atLast") : t("opt.dateExpiry")) : t("opt.inDays", { n: state.elapsed })) + " · " + dateIn(state.elapsed);
    $("oIvLbl").textContent = (state.ivShift > 0 ? "+" : "") + state.ivShift + " " + (I.lang === "vi" ? "điểm" : "pts");
    $("oRangeLbl").textContent = "±" + state.rangePct + "%";
    $("oExpLbl").textContent = mixed ? t("opt.atFirst") : t("opt.atExpiry");
    $("oMixed").hidden = !mixed;

    const a = O.analyze(legs, { spot: state.spot, days: hz, r: state.r, q: state.q, iv: state.iv });
    stats(a);
    $("oLegendX").innerHTML = ds.slice(1, 4).map((d, i) => `<i class="opt-key opt-key--x${i + 1}"></i>${t("opt.onExpiry", { date: dateIn(d) })}`).join("");
    chart(legs, a, hz, ivShift, ds);
    greeks(legs, ivShift);
    heat(legs, a, last, ivShift);
  }

  function stats(a) {
    const empty = !state.legs.length;
    const cash = a.netCash;
    const card = (l, v, s, cls) => `<div class="inc-card"><div class="inc-card__l">${l}</div><div class="inc-card__v ${cls || ""}">${v}</div>${s ? `<div class="inc-card__s">${s}</div>` : ""}</div>`;
    $("oStats").innerHTML = empty ? "" : [
      card(cash >= 0 ? t("opt.netCredit") : t("opt.netDebit"), usd(Math.abs(cash), 0), "", cash >= 0 ? "pos" : ""),
      card(t("opt.maxProfit"), a.unlimitedProfit ? t("opt.unlimited") : usd(a.maxProfit, 0), "", "pos"),
      card(t("opt.maxLoss"), a.unlimitedLoss ? "−" + t("opt.unlimited") : usd(a.maxLoss, 0), "", a.maxLoss < 0 || a.unlimitedLoss ? "neg" : ""),
      card(a.breakevens.length === 1 ? t("opt.breakeven") : t("opt.breakevens"), a.breakevens.length ? a.breakevens.map(x => "$" + x.toFixed(2)).join(" · ") : t("opt.none"), ""),
      card(t("opt.pop"), a.pop == null ? "—" : Math.round(a.pop * 100) + "%", t("opt.popNote")),
    ].join("");
  }

  /* nice axis ticks */
  function ticks(min, max, n) {
    const span = max - min, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const stp = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
    const out = []; for (let v = Math.ceil(min / stp) * stp; v <= max + 1e-9; v += stp) out.push(+v.toFixed(8));
    return out;
  }

  let view = null;                    // geometry of the last chart, for the pointer handler

  function chart(legs, a, hz, ivShift, ds) {
    const svg = $("oChart");
    const W = 820, H = 380, pl = 66, pr = 18, pt = 14, pb = 34;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    if (!legs.length) { svg.innerHTML = ""; view = null; return; }

    const strikes = legs.filter(l => l.type !== "stock").map(l => l.strike);
    const half = state.spot * state.rangePct / 100;
    const xmin = Math.max(0.01, Math.min(state.spot - half, strikes.length ? Math.min(...strikes) * 0.97 : Infinity));
    const xmax = Math.max(state.spot + half, strikes.length ? Math.max(...strikes) * 1.03 : 0);

    const at = (x, el, sh) => O.plAt(legs, x, el, sh, state.r, state.q, state.days);
    // the curve at the first expiry: sampled, plus every strike so its corners stay sharp
    const N = 160, xs = [];
    for (let i = 0; i <= N; i += 1) xs.push(xmin + (xmax - xmin) * i / N);
    strikes.forEach(k => { if (k > xmin && k < xmax) xs.push(k); });
    xs.sort((p, q) => p - q);
    const exp = xs.map(x => [x, at(x, hz, 0)]);
    const showNow = state.elapsed !== hz;
    const now = showNow ? xs.map(x => [x, at(x, state.elapsed, ivShift)]) : [];
    const later = ds.slice(1, 4);                      // a curve for each later expiry
    const laterPts = later.map(d => xs.map(x => [x, at(x, d, 0)]));
    let ymin = Math.min(0, ...exp.map(p => p[1]), ...now.map(p => p[1]), ...laterPts.flat().map(p => p[1]));
    let ymax = Math.max(0, ...exp.map(p => p[1]), ...now.map(p => p[1]), ...laterPts.flat().map(p => p[1]));
    const pad = (ymax - ymin || 1) * 0.08; ymin -= pad; ymax += pad;

    const X = (x) => pl + (x - xmin) / (xmax - xmin) * (W - pl - pr);
    const Y = (y) => pt + (ymax - y) / (ymax - ymin) * (H - pt - pb);
    const y0 = Y(0);
    const path = (pts) => pts.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1)).join(" ");
    const area = path(exp) + ` L${X(exp[exp.length - 1][0]).toFixed(1)},${y0.toFixed(1)} L${X(exp[0][0]).toFixed(1)},${y0.toFixed(1)} Z`;

    const xt = ticks(xmin, xmax, 7), yt = ticks(ymin, ymax, 6);
    svg.innerHTML = `
      <defs>
        <clipPath id="oPos"><rect x="${pl}" y="${pt}" width="${W - pl - pr}" height="${Math.max(0, y0 - pt)}"/></clipPath>
        <clipPath id="oNeg"><rect x="${pl}" y="${y0}" width="${W - pl - pr}" height="${Math.max(0, H - pb - y0)}"/></clipPath>
      </defs>
      ${yt.map(v => `<line class="opt-grid" x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="opt-tick" x="${pl - 8}" y="${Y(v) + 4}" text-anchor="end">${usd(v, 0)}</text>`).join("")}
      ${xt.map(v => `<text class="opt-tick" x="${X(v)}" y="${H - 12}" text-anchor="middle">${v}</text>`).join("")}
      <path class="opt-area opt-area--pos" d="${area}" clip-path="url(#oPos)"/>
      <path class="opt-area opt-area--neg" d="${area}" clip-path="url(#oNeg)"/>
      <line class="opt-zero" x1="${pl}" x2="${W - pr}" y1="${y0}" y2="${y0}"/>
      <line class="opt-spot" x1="${X(state.spot)}" x2="${X(state.spot)}" y1="${pt}" y2="${H - pb}"/>
      <text class="opt-spot-l" x="${X(state.spot) + 5}" y="${pt + 11}">${t("opt.now")} ${state.spot}</text>
      <path class="opt-line opt-line--exp" d="${path(exp)}"/>
      ${laterPts.map((pts, i) => `<path class="opt-line opt-line--x${i + 1}" d="${path(pts)}"/>`).join("")}
      ${showNow ? `<path class="opt-line opt-line--now" d="${path(now)}"/>` : ""}
      ${a.breakevens.filter(b => b > xmin && b < xmax).map(b => `<circle class="opt-be" cx="${X(b)}" cy="${y0}" r="4.5"/><text class="opt-be-l" x="${X(b)}" y="${y0 - 9}" text-anchor="middle">${b.toFixed(2)}</text>`).join("")}
      <line class="opt-guide" id="oGuide" y1="${pt}" y2="${H - pb}" x1="0" x2="0"/>
      <rect id="oHit" x="${pl}" y="${pt}" width="${W - pl - pr}" height="${H - pt - pb}" fill="transparent"/>`;
    view = { W, H, pl, pr, xmin, xmax, legs, hz, ivShift, at, later };

    const hit = $("oHit");
    hit.addEventListener("pointermove", hover);
    hit.addEventListener("pointerleave", () => { $("oTip").hidden = true; $("oGuide").style.display = "none"; });
  }

  function hover(e) {
    if (!view) return;
    const svg = $("oChart"), r = svg.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width * view.W;
    const S = view.xmin + (px - view.pl) / (view.W - view.pl - view.pr) * (view.xmax - view.xmin);
    if (!(S >= view.xmin && S <= view.xmax)) return;
    const exp = view.at(S, view.hz, 0);
    const showNow = state.elapsed !== view.hz;
    const nowV = showNow ? view.at(S, state.elapsed, view.ivShift) : exp;
    const g = $("oGuide"); g.style.display = "block"; g.setAttribute("x1", px); g.setAttribute("x2", px);
    const tip = $("oTip"); tip.hidden = false;
    tip.innerHTML = `<b>${t("opt.hoverPrice")} $${S.toFixed(2)}</b>
      <span>${t(view.later.length ? "opt.atFirst" : "opt.hoverExpiry")}: <em class="${exp >= 0 ? "pos" : "neg"}">${sgn(exp)}${usd(exp)}</em></span>
      ${view.later.map(d => { const v = view.at(S, d, 0); return `<span>${t("opt.onExpiry", { date: dateIn(d) })}: <em class="${v >= 0 ? "pos" : "neg"}">${sgn(v)}${usd(v)}</em></span>`; }).join("")}
      ${showNow ? `<span>${t("opt.hoverDate")}: <em class="${nowV >= 0 ? "pos" : "neg"}">${sgn(nowV)}${usd(nowV)}</em></span>` : ""}`;
    const wrap = $("oChartWrap").getBoundingClientRect();
    const left = e.clientX - wrap.left + 14, flip = left > wrap.width - 190;
    tip.style.left = (flip ? e.clientX - wrap.left - 190 : left) + "px";
    tip.style.top = Math.max(6, e.clientY - wrap.top - 20) + "px";
  }

  function greeks(legs, ivShift) {
    const host = $("oGreeks");
    if (!legs.length) { host.innerHTML = ""; return; }
    const g = O.positionGreeksAt(legs, state.spot, state.elapsed, ivShift, state.r, state.q, state.days);
    const card = (l, v, h) => `<div class="inc-card"><div class="inc-card__l">${l}</div><div class="inc-card__v">${v}</div><div class="inc-card__s">${h}</div></div>`;
    host.innerHTML = [
      card(t("opt.delta"), sgn(g.delta) + g.delta.toFixed(1), t("opt.deltaHelp")),
      card(t("opt.gamma"), sgn(g.gamma) + g.gamma.toFixed(2), t("opt.gammaHelp")),
      card(t("opt.theta"), sgn(g.theta) + usd(g.theta, 2), t("opt.thetaHelp")),
      card(t("opt.vega"), sgn(g.vega) + usd(g.vega, 2), t("opt.vegaHelp")),
    ].join("");
  }

  function heat(legs, a, hz, ivShift) {
    const host = $("oHeat");
    if (!legs.length) { host.innerHTML = ""; return; }
    const strikes = legs.filter(l => l.type !== "stock").map(l => l.strike);
    const half = state.spot * state.rangePct / 100;
    const lo = Math.max(0.01, Math.min(state.spot - half, strikes.length ? Math.min(...strikes) * 0.97 : Infinity));
    const hi = Math.max(state.spot + half, strikes.length ? Math.max(...strikes) * 1.03 : 0);
    const ROWS = 13, COLS = Math.min(7, hz + 1);
    const prices = Array.from({ length: ROWS }, (_, i) => hi - (hi - lo) * i / (ROWS - 1));
    const cols = Array.from({ length: COLS }, (_, j) => Math.round(hz * j / (COLS - 1 || 1)));
    const grid = prices.map(S => cols.map(d => O.plAt(legs, S, d, d >= hz ? 0 : ivShift, state.r, state.q, state.days)));
    const maxAbs = Math.max(1, ...grid.flat().map(Math.abs));
    const basis = O.riskBasis(a);
    const near = prices.reduce((b, p, i) => (Math.abs(p - state.spot) < Math.abs(prices[b] - state.spot) ? i : b), 0);
    const cell = (v) => {
      const k = Math.min(0.55, Math.abs(v) / maxAbs * 0.55);
      const bg = v >= 0 ? `rgba(52,211,153,${k.toFixed(3)})` : `rgba(248,113,113,${k.toFixed(3)})`;
      const txt = state.pnl === "%" ? Math.round(v / basis * 100).toLocaleString("en-US") + "%" : Math.round(v).toLocaleString("en-US");
      return `<td style="background:${bg}">${txt}</td>`;
    };
    host.innerHTML = `<table class="ttable opt-heat"><thead><tr><th>${t("opt.heat.price")}</th>${cols.map(d => `<th>${d === 0 ? t("opt.dateToday") : d >= hz ? t("opt.dateExpiry") : dateIn(d)}</th>`).join("")}</tr></thead>
      <tbody>${prices.map((S, i) => `<tr class="${i === near ? "is-spot" : ""}"><th>${S.toFixed(2)}</th>${grid[i].map(cell).join("")}</tr>`).join("")}</tbody></table>`;
  }

  /* ---------- start ---------- */
  /* Prefer the live chain: it brings the price, the real expiries and strikes
     and a market price for every leg. Without it, fall back to the latest
     close and model prices, and the page says so. Never overwrite a price
     the visitor has already typed. */
  async function loadMarket() {
    const sym = state.symbol;
    if (sym === "CUSTOM" || !window.JSS) return;
    state.loading = true; const src = document.getElementById("oSrc"); if (src) src.textContent = srcText();
    let chain = null;
    try { chain = window.JSS.getOptionChain ? await window.JSS.getOptionChain(sym) : null; } catch (_) { chain = null; }
    state.loading = false;
    if (sym !== state.symbol) return;                       // the visitor switched symbol meanwhile
    if (chain) {
      chain.fetchedAt = Date.now();
      state.chain = chain;
      if (!spotTouched) state.spot = round2(chain.spot);
      setExpiry(state.expiry && chain.chain[state.expiry] ? state.expiry : pickExpiry(35));
      resetDistances(); build(state.strategy); layout();
      return;
    }
    try {
      const q = window.JSS.getQuote ? await window.JSS.getQuote(sym, 5) : null;
      const close = q && +q.close;
      if (sym === state.symbol && !spotTouched && isFinite(close) && close > 1) {
        state.spot = round2(close); resetDistances(); build(state.strategy);
      }
    } catch (_) { /* keep the placeholder */ }
    layout();
  }

  /* Refresh the chain every minute while the tab is visible. Leg prices are
     entry prices and stay put; the chain table and the volatility follow. */
  setInterval(async () => {
    if (!state.chain || document.hidden || !window.JSS || !window.JSS.getOptionChain) return;
    const sym = state.symbol;
    let chain = null; try { chain = await window.JSS.getOptionChain(sym); } catch (_) { return; }
    if (!chain || sym !== state.symbol || !chain.chain[state.expiry]) return;
    chain.fetchedAt = Date.now(); state.chain = chain;
    if (!spotTouched) state.spot = round2(chain.spot);
    state.legs.forEach(l => { const e = legData(l); if (l.mkt && e && e[l.type] && e[l.type][l.strike] && e[l.type][l.strike].iv > 0) l.iv = e[l.type][l.strike].iv; });
    const src = document.getElementById("oSrc"); if (src) src.textContent = srcText();
    chainHtml(); refresh();
  }, 60000);

  /* A saved trade keeps its entry prices, so the page shows its result since
     then. Its volatility is updated from today's chain when the contract is
     still listed. */
  async function loadSaved(sv) {
    if (!sv) return;
    if (sv.sym !== state.symbol && SYMBOLS[sv.sym]) {
      state.symbol = sv.sym; const d = SYMBOLS[sv.sym]; state.spot = d.spot; state.iv = d.iv; state.q = d.q;
      state.chain = null; state.expiry = null; spotTouched = false; await loadMarket();
    }
    const gone = (l) => l.type !== "stock" && state.chain && !state.chain.chain[l.exp || sv.expiry];
    if (state.chain && (sv.expiry || sv.legs.some((l) => l.exp))) {
      if (sv.legs.some(gone) || (sv.expiry && !state.chain.chain[sv.expiry])) { const s = document.getElementById("oSrc"); if (s) s.textContent = t("opt.saved.expired"); return; }
      setExpiry(sv.expiry || sv.legs.find((l) => l.exp).exp);
    } else if (sv.days) state.days = sv.days;
    state.legs = sv.legs.map(l => {
      const e = l.type !== "stock" && state.chain ? state.chain.chain[l.exp || sv.expiry] : null;
      const q = e && e[l.type][l.strike];
      const out = { ...l, auto: false, mkt: !!(q && q.iv > 0), iv: q && q.iv > 0 ? q.iv : l.iv };
      if (l.type === "stock") return out;
      if (state.chain) setLegExp(out, l.exp || sv.expiry); else out.dte = l.dte || sv.days || state.days;
      return out;
    });
    layout();
  }

  resetDistances();
  build(state.strategy);
  setHero();
  layout();
  I.onChange(() => { setHero(); layout(); });
  loadMarket();
})();
