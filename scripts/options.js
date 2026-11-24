/* ============================================================
   BPSQuant — Options Lab (interface)

   The arithmetic lives in optionsmath.js and is tested there. This file
   only draws and listens. The whole page is rebuilt from `state` when the
   language changes, so nothing is stored in the DOM that is not in `state`.

   Every price is picked with a slider (with a number box beside it for an
   exact value): the underlying price, volatility, days, and each leg's
   strike and expiry.
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
  const SAVE_KEY = "jss_opt_saved";

  const state = {
    symbol: "SPY", spot: SYMBOLS.SPY.spot, iv: SYMBOLS.SPY.iv, r: 0.04, q: SYMBOLS.SPY.q,
    days: 35, farDays: 70, width: 6, offset: 12, strategy: "iron_condor",
    legs: [], elapsed: 0, ivShift: 0, rangePct: 20, pnl: "$", target: 0,
  };
  let spotTouched = false;
  let spotBase = state.spot;            // the slider for the price is centred here
  let found = [];                       // last trade-finder result

  /* ---------- helpers ---------- */
  const $ = (id) => document.getElementById(id);
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
  const step = () => (state.spot < 30 ? 0.5 : 1);
  const snap = (x) => O.roundStrike(x, state.spot);
  const isCalendar = (s) => /_calendar$/.test(s);

  function defaultWidth() { return Math.max(1, Math.round(state.spot / 100)); }
  /* Short strikes sit about 3/4 of an expected move from the price. */
  function defaultOffset() { return Math.max(1, Math.round(0.75 * state.spot * state.iv * Math.sqrt(state.days / 365))); }
  function resetDistances() { state.width = defaultWidth(); state.offset = defaultOffset(); }
  function resetTarget() { state.target = snap(state.spot * 1.03); }

  /* Auto-priced legs track the model whenever an input changes; a leg whose
     price the user has typed keeps it. */
  function repriceAuto() {
    state.legs.forEach((l) => {
      if (!l.auto) return;
      if (l.type === "stock") { l.premium = round2(state.spot); l.iv = 0; return; }
      l.premium = round2(O.price(l.type, state.spot, l.strike, l.dte / 365, state.iv, state.r, state.q));
      l.iv = state.iv;
    });
  }

  /* The volatility each leg is valued with: the global one for model-priced
     legs, or whatever the typed price implies. */
  function effectiveLegs() {
    return state.legs.map((l) => {
      let iv = state.iv;
      if (l.type === "stock") iv = 0;
      else if (!l.auto) {
        const imp = O.impliedVol(l.type, l.premium, state.spot, l.strike, l.dte / 365, state.r, state.q);
        if (imp) iv = imp;
      }
      return { type: l.type, side: l.side, strike: l.strike, qty: l.qty, premium: l.premium, iv, dte: l.dte };
    });
  }

  function build(name) {
    state.strategy = name;
    if (state.farDays <= state.days) state.farDays = state.days * 2;
    state.legs = O.buildTemplate(name, state.spot, state.width, state.iv, state.days, state.r, state.q, state.offset, state.farDays);
  }

  /* ---------- page text ---------- */
  function setHero() {
    const set = (id, k) => { const e = $(id); if (e) e.textContent = t(k); };
    set("optEyebrow", "opt.eyebrow"); set("optTitle", "opt.title"); set("optLede", "opt.lede");
    document.title = t("nav.options") + " — BPSQuant";
  }

  /* A slider with a number box beside it. `id` is the number box, `id`+"R" the slider. */
  function pick(id, label, o) {
    return `<div class="opt-pick ${o.full ? "opt-pick--full" : ""}">
      <span>${label}: <b id="${id}V"></b></span>
      <div class="opt-pick__row">
        <input id="${id}R" type="range" min="${o.min}" max="${o.max}" step="${o.step}" value="${o.value}" aria-label="${label}" />
        <input id="${id}" type="number" min="${o.nmin ?? o.min}" ${o.nmax != null ? `max="${o.nmax}"` : ""} step="${o.step}" value="${o.value}" inputmode="decimal" aria-label="${label}" />
      </div></div>`;
  }

  const spotRange = () => ({ min: Math.max(0.5, snap(spotBase * 0.7)), max: snap(spotBase * 1.3) });

  /* ---------- static layout, built from state ---------- */
  function layout() {
    const sym = (s) => `<option value="${s}" ${state.symbol === s ? "selected" : ""}>${s === "CUSTOM" ? "—" : s}</option>`;
    const sr = spotRange();
    root.innerHTML = `
      <aside class="opt__side">
        <div class="panel">
          <div class="panel__head"><h2>${t("opt.under")}</h2></div>
          <div class="opt-fields">
            <label class="field opt-pick--full"><span>${t("opt.symbol")}</span>
              <select id="oSymbol">${Object.keys(SYMBOLS).map(sym).join("")}</select></label>
            ${pick("oSpot", t("opt.spot"), { min: Math.min(sr.min, state.spot), max: Math.max(sr.max, state.spot), step: step(), value: state.spot, nmin: 0.01, full: true })}
            ${pick("oIv", t("opt.iv"), { min: 5, max: 120, step: 0.5, value: round2(state.iv * 100), nmin: 1, nmax: 300, full: true })}
            ${pick("oDays", t("opt.days"), { min: 1, max: 365, step: 1, value: state.days, nmax: 1000, full: true })}
            <label class="field"><span>${t("opt.rate")}</span>
              <input id="oRate" type="number" step="0.05" min="0" max="25" value="${round2(state.r * 100)}" inputmode="decimal" /></label>
            <label class="field"><span>${t("opt.div")}</span>
              <input id="oDiv" type="number" step="0.05" min="0" max="25" value="${round2(state.q * 100)}" inputmode="decimal" /></label>
          </div>
          <p class="portal__note" style="margin:8px 0 0">${t("opt.priceNote")}</p>
        </div>

        <div class="panel">
          <div class="panel__head"><h2>${t("opt.strategy")}</h2></div>
          <label class="field"><span class="sr-only">${t("opt.strategy")}</span>
            <select id="oStrategy">${STRATEGIES.map(s => `<option value="${s}" ${state.strategy === s ? "selected" : ""}>${t("opt.s." + s)}</option>`).join("")}</select></label>
          <div class="opt-fields" style="margin-top:12px">
            ${pick("oWidth", t("opt.width"), { min: 1, max: Math.max(5, Math.round(state.spot * 0.15)), step: 1, value: state.width, nmin: 1, full: true })}
            ${pick("oOffset", t("opt.offset"), { min: 1, max: Math.max(5, Math.round(state.spot * 0.2)), step: 1, value: state.offset, nmin: 1, full: true })}
            ${isCalendar(state.strategy) ? pick("oFar", t("opt.farDays"), { min: 2, max: 365, step: 1, value: state.farDays, nmax: 1000, full: true }) : ""}
          </div>
          <div class="opt-row opt-row--end"><button class="btn btn--primary btn--sm" id="oBuild" type="button">${t("opt.build")}</button></div>
        </div>

        <div class="panel">
          <div class="panel__head"><h2>${t("opt.legs")}</h2></div>
          <div id="oLegs"></div>
          <div class="opt-row opt-row--end">
            <button class="btn btn--ghost btn--sm" id="oAdd" type="button">${t("opt.addLeg")}</button>
            <button class="btn btn--ghost btn--sm" id="oReprice" type="button">${t("opt.reprice")}</button>
            <button class="btn btn--ghost btn--sm" id="oClear" type="button">${t("opt.clear")}</button>
          </div>
          <p class="portal__note" style="margin:10px 0 0">${t("opt.modelNote")}</p>
        </div>

        <div class="panel">
          <div class="panel__head"><h2>${t("opt.saved.title")}</h2></div>
          <button class="btn btn--ghost btn--sm" id="oSave" type="button">${t("opt.saved.save")}</button>
          <div class="opt-saved" id="oSaved"></div>
          <p class="opt-note">${t("opt.saved.note")}</p>
        </div>
      </aside>

      <div class="opt__main">
        <div class="inc-cards" id="oStats"></div>

        <div class="panel">
          <div class="panel__head"><h2>${t("opt.chart.title")}</h2>
            <span class="opt-legend"><i class="opt-key opt-key--exp"></i><span id="oExpLbl"></span>
              <i class="opt-key opt-key--now"></i>${t("opt.onDate")}</span></div>
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

        <details class="panel opt-details" id="oChainBox">
          <summary><h2>${t("opt.chain.title")}</h2></summary>
          <div class="opt-details__body">
            <p class="opt-note" style="margin:0 0 10px" id="oChainSub"></p>
            <div class="table-wrap" id="oChain"></div>
          </div>
        </details>

        <div class="panel">
          <div class="panel__head"><h2>${t("opt.find.title")}</h2></div>
          <p class="opt-note" style="margin:0 0 12px">${t("opt.find.sub")}</p>
          <div class="opt-find__bar">
            ${pick("oTarget", t("opt.find.target"), { min: Math.max(0.5, snap(state.spot * 0.8)), max: snap(state.spot * 1.2), step: step(), value: state.target, nmin: 0.01 })}
            <button class="btn btn--primary btn--sm" id="oFind" type="button">${t("opt.find.btn")}</button>
          </div>
          <div class="table-wrap" id="oFound" style="margin-top:12px"><p class="opt-note">${t("opt.find.hint")}</p></div>
          <p class="opt-note">${t("opt.find.note")}</p>
        </div>

        <p class="portal__note opt-disclaimer">${t("opt.disclaimer")}</p>
      </div>`;
    bind();
    legsHtml();
    refresh();
    savedHtml();
  }

  /* ---------- legs editor ---------- */
  function legNote(l) {
    if (l.type === "stock") return "";
    if (l.auto) return t("opt.model");
    const imp = O.impliedVol(l.type, l.premium, state.spot, l.strike, l.dte / 365, state.r, state.q);
    return t("opt.manual") + (imp ? " · " + t("opt.impliedAt", { iv: round2(imp * 100) }) : "");
  }
  const strikeText = (l) => "$" + l.strike + " · " + (l.strike >= state.spot ? "+" : "−") + Math.abs((l.strike / state.spot - 1) * 100).toFixed(1) + "%";
  const expText = (l) => t("opt.expIn", { n: l.dte, date: dateIn(l.dte) });
  function strikeBounds(l) {
    return { min: Math.min(l.strike, Math.max(step(), snap(state.spot * 0.75))), max: Math.max(l.strike, snap(state.spot * 1.25)) };
  }

  function legsHtml() {
    const host = $("oLegs");
    if (!host) return;
    if (!state.legs.length) { host.innerHTML = `<p class="portal__note" style="margin:0">${t("opt.empty")}</p>`; return; }
    host.innerHTML = state.legs.map((l, i) => {
      const stock = l.type === "stock", b = strikeBounds(l);
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
          ${stock ? "" : `
          <div>
            <span class="opt-leg__lbl">${t("opt.strike")}: <b data-o="strike">${strikeText(l)}</b></span>
            <div class="opt-pick__row">
              <input type="range" data-f="strike" min="${b.min}" max="${b.max}" step="${step()}" value="${l.strike}" aria-label="${t("opt.strike")}" />
              <input type="number" data-f="strike" step="${step()}" min="0.01" value="${l.strike}" inputmode="decimal" aria-label="${t("opt.strike")}" />
            </div>
          </div>
          <div>
            <span class="opt-leg__lbl"><b data-o="exp">${expText(l)}</b></span>
            <input type="range" data-f="dte" min="1" max="365" step="1" value="${l.dte}" aria-label="${t("opt.expiry")}" />
          </div>`}
          <div class="opt-leg__price">
            <label>${t("opt.premium")} <input data-f="premium" type="number" step="0.01" min="0" value="${l.premium}" inputmode="decimal" /></label>
            <span class="opt-leg__note" data-o="note">${legNote(l)}</span>
          </div>
        </div>`;
    }).join("");
  }

  /* ---------- events ---------- */
  /* Keep a slider and its number box in step, whichever one moved. */
  function syncPair(id, v) { const a = $(id), b = $(id + "R"); if (a && a !== document.activeElement) a.value = v; if (b) b.value = v; }

  function bind() {
    const onInput = (keep) => {
      const oldDays = state.days;
      state.spot = Math.max(0.01, num($("oSpot").value, state.spot));
      state.iv = Math.min(3, Math.max(0.01, num($("oIv").value, state.iv * 100) / 100));
      state.days = Math.min(1000, Math.max(1, Math.round(num($("oDays").value, state.days))));
      state.r = Math.max(0, num($("oRate").value, state.r * 100) / 100);
      state.q = Math.max(0, num($("oDiv").value, state.q * 100) / 100);
      if (state.days !== oldDays) state.legs.forEach((l) => { if (l.dte === oldDays) l.dte = state.days; });
      repriceAuto();
      if (keep !== "legs") legsHtml(); else refreshLegsInPlace();
      refresh();
    };
    const label = () => {
      $("oSpotV").textContent = "$" + state.spot;
      $("oIvV").textContent = round2(state.iv * 100) + "%";
      $("oDaysV").textContent = state.days + " · " + dateIn(state.days);
    };

    // paired slider + box for the underlying
    [["oSpot", 0], ["oIv", 0], ["oDays", 0]].forEach(([id]) => {
      $(id + "R").addEventListener("input", (e) => {
        if (id === "oSpot") spotTouched = true;
        $(id).value = e.target.value; onInput("legs"); label();
      });
      $(id).addEventListener("input", (e) => {
        if (id === "oSpot") { spotTouched = true; const v = num(e.target.value, 0); if (v > 0 && (v < spotBase * 0.7 || v > spotBase * 1.3)) { spotBase = v; const r = $("oSpotR"), sr = spotRange(); r.min = Math.min(sr.min, v); r.max = Math.max(sr.max, v); } }
        $(id + "R").value = e.target.value; onInput("legs"); label();
      });
    });
    ["oRate", "oDiv"].forEach((id) => $(id).addEventListener("input", () => onInput("legs")));
    label();

    $("oSymbol").addEventListener("change", (e) => {
      const d = SYMBOLS[e.target.value]; state.symbol = e.target.value;
      state.spot = d.spot; spotBase = d.spot; state.iv = d.iv; state.q = d.q; resetDistances(); resetTarget(); spotTouched = false; found = [];
      build(state.strategy); layout(); loadQuote();
    });
    $("oStrategy").addEventListener("change", (e) => { build(e.target.value); layout(); });

    // the strategy's own shape: rebuild when the Build button is pressed
    const linked = (id, key, min) => {
      const apply = (v) => { state[key] = Math.max(min, Math.round(v)); };
      $(id + "R").addEventListener("input", (e) => { $(id).value = e.target.value; apply(num(e.target.value, state[key])); $(id + "V").textContent = state[key]; });
      $(id).addEventListener("input", (e) => { $(id + "R").value = e.target.value; apply(num(e.target.value, state[key])); $(id + "V").textContent = state[key]; });
      $(id + "V").textContent = state[key];
    };
    linked("oWidth", "width", 1); linked("oOffset", "offset", 1);
    if ($("oFar")) linked("oFar", "farDays", 2);
    $("oBuild").addEventListener("click", () => { build(state.strategy); layout(); });
    $("oAdd").addEventListener("click", () => {
      state.legs.push({ type: "call", side: 1, strike: snap(state.spot), qty: 1, premium: 0, iv: state.iv, dte: state.days, auto: true });
      repriceAuto(); legsHtml(); refresh();
    });
    $("oReprice").addEventListener("click", () => { state.legs.forEach(l => { l.auto = true; }); repriceAuto(); legsHtml(); refresh(); });
    $("oClear").addEventListener("click", () => { state.legs = []; legsHtml(); refresh(); });

    // one listener for every field of every leg
    const legs = $("oLegs");
    legs.addEventListener("input", legChange);
    legs.addEventListener("change", legChange);
    legs.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-f]");
      if (!b) return;
      const i = +b.closest(".opt-leg").dataset.i, l = state.legs[i];
      if (b.dataset.f === "remove") { state.legs.splice(i, 1); legsHtml(); refresh(); }
      else if (b.dataset.f === "qtyUp" || b.dataset.f === "qtyDown") {
        l.qty = Math.max(1, l.qty + (b.dataset.f === "qtyUp" ? 1 : -1));
        b.parentElement.querySelector("input").value = l.qty; refresh();
      }
    });

    $("oElapsed").addEventListener("input", (e) => { state.elapsed = Math.round(num(e.target.value, 0)); refresh(); });
    $("oIvShift").addEventListener("input", (e) => { state.ivShift = num(e.target.value, 0); refresh(); });
    $("oRange").addEventListener("input", (e) => { state.rangePct = num(e.target.value, 20); refresh(); });
    document.querySelectorAll("[data-pnl]").forEach((b) => b.addEventListener("click", () => {
      state.pnl = b.dataset.pnl;
      document.querySelectorAll("[data-pnl]").forEach(x => x.classList.toggle("is-on", x === b));
      refresh();
    }));

    // trade finder
    const tg = (v) => { state.target = Math.max(0.01, num(v, state.target)); $("oTargetV").textContent = "$" + state.target; };
    $("oTargetR").addEventListener("input", (e) => { $("oTarget").value = e.target.value; tg(e.target.value); });
    $("oTarget").addEventListener("input", (e) => { $("oTargetR").value = e.target.value; tg(e.target.value); });
    tg(state.target);
    $("oFind").addEventListener("click", runFinder);
    $("oFound").addEventListener("click", (e) => {
      const b = e.target.closest("[data-open]"); if (!b) return;
      const f = found[+b.dataset.open]; if (!f) return;
      state.legs = f.legs.map(l => ({ type: l.type, side: l.side, strike: l.strike, qty: 1, premium: l.premium, iv: state.iv, dte: state.days, auto: true }));
      legsHtml(); refresh(); root.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    $("oSave").addEventListener("click", saveCurrent);
    $("oSaved").addEventListener("click", onSavedClick);
    $("oChainBox").addEventListener("toggle", chainHtml);
    $("oChain").addEventListener("click", (e) => {
      const b = e.target.closest("[data-add]"); if (!b) return;
      state.legs.push({ type: b.dataset.type, side: +b.dataset.add, strike: +b.dataset.k, qty: 1, premium: 0, iv: state.iv, dte: state.days, auto: true });
      repriceAuto(); legsHtml(); refresh();
    });
  }

  /* After the underlying moves, update each leg's price and note without
     rebuilding the rows, so a slider being dragged is not interrupted. */
  function refreshLegsInPlace() {
    document.querySelectorAll("#oLegs .opt-leg").forEach((row) => {
      const l = state.legs[+row.dataset.i]; if (!l) return;
      const p = row.querySelector("[data-f=premium]"); if (p && p !== document.activeElement) p.value = l.premium;
      const n = row.querySelector("[data-o=note]"); if (n) n.textContent = legNote(l);
      const s = row.querySelector("[data-o=strike]"); if (s) s.textContent = strikeText(l);
      const d = row.querySelector("input[data-f=dte]"); if (d) d.value = l.dte;
      const x = row.querySelector("[data-o=exp]"); if (x) x.textContent = expText(l);
    });
  }

  function legChange(e) {
    const f = e.target.dataset.f; if (!f || f === "remove" || f.startsWith("qty") && e.target.tagName === "BUTTON") return;
    const row = e.target.closest(".opt-leg"); const l = state.legs[+row.dataset.i]; if (!l) return;
    if (f === "side") l.side = +e.target.value > 0 ? 1 : -1;
    else if (f === "type") {
      l.type = e.target.value;
      if (l.type === "stock") { l.strike = 0; l.auto = true; } else if (!l.strike) l.strike = snap(state.spot);
      repriceAuto(); legsHtml(); refresh(); return;
    }
    else if (f === "qty") l.qty = Math.max(1, Math.round(num(e.target.value, 1)));
    else if (f === "strike") {
      l.strike = Math.max(0.01, num(e.target.value, l.strike));
      row.querySelectorAll("[data-f=strike]").forEach((x) => { if (x !== e.target && x !== document.activeElement) x.value = l.strike; });
      const rg = row.querySelector("input[type=range][data-f=strike]");
      if (rg && (l.strike < +rg.min || l.strike > +rg.max)) { const b = strikeBounds(l); rg.min = b.min; rg.max = b.max; rg.value = l.strike; }
      if (l.auto) repriceAuto();
    }
    else if (f === "dte") {
      l.dte = Math.max(1, Math.round(num(e.target.value, l.dte)));
      const x = row.querySelector("[data-o=exp]"); if (x) x.textContent = expText(l);
      if (l.auto) repriceAuto();
    }
    else if (f === "premium") { l.premium = Math.max(0, num(e.target.value, 0)); l.auto = false; }
    // keep what the row shows in step with the model
    const p = row.querySelector("[data-f=premium]"); if (p && f !== "premium" && l.auto) p.value = l.premium;
    const n = row.querySelector("[data-o=note]"); if (n) n.textContent = legNote(l);
    const s = row.querySelector("[data-o=strike]"); if (s && l.type !== "stock") s.textContent = strikeText(l);
    refresh();
  }

  /* ---------- everything that depends on the position ---------- */
  function refresh() {
    if (!$("oStats")) return;
    const legs = effectiveLegs();
    const hz = O.horizonDays(legs, state.days);
    const mixed = O.isMixed(legs, state.days);
    state.elapsed = Math.min(state.elapsed, hz);
    const ivShift = state.ivShift / 100;

    const el = $("oElapsed"); el.max = hz; el.value = state.elapsed;
    $("oDateLbl").textContent =
      (state.elapsed === 0 ? t("opt.dateToday") : state.elapsed >= hz ? (mixed ? t("opt.atFirst") : t("opt.dateExpiry")) : t("opt.inDays", { n: state.elapsed })) + " · " + dateIn(state.elapsed);
    $("oIvLbl").textContent = (state.ivShift > 0 ? "+" : "") + state.ivShift + " " + (I.lang === "vi" ? "điểm" : "pts");
    $("oRangeLbl").textContent = "±" + state.rangePct + "%";
    $("oExpLbl").textContent = mixed ? t("opt.atFirst") : t("opt.atExpiry");
    $("oMixed").hidden = !mixed;

    const a = O.analyze(legs, { spot: state.spot, days: hz, r: state.r, q: state.q, iv: state.iv });
    stats(a);
    chart(legs, a, hz, ivShift);
    greeks(legs, ivShift);
    heat(legs, a, hz, ivShift);
    chainSub();
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

  function chart(legs, a, hz, ivShift) {
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
    const showNow = state.elapsed < hz;
    const now = showNow ? xs.map(x => [x, at(x, state.elapsed, ivShift)]) : [];
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
      ${showNow ? `<path class="opt-line opt-line--now" d="${path(now)}"/>` : ""}
      ${a.breakevens.filter(b => b > xmin && b < xmax).map(b => `<circle class="opt-be" cx="${X(b)}" cy="${y0}" r="4.5"/><text class="opt-be-l" x="${X(b)}" y="${y0 - 9}" text-anchor="middle">${b.toFixed(2)}</text>`).join("")}
      <line class="opt-guide" id="oGuide" y1="${pt}" y2="${H - pb}" x1="0" x2="0"/>
      <rect id="oHit" x="${pl}" y="${pt}" width="${W - pl - pr}" height="${H - pt - pb}" fill="transparent"/>`;
    view = { W, H, pl, pr, xmin, xmax, legs, hz, ivShift, at };

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
    const showNow = state.elapsed < view.hz;
    const nowV = showNow ? view.at(S, state.elapsed, view.ivShift) : exp;
    const g = $("oGuide"); g.style.display = "block"; g.setAttribute("x1", px); g.setAttribute("x2", px);
    const tip = $("oTip"); tip.hidden = false;
    tip.innerHTML = `<b>${t("opt.hoverPrice")} $${S.toFixed(2)}</b>
      <span>${t("opt.hoverExpiry")}: <em class="${exp >= 0 ? "pos" : "neg"}">${sgn(exp)}${usd(exp)}</em></span>
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

  /* ---------- option chain (model prices) ---------- */
  function chainSub() {
    const e = $("oChainSub"); if (e) e.textContent = t("opt.chain.sub", { n: state.days });
    if ($("oChainBox") && $("oChainBox").open) chainHtml();
  }
  function chainHtml() {
    const box = $("oChainBox"), host = $("oChain");
    if (!box || !host || !box.open) return;
    const raw = state.spot * 0.16 / 20;
    const stride = [0.5, 1, 2, 5, 10, 25].find(x => x >= raw * 0.8) || 25;
    const atm = Math.round(state.spot / stride) * stride;
    const T = state.days / 365;
    const rows = [];
    for (let i = -10; i <= 10; i += 1) {
      const k = atm + i * stride; if (k <= 0) continue;
      const row = { k };
      ["call", "put"].forEach((ty) => {
        row[ty] = O.price(ty, state.spot, k, T, state.iv, state.r, state.q);
        row[ty + "D"] = O.greeks(ty, state.spot, k, T, state.iv, state.r, state.q).delta;
      });
      rows.push(row);
    }
    const bs = (ty, k) => `<span class="bs"><button type="button" data-add="1" data-type="${ty}" data-k="${k}">${t("opt.buy")}</button><button type="button" data-add="-1" data-type="${ty}" data-k="${k}">${t("opt.sell")}</button></span>`;
    host.innerHTML = `<table class="opt-chain"><thead>
      <tr><th colspan="3" style="text-align:center">${t("opt.chain.calls")}</th><th></th><th colspan="3" style="text-align:center">${t("opt.chain.puts")}</th></tr>
      <tr><th></th><th>${t("opt.premium")}</th><th>Δ</th><th style="text-align:center">${t("opt.strike")}</th><th>Δ</th><th>${t("opt.premium")}</th><th></th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="${r.k < state.spot ? "itm-c" : "itm-p"}${r.k === atm ? " is-atm" : ""}">
        <td class="c">${bs("call", r.k)}</td><td class="c">${r.call.toFixed(2)}</td><td class="c">${r.callD.toFixed(2)}</td>
        <td class="k">${r.k}</td>
        <td class="p">${r.putD.toFixed(2)}</td><td class="p">${r.put.toFixed(2)}</td><td class="p">${bs("put", r.k)}</td></tr>`).join("")}
      </tbody></table>`;
  }

  /* ---------- trade finder ---------- */
  function runFinder() {
    const host = $("oFound");
    found = O.optimize({ spot: state.spot, target: state.target, days: state.days, iv: state.iv, r: state.r, q: state.q, top: 15 });
    if (!found.length) { host.innerHTML = `<p class="opt-note">${t("opt.find.none")}</p>`; return; }
    host.innerHTML = `<table class="opt-find"><thead><tr>
      <th>${t("opt.strategy")}</th><th>${t("opt.find.cost")}</th><th>${t("opt.maxLoss")}</th><th>${t("opt.maxProfit")}</th>
      <th>${t("opt.find.atTarget")}</th><th>${t("opt.find.ret")}</th><th>${t("opt.pop")}</th><th></th></tr></thead><tbody>
      ${found.map((f, i) => `<tr><td>${t("opt.s." + f.kind)} ${f.strikes.join("/")}</td>
        <td>${usd(f.cost, 0)}</td><td class="neg">${usd(f.maxLoss, 0)}</td><td class="pos">${usd(f.maxProfit, 0)}</td>
        <td class="pos">${usd(f.pl, 0)}</td><td><b>${Math.round(f.ret * 100)}%</b></td>
        <td>${f.pop == null ? "—" : Math.round(f.pop * 100) + "%"}</td>
        <td><button class="btn btn--ghost btn--sm" type="button" data-open="${i}">${t("opt.find.open")}</button></td></tr>`).join("")}
      </tbody></table>`;
  }

  /* ---------- saved strategies (this browser only) ---------- */
  function readSaved() { try { const v = JSON.parse(localStorage.getItem(SAVE_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (_) { return []; } }
  function writeSaved(list) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(list.slice(0, 30))); } catch (_) { /* private mode: keep going */ } }
  const clean = (x) => String(x == null ? "" : x).replace(/[<>&"']/g, "");

  function saveCurrent() {
    if (!state.legs.length) return;
    const name = clean(state.symbol === "CUSTOM" ? "—" : state.symbol) + " " + t("opt.s." + state.strategy) + " · " + dateIn(0);
    const item = {
      name, at: Date.now(), symbol: state.symbol, strategy: state.strategy,
      spot: state.spot, iv: state.iv, r: state.r, q: state.q, days: state.days,
      // saved at fixed prices, so a loaded strategy shows profit since entry
      legs: state.legs.map(l => ({ type: l.type, side: l.side, strike: l.strike, qty: l.qty, premium: l.premium, iv: l.iv, dte: l.dte, auto: false })),
    };
    writeSaved([item, ...readSaved()]);
    savedHtml();
    const b = $("oSave"); if (b) { const old = b.textContent; b.textContent = t("opt.saved.done"); setTimeout(() => { if ($("oSave")) $("oSave").textContent = old; }, 1400); }
  }
  function savedHtml() {
    const host = $("oSaved"); if (!host) return;
    const list = readSaved();
    host.innerHTML = list.length ? list.map((s, i) => `
      <div class="opt-saved__row"><span title="${clean(s.name)}">${clean(s.name)}</span>
        <span class="opt-saved__btns">
          <button class="btn btn--ghost btn--sm" type="button" data-load="${i}">${t("opt.saved.load")}</button>
          <button class="btn btn--ghost btn--sm" type="button" data-del="${i}" aria-label="${t("opt.saved.del")}">×</button></span></div>`).join("")
      : `<p class="opt-note" style="margin:0">${t("opt.saved.empty")}</p>`;
  }
  function onSavedClick(e) {
    const b = e.target.closest("button"); if (!b) return;
    const list = readSaved();
    if (b.dataset.del != null) { list.splice(+b.dataset.del, 1); writeSaved(list); savedHtml(); return; }
    const s = list[+b.dataset.load]; if (!s) return;
    const ok = (v) => typeof v === "number" && isFinite(v);
    if (!ok(s.spot) || !ok(s.iv) || !Array.isArray(s.legs)) return;
    state.symbol = SYMBOLS[s.symbol] ? s.symbol : "CUSTOM";
    state.strategy = STRATEGIES.includes(s.strategy) ? s.strategy : state.strategy;
    state.spot = s.spot; spotBase = s.spot; state.iv = s.iv; state.r = ok(s.r) ? s.r : state.r; state.q = ok(s.q) ? s.q : state.q;
    state.days = ok(s.days) ? s.days : state.days; spotTouched = true;
    state.legs = s.legs.filter(l => ["call", "put", "stock"].includes(l.type) && ok(l.premium) && ok(l.qty))
      .map(l => ({ type: l.type, side: l.side < 0 ? -1 : 1, strike: ok(l.strike) ? l.strike : 0, qty: Math.max(1, Math.round(l.qty)), premium: l.premium, iv: ok(l.iv) ? l.iv : s.iv, dte: ok(l.dte) ? l.dte : state.days, auto: false }));
    state.elapsed = 0; resetTarget(); found = [];
    layout();
  }

  /* ---------- start ---------- */
  /* A latest close is a better starting point than a made-up one, but it can
     be delayed or sample data, and the page says to set it to the broker's
     quote. Never overwrite a price the visitor has already typed. */
  async function loadQuote() {
    try {
      if (!window.JSS || !window.JSS.getQuote || state.symbol === "CUSTOM") return;
      const q = await window.JSS.getQuote(state.symbol, 5);
      const close = q && +q.close;
      if (!spotTouched && isFinite(close) && close > 1) {
        state.spot = round2(close); spotBase = state.spot; resetDistances(); resetTarget();
        build(state.strategy); layout();
      }
    } catch (_) { /* keep the placeholder */ }
  }

  resetDistances();
  resetTarget();
  build(state.strategy);
  setHero();
  layout();
  I.onChange(() => { setHero(); layout(); });
  loadQuote();
})();
