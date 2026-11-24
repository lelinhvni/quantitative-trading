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
    chain: null, expiry: null, target: null, loading: false, label: null,
  };
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

  function defaultWidth() { return Math.max(1, Math.round(state.spot / 100)); }
  /* Short strikes sit about 3/4 of an expected move from the price. */
  function defaultOffset() { return Math.max(1, Math.round(0.75 * state.spot * state.iv * Math.sqrt(state.days / 365))); }
  function resetDistances() { state.width = defaultWidth(); state.offset = defaultOffset(); }

  /* Auto-priced legs track the model whenever an input changes; a leg whose
     price the user has typed keeps it. */
  function repriceAuto() {
    const T = state.days / 365;
    state.legs.forEach((l) => {
      if (!l.auto) return;
      if (l.type === "stock") { l.premium = round2(state.spot); l.iv = 0; return; }
      l.premium = round2(O.price(l.type, state.spot, l.strike, T, state.iv, state.r, state.q));
      l.iv = state.iv;
    });
  }

  /* ---------- live chain ----------
     With a chain loaded, option legs take the market midpoint for the
     selected expiry and the quoted volatility; their strikes snap to strikes
     that exist. A leg whose price the visitor types stops being a market leg. */
  const expData = () => (state.chain && state.expiry ? state.chain.chain[state.expiry] : null);
  function marketize(l) {
    const e = expData();
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
    state.expiry = e.date;
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
    const T = state.days / 365;
    return state.legs.map((l) => {
      let iv = state.iv;
      if (l.type === "stock") iv = 0;
      else if (l.mkt && l.iv > 0) iv = l.iv;
      else if (!l.auto) {
        const imp = O.impliedVol(l.type, l.premium, state.spot, l.strike, T, state.r, state.q);
        if (imp) iv = imp;
      }
      return { type: l.type, side: l.side, strike: l.strike, qty: l.qty, premium: l.premium, iv };
    });
  }

  function build(name) {
    state.strategy = name; state.label = null;
    state.legs = O.buildTemplate(name, state.spot, state.width, state.iv, state.days, state.r, state.q, state.offset);
    if (expData()) state.legs.forEach(marketize);
  }

  /* ---------- page text ---------- */
  function setHero() {
    const set = (id, k) => { const e = document.getElementById(id); if (e) e.textContent = t(k); };
    set("optEyebrow", "opt.eyebrow"); set("optTitle", "opt.title"); set("optLede", "opt.lede");
    document.title = t("nav.options") + " — BPSQuant";
  }

  /* ---------- static layout, built from state ---------- */
  function layout() {
    const sym = (s) => `<option value="${s}" ${state.symbol === s ? "selected" : ""}>${s === "CUSTOM" ? "—" : s}</option>`;
    root.innerHTML = `
      <aside class="opt__side">
        <div class="panel">
          <div class="panel__head"><h2>${t("opt.under")}</h2></div>
          <div class="opt-fields">
            <label class="field"><span>${t("opt.symbol")}</span>
              <select id="oSymbol">${Object.keys(SYMBOLS).map(sym).join("")}</select></label>
            <label class="field"><span>${t("opt.spot")}</span>
              <input id="oSpot" type="number" step="0.01" min="0.01" value="${state.spot}" inputmode="decimal" /></label>
            <label class="field"><span>${t("opt.iv")}</span>
              <input id="oIv" type="number" step="0.1" min="1" max="300" value="${round2(state.iv * 100)}" inputmode="decimal" /></label>
            ${state.chain ? `<label class="field"><span>${t("opt.expiry")}</span>
              <select id="oExpiry">${state.chain.expiries.map(e => `<option value="${esc(e.date)}" ${e.date === state.expiry ? "selected" : ""}>${esc(expLabel(e))}</option>`).join("")}</select></label>`
            : `<label class="field"><span>${t("opt.days")}</span>
              <input id="oDays" type="number" step="1" min="1" max="1000" value="${state.days}" inputmode="numeric" /></label>`}
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
          <div class="opt-row">
            <label class="field"><span>${t("opt.width")}</span>
              <input id="oWidth" type="number" step="1" min="1" value="${state.width}" inputmode="decimal" /></label>
            <label class="field"><span>${t("opt.offset")}</span>
              <input id="oOffset" type="number" step="1" min="1" value="${state.offset}" inputmode="decimal" /></label>
            <button class="btn btn--primary btn--sm" id="oBuild" type="button">${t("opt.build")}</button>
          </div>
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
            <span class="opt-legend"><i class="opt-key opt-key--exp"></i>${t("opt.atExpiry")}
              <i class="opt-key opt-key--now"></i>${t("opt.onDate")}</span></div>
          <div class="opt-chart" id="oChartWrap">
            <svg id="oChart" role="img" aria-label="${t("opt.chart.aria")}" preserveAspectRatio="xMidYMid meet"></svg>
            <div class="opt-tip" id="oTip" hidden></div>
          </div>
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
          <div class="panel__head"><h2>${t("opt.heat.title")}</h2><span class="panel__sub">${t("opt.heat.sub")}</span></div>
          <div class="table-wrap" id="oHeat"></div>
        </div>

        ${state.chain ? `<div class="panel">
          <div class="panel__head"><h2>${t("opt.chain.title")}</h2><span class="panel__sub">${t("opt.chain.sub")}</span></div>
          <div class="table-wrap" id="oChain"></div>
        </div>

        <div class="panel">
          <div class="panel__head"><h2>${t("opt.optim.title")}</h2><span class="panel__sub">${t("opt.optim.sub")}</span></div>
          <div class="opt-row">
            <label class="field"><span>${t("opt.optim.target")}</span>
              <input id="oTarget" type="number" step="0.5" min="0.01" value="${state.target || round2(state.spot * 1.03)}" inputmode="decimal" /></label>
            <button class="btn btn--primary btn--sm" id="oOptimize" type="button">${t("opt.optim.run")}</button>
          </div>
          <div class="table-wrap" id="oOpt" style="margin-top:12px"></div>
        </div>` : ""}

        <p class="portal__note opt-disclaimer">${t(state.chain ? "opt.disclaimerLive" : "opt.disclaimer")}</p>
      </div>`;
    bind();
    legsHtml();
    chainHtml();
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
  function chainHtml() {
    const host = document.getElementById("oChain"), e = expData();
    if (!host || !e) return;
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

  /* ---------- optimizer ---------- */
  function optHtml() {
    const host = document.getElementById("oOpt");
    if (!host) return;
    if (state.target == null) { host.innerHTML = `<p class="portal__note" style="margin:0">${t("opt.optim.empty")}</p>`; return; }
    if (!optResults.length) { host.innerHTML = `<p class="portal__note" style="margin:0">${t("opt.optim.none")}</p>`; return; }
    host.innerHTML = `<table class="ttable opt-optim"><thead><tr><th>${t("opt.strategy")}</th><th>${t("opt.optim.cost")}</th><th>${t("opt.maxLoss")}</th><th>${t("opt.maxProfit")}</th><th>${t("opt.optim.pl")}</th><th>${t("opt.optim.ret")}</th><th></th></tr></thead>
      <tbody>${optResults.map((r, i) => `<tr><th>${esc(t("opt.s." + r.kind))} <span class="opt-strikes">${r.strikes.join("/")}</span></th>
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
  function legsHtml() {
    const host = document.getElementById("oLegs");
    if (!host) return;
    if (!state.legs.length) { host.innerHTML = `<p class="portal__note" style="margin:0">${t("opt.empty")}</p>`; return; }
    const T = state.days / 365;
    host.innerHTML = state.legs.map((l, i) => {
      const stock = l.type === "stock";
      let note = "";
      if (!stock) {
        if (l.mkt) note = t("opt.marketLeg", { iv: round2((l.iv || 0) * 100) });
        else if (l.auto) note = t("opt.model");
        else {
          const imp = O.impliedVol(l.type, l.premium, state.spot, l.strike, T, state.r, state.q);
          note = t("opt.manual") + (imp ? " · " + t("opt.impliedAt", { iv: round2(imp * 100) }) : "");
        }
      }
      return `
        <div class="opt-leg" data-i="${i}">
          <select data-f="side" aria-label="${t("opt.side")}">
            <option value="1" ${l.side > 0 ? "selected" : ""}>${t("opt.buy")}</option>
            <option value="-1" ${l.side < 0 ? "selected" : ""}>${t("opt.sell")}</option></select>
          <select data-f="type" aria-label="${t("opt.type")}">
            <option value="call" ${l.type === "call" ? "selected" : ""}>${t("opt.call")}</option>
            <option value="put" ${l.type === "put" ? "selected" : ""}>${t("opt.put")}</option>
            <option value="stock" ${stock ? "selected" : ""}>${t("opt.stock")}</option></select>
          <input data-f="qty" type="number" min="1" step="1" value="${l.qty}" aria-label="${t("opt.qty")}" inputmode="numeric" />
          <input data-f="strike" type="number" step="0.5" value="${stock ? "" : l.strike}" ${stock ? "disabled" : ""} placeholder="${t("opt.strike")}" aria-label="${t("opt.strike")}" inputmode="decimal" />
          <input data-f="premium" type="number" step="0.01" min="0" value="${l.premium}" aria-label="${t("opt.premium")}" inputmode="decimal" />
          <button class="opt-x" data-f="remove" type="button" aria-label="${t("opt.remove")}">×</button>
          <span class="opt-leg__note">${note}</span>
        </div>`;
    }).join("");
  }

  /* ---------- events ---------- */
  function bind() {
    const $ = (id) => document.getElementById(id);

    const onInput = () => {
      state.spot = Math.max(0.01, num($("oSpot").value, state.spot));
      state.iv = Math.min(3, Math.max(0.01, num($("oIv").value, state.iv * 100) / 100));
      if ($("oDays")) state.days = Math.min(1000, Math.max(1, Math.round(num($("oDays").value, state.days))));
      state.r = Math.max(0, num($("oRate").value, state.r * 100) / 100);
      state.q = Math.max(0, num($("oDiv").value, state.q * 100) / 100);
      state.elapsed = Math.min(state.elapsed, state.days);
      const el = $("oElapsed"); el.max = state.days; el.value = state.elapsed;
      repriceAuto();
      legsHtml();
      refresh();
    };
    ["oSpot", "oIv", "oDays", "oRate", "oDiv"].forEach((id) => {
      if ($(id)) $(id).addEventListener("input", () => { if (id === "oSpot") spotTouched = true; onInput(); });
    });

    $("oSymbol").addEventListener("change", (e) => {
      const d = SYMBOLS[e.target.value]; state.symbol = e.target.value;
      state.spot = d.spot; state.iv = d.iv; state.q = d.q; resetDistances(); spotTouched = false;
      state.chain = null; state.expiry = null; state.target = null; optResults = [];
      build(state.strategy); layout(); loadMarket();
    });
    $("oStrategy").addEventListener("change", (e) => { build(e.target.value); layout(); });
    $("oWidth").addEventListener("input", (e) => { state.width = Math.max(1, num(e.target.value, state.width)); });
    $("oOffset").addEventListener("input", (e) => { state.offset = Math.max(1, num(e.target.value, state.offset)); });
    $("oBuild").addEventListener("click", () => { build(state.strategy); layout(); });
    $("oAdd").addEventListener("click", () => {
      const k = O.roundStrike(state.spot, state.spot);
      const l = { type: "call", side: 1, strike: k, qty: 1, premium: 0, iv: state.iv, auto: true };
      state.legs.push(l); repriceAuto(); marketize(l); state.label = "opt.saved.custom"; legsHtml(); refresh();
    });
    $("oReprice").addEventListener("click", () => {
      state.legs.forEach(l => { l.auto = true; l.mkt = false; }); repriceAuto(); state.legs.forEach(marketize); legsHtml(); refresh();
    });
    if ($("oExpiry")) $("oExpiry").addEventListener("change", (e) => {
      setExpiry(e.target.value); repriceAuto(); state.legs.forEach(marketize); optResults = []; state.target = null; layout();
    });
    $("oSave").addEventListener("click", (e) => {
      if (!state.legs.length) return;
      const name = `${state.symbol === "CUSTOM" ? "—" : state.symbol} · ${t(state.label || "opt.s." + state.strategy)}${state.expiry ? " · " + state.expiry : ""}`;
      const list = readSaved();
      list.unshift({ name, sym: state.symbol, expiry: state.expiry, days: state.days, spot: state.spot, at: Date.now(),
        legs: state.legs.map(l => ({ type: l.type, side: l.side, strike: l.strike, qty: l.qty, premium: l.premium, iv: l.iv })) });
      writeSaved(list.slice(0, 50)); savedHtml();
      e.target.textContent = t("opt.saved.done"); setTimeout(() => { e.target.textContent = t("opt.save"); }, 1500);
    });
    if ($("oOptimize")) $("oOptimize").addEventListener("click", () => {
      const tg = num($("oTarget").value, 0); if (!(tg > 0)) return;
      state.target = tg; optResults = O.optimize(expData(), state.spot, tg, { limit: 15 }); optHtml();
    });
    root.onclick = (e) => {
      const q = e.target.closest(".opt-q");
      if (q) {
        const l = { type: q.dataset.type, side: +q.dataset.side > 0 ? 1 : -1, strike: +q.dataset.k, qty: 1, premium: 0, iv: state.iv, auto: true };
        state.legs.push(l); marketize(l); state.label = "opt.saved.custom"; legsHtml(); refresh();
        const lg = $("oLegs"); if (lg && lg.scrollIntoView) lg.scrollIntoView({ block: "nearest", behavior: "smooth" });
        return;
      }
      const u = e.target.closest("[data-use]");
      if (u) { const r = optResults[+u.dataset.use]; if (r) { state.legs = r.legs.map(l => ({ ...l, auto: false, mkt: true })); state.label = "opt.s." + r.kind; legsHtml(); refresh(); } return; }
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
      if (l.type === "stock") { l.strike = 0; l.auto = true; l.mkt = false; } else if (!l.strike) l.strike = O.roundStrike(state.spot, state.spot);
      repriceAuto(); marketize(l); if (e.type === "change") legsHtml();
    }
    else if (f === "qty") l.qty = Math.max(1, Math.round(num(e.target.value, 1)));
    else if (f === "strike") {
      l.strike = Math.max(0.01, num(e.target.value, l.strike));
      if (expData() && e.type === "change") { marketize(l); legsHtml(); refresh(); return; }
      if (l.auto) repriceAuto();
    }
    else if (f === "premium") { l.premium = Math.max(0, num(e.target.value, 0)); l.auto = false; l.mkt = false; }
    if (f === "premium" || f === "strike") {
      const note = row.querySelector(".opt-leg__note");
      if (note && l.type !== "stock") {
        const imp = O.impliedVol(l.type, l.premium, state.spot, l.strike, state.days / 365, state.r, state.q);
        note.textContent = l.mkt ? t("opt.marketLeg", { iv: round2((l.iv || 0) * 100) }) : l.auto ? t("opt.model") : t("opt.manual") + (imp ? " · " + t("opt.impliedAt", { iv: round2(imp * 100) }) : "");
      }
      if (f === "strike" && l.auto) { const p = row.querySelector("[data-f=premium]"); if (p) p.value = l.premium; }
    }
    refresh();
  }

  /* ---------- everything that depends on the position ---------- */
  function refresh() {
    const legs = effectiveLegs();
    const daysLeft = Math.max(0, state.days - state.elapsed);
    const ivShift = state.ivShift / 100;

    document.getElementById("oDateLbl").textContent =
      (state.elapsed === 0 ? t("opt.dateToday") : state.elapsed >= state.days ? t("opt.dateExpiry") : t("opt.inDays", { n: state.elapsed })) + " · " + dateIn(state.elapsed);
    document.getElementById("oIvLbl").textContent = (state.ivShift > 0 ? "+" : "") + state.ivShift + " " + (I.lang === "vi" ? "điểm" : "pts");
    document.getElementById("oRangeLbl").textContent = "±" + state.rangePct + "%";

    const a = O.analyze(legs, { spot: state.spot, days: state.days, r: state.r, q: state.q, iv: state.iv });
    stats(a);
    chart(legs, a, daysLeft, ivShift);
    greeks(legs, daysLeft, ivShift);
    heat(legs, ivShift);
  }

  function stats(a) {
    const empty = !state.legs.length;
    const cash = a.netCash;
    const card = (l, v, s, cls) => `<div class="inc-card"><div class="inc-card__l">${l}</div><div class="inc-card__v ${cls || ""}">${v}</div>${s ? `<div class="inc-card__s">${s}</div>` : ""}</div>`;
    document.getElementById("oStats").innerHTML = empty ? "" : [
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
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
    const out = []; for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(8));
    return out;
  }

  let view = null;                    // geometry of the last chart, for the pointer handler

  function chart(legs, a, daysLeft, ivShift) {
    const svg = document.getElementById("oChart");
    const W = 820, H = 380, pl = 66, pr = 18, pt = 14, pb = 34;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    if (!legs.length) { svg.innerHTML = ""; view = null; return; }

    const strikes = legs.filter(l => l.type !== "stock").map(l => l.strike);
    const half = state.spot * state.rangePct / 100;
    const xmin = Math.max(0.01, Math.min(state.spot - half, strikes.length ? Math.min(...strikes) * 0.97 : Infinity));
    const xmax = Math.max(state.spot + half, strikes.length ? Math.max(...strikes) * 1.03 : 0);

    // expiry curve: exact, because it only bends at the strikes
    const bends = [xmin, ...strikes.filter(k => k > xmin && k < xmax), xmax];
    const exp = bends.map(x => [x, O.plAtExpiry(legs, x)]);
    const N = 160, now = [];
    for (let i = 0; i <= N; i += 1) {
      const x = xmin + (xmax - xmin) * i / N;
      now.push([x, daysLeft <= 0 ? O.plAtExpiry(legs, x) : O.plAtTime(legs, x, daysLeft, ivShift, state.r, state.q)]);
    }
    let ymin = Math.min(0, ...exp.map(p => p[1]), ...now.map(p => p[1]));
    let ymax = Math.max(0, ...exp.map(p => p[1]), ...now.map(p => p[1]));
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
      ${daysLeft > 0 ? `<path class="opt-line opt-line--now" d="${path(now)}"/>` : ""}
      ${a.breakevens.filter(b => b > xmin && b < xmax).map(b => `<circle class="opt-be" cx="${X(b)}" cy="${y0}" r="4.5"/><text class="opt-be-l" x="${X(b)}" y="${y0 - 9}" text-anchor="middle">${b.toFixed(2)}</text>`).join("")}
      <line class="opt-guide" id="oGuide" y1="${pt}" y2="${H - pb}" x1="0" x2="0"/>
      <rect id="oHit" x="${pl}" y="${pt}" width="${W - pl - pr}" height="${H - pt - pb}" fill="transparent"/>`;
    view = { W, H, pl, pr, xmin, xmax, legs, daysLeft, ivShift };

    const hit = document.getElementById("oHit");
    hit.addEventListener("pointermove", hover);
    hit.addEventListener("pointerleave", () => { document.getElementById("oTip").hidden = true; document.getElementById("oGuide").style.display = "none"; });
  }

  function hover(e) {
    if (!view) return;
    const svg = document.getElementById("oChart"), r = svg.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width * view.W;
    const S = view.xmin + (px - view.pl) / (view.W - view.pl - view.pr) * (view.xmax - view.xmin);
    if (!(S >= view.xmin && S <= view.xmax)) return;
    const exp = O.plAtExpiry(view.legs, S);
    const nowV = view.daysLeft <= 0 ? exp : O.plAtTime(view.legs, S, view.daysLeft, view.ivShift, state.r, state.q);
    const g = document.getElementById("oGuide"); g.style.display = "block"; g.setAttribute("x1", px); g.setAttribute("x2", px);
    const tip = document.getElementById("oTip"); tip.hidden = false;
    tip.innerHTML = `<b>${t("opt.hoverPrice")} $${S.toFixed(2)}</b>
      <span>${t("opt.hoverExpiry")}: <em class="${exp >= 0 ? "pos" : "neg"}">${sgn(exp)}${usd(exp)}</em></span>
      ${view.daysLeft > 0 ? `<span>${t("opt.hoverDate")}: <em class="${nowV >= 0 ? "pos" : "neg"}">${sgn(nowV)}${usd(nowV)}</em></span>` : ""}`;
    const wrap = document.getElementById("oChartWrap").getBoundingClientRect();
    const left = e.clientX - wrap.left + 14, flip = left > wrap.width - 190;
    tip.style.left = (flip ? e.clientX - wrap.left - 190 : left) + "px";
    tip.style.top = Math.max(6, e.clientY - wrap.top - 20) + "px";
  }

  function greeks(legs, daysLeft, ivShift) {
    const host = document.getElementById("oGreeks");
    if (!legs.length) { host.innerHTML = ""; return; }
    const g = O.positionGreeks(legs, state.spot, daysLeft, ivShift, state.r, state.q);
    const card = (l, v, h) => `<div class="inc-card"><div class="inc-card__l">${l}</div><div class="inc-card__v">${v}</div><div class="inc-card__s">${h}</div></div>`;
    host.innerHTML = [
      card(t("opt.delta"), sgn(g.delta) + g.delta.toFixed(1), t("opt.deltaHelp")),
      card(t("opt.gamma"), sgn(g.gamma) + g.gamma.toFixed(2), t("opt.gammaHelp")),
      card(t("opt.theta"), sgn(g.theta) + usd(g.theta, 2), t("opt.thetaHelp")),
      card(t("opt.vega"), sgn(g.vega) + usd(g.vega, 2), t("opt.vegaHelp")),
    ].join("");
  }

  function heat(legs, ivShift) {
    const host = document.getElementById("oHeat");
    if (!legs.length) { host.innerHTML = ""; return; }
    const strikes = legs.filter(l => l.type !== "stock").map(l => l.strike);
    const half = state.spot * state.rangePct / 100;
    const lo = Math.max(0.01, Math.min(state.spot - half, strikes.length ? Math.min(...strikes) * 0.97 : Infinity));
    const hi = Math.max(state.spot + half, strikes.length ? Math.max(...strikes) * 1.03 : 0);
    const ROWS = 13, COLS = Math.min(7, state.days + 1);
    const prices = Array.from({ length: ROWS }, (_, i) => hi - (hi - lo) * i / (ROWS - 1));
    const cols = Array.from({ length: COLS }, (_, j) => Math.round(state.days * j / (COLS - 1 || 1)));
    const grid = prices.map(S => cols.map(d => (d >= state.days ? O.plAtExpiry(legs, S) : O.plAtTime(legs, S, state.days - d, ivShift, state.r, state.q))));
    const maxAbs = Math.max(1, ...grid.flat().map(Math.abs));
    const near = prices.reduce((b, p, i) => (Math.abs(p - state.spot) < Math.abs(prices[b] - state.spot) ? i : b), 0);
    const cell = (v) => {
      const a = Math.min(0.55, Math.abs(v) / maxAbs * 0.55);
      const bg = v >= 0 ? `rgba(52,211,153,${a.toFixed(3)})` : `rgba(248,113,113,${a.toFixed(3)})`;
      return `<td style="background:${bg}">${Math.round(v).toLocaleString("en-US")}</td>`;
    };
    host.innerHTML = `<table class="ttable opt-heat"><thead><tr><th>${t("opt.heat.price")}</th>${cols.map(d => `<th>${d === 0 ? t("opt.dateToday") : d >= state.days ? t("opt.dateExpiry") : dateIn(d)}</th>`).join("")}</tr></thead>
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
    const e = expData();
    state.legs.forEach(l => { if (l.mkt && e[l.type] && e[l.type][l.strike] && e[l.type][l.strike].iv > 0) l.iv = e[l.type][l.strike].iv; });
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
    if (state.chain && sv.expiry) {
      if (!state.chain.chain[sv.expiry]) { const s = document.getElementById("oSrc"); if (s) s.textContent = t("opt.saved.expired"); return; }
      setExpiry(sv.expiry);
    } else if (sv.days) state.days = sv.days;
    const e = expData();
    state.legs = sv.legs.map(l => {
      const q = e && l.type !== "stock" && e[l.type][l.strike];
      return { ...l, auto: false, mkt: !!(q && q.iv > 0), iv: q && q.iv > 0 ? q.iv : l.iv };
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
