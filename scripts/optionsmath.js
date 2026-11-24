/* ============================================================
   BPSQuant — options pricing and strategy analysis

   Pure arithmetic, no DOM, so it can be tested against known values.

     Black-Scholes-Merton for European options with a continuous
     dividend yield. SPY, QQQ and DIA options are American-style, so
     these are theoretical values: close for calls on low-dividend
     underlyings and for most puts away from deep in-the-money, but
     not a substitute for a market quote.

   A leg:  { type: "call" | "put" | "stock",
             side: 1 (buy) | -1 (sell),
             strike, qty, premium, iv }
     qty is contracts for options and 100-share lots for stock, so
     every leg is multiplied by 100.

   All legs of a position share one expiry. A calendar or diagonal
   spread is out of scope: its "at expiry" curve is not piecewise
   linear and the exact breakeven and probability maths below would
   not hold.

   window.JSSOptions
   ============================================================ */
(function (global) {
  "use strict";

  const SQRT2PI = Math.sqrt(2 * Math.PI);
  const MULT = 100;

  /* ---------- normal distribution ---------- */
  function pdf(x) { return Math.exp(-0.5 * x * x) / SQRT2PI; }

  // Marsaglia's series for the standard normal CDF. Accurate to double
  // precision, and cheap enough to call tens of thousands of times a frame.
  function cdf(x) {
    if (x < -8.5) return 0;
    if (x > 8.5) return 1;
    let s = x, t = 0, b = x, i = 1;
    const q = x * x;
    for (let n = 0; s !== t && n < 600; n += 1) { t = s; i += 2; b *= q / i; s = t + b; }
    return 0.5 + s * Math.exp(-0.5 * q - 0.91893853320467274178);
  }

  /* ---------- Black-Scholes-Merton ---------- */
  function d1d2(S, K, T, sigma, r, q) {
    const v = sigma * Math.sqrt(T);
    const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / v;
    return [d1, d1 - v];
  }

  /* Theoretical price per share. type is "call", "put" or "stock". */
  function price(type, S, K, T, sigma, r, q) {
    r = r || 0; q = q || 0;
    if (type === "stock") return S;
    if (!(S > 0)) return type === "put" ? Math.max(K * Math.exp(-r * T), 0) : 0;
    if (!(T > 0)) return type === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0);
    if (!(sigma > 0)) {                                     // no volatility: discounted forward intrinsic
      const fwd = S * Math.exp(-q * T), k = K * Math.exp(-r * T);
      return type === "call" ? Math.max(fwd - k, 0) : Math.max(k - fwd, 0);
    }
    const [d1, d2] = d1d2(S, K, T, sigma, r, q);
    const eq = Math.exp(-q * T), er = Math.exp(-r * T);
    return type === "call"
      ? S * eq * cdf(d1) - K * er * cdf(d2)
      : K * er * cdf(-d2) - S * eq * cdf(-d1);
  }

  /* Greeks per share. theta is per calendar day, vega per 1 volatility
     point (0.01), the conventions a trader reads off a platform. */
  function greeks(type, S, K, T, sigma, r, q) {
    r = r || 0; q = q || 0;
    if (type === "stock") return { delta: 1, gamma: 0, theta: 0, vega: 0 };
    if (!(T > 0) || !(sigma > 0) || !(S > 0)) {
      const itm = type === "call" ? S > K : S < K;
      return { delta: itm ? (type === "call" ? 1 : -1) : 0, gamma: 0, theta: 0, vega: 0 };
    }
    const [d1, d2] = d1d2(S, K, T, sigma, r, q);
    const eq = Math.exp(-q * T), er = Math.exp(-r * T), sq = Math.sqrt(T), phi = pdf(d1);
    const common = -(S * eq * phi * sigma) / (2 * sq);
    const theta = type === "call"
      ? common - r * K * er * cdf(d2) + q * S * eq * cdf(d1)
      : common + r * K * er * cdf(-d2) - q * S * eq * cdf(-d1);
    return {
      delta: type === "call" ? eq * cdf(d1) : eq * (cdf(d1) - 1),
      gamma: (eq * phi) / (S * sigma * sq),
      theta: theta / 365,
      vega: (S * eq * phi * sq) / 100,
    };
  }

  /* The volatility that makes the model price equal a quoted premium, by
     bisection (price is monotonic in volatility). null when no volatility
     can: a premium at or below intrinsic value, or above the upper bound. */
  function impliedVol(type, premium, S, K, T, r, q) {
    if (type === "stock" || !(T > 0) || !(premium > 0)) return null;
    let lo = 0.0005, hi = 5;
    if (price(type, S, K, T, lo, r, q) > premium + 1e-9) return null;
    if (price(type, S, K, T, hi, r, q) < premium - 1e-9) return null;
    for (let n = 0; n < 80; n += 1) {
      const mid = (lo + hi) / 2;
      if (price(type, S, K, T, mid, r, q) < premium) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /* ---------- a position ---------- */
  const legMult = (l) => l.side * l.qty * MULT;

  function legExpiryValue(l, S) {
    if (l.type === "call") return Math.max(S - l.strike, 0);
    if (l.type === "put") return Math.max(l.strike - S, 0);
    return S;
  }

  /* Profit or loss in dollars at expiry. */
  function plAtExpiry(legs, S) {
    let t = 0;
    for (const l of legs) t += legMult(l) * (legExpiryValue(l, S) - l.premium);
    return t;
  }

  /* Profit or loss in dollars with `daysLeft` days still to run.
     ivShift is added to every leg's volatility (0.05 = five points). */
  function plAtTime(legs, S, daysLeft, ivShift, r, q) {
    const T = Math.max(daysLeft, 0) / 365;
    let t = 0;
    for (const l of legs) {
      const sig = Math.max((l.iv || 0) + (ivShift || 0), 0.01);
      t += legMult(l) * (price(l.type, S, l.strike, T, sig, r, q) - l.premium);
    }
    return t;
  }

  /* Net greeks of the whole position, in position units: delta is
     share-equivalents, theta is dollars per day, vega dollars per point. */
  function positionGreeks(legs, S, daysLeft, ivShift, r, q) {
    const T = Math.max(daysLeft, 0) / 365;
    const out = { delta: 0, gamma: 0, theta: 0, vega: 0 };
    for (const l of legs) {
      const sig = Math.max((l.iv || 0) + (ivShift || 0), 0.01);
      const g = greeks(l.type, S, l.strike, T, sig, r, q);
      const m = legMult(l);
      out.delta += m * g.delta; out.gamma += m * g.gamma;
      out.theta += m * g.theta; out.vega += m * g.vega;
    }
    return out;
  }

  /* Cash taken in (positive) or paid out (negative) when the position opens. */
  function netCash(legs) {
    return legs.reduce((a, l) => a - legMult(l) * l.premium, 0);
  }

  /* ---------- exact analysis of the expiry curve ----------
     At expiry every leg is piecewise linear in S, bending only at the
     strikes. So the extremes sit at S = 0 or a strike, the breakevens are
     found by interpolating between those points, and past the last strike
     the curve is a straight ray whose slope says whether it is unbounded. */
  function analyze(legs, opts) {
    opts = opts || {};
    if (!legs || !legs.length) {
      return { netCash: 0, maxProfit: 0, maxLoss: 0, unlimitedProfit: false, unlimitedLoss: false, breakevens: [], pop: null };
    }
    const strikes = [...new Set(legs.filter(l => l.type !== "stock").map(l => l.strike))].sort((a, b) => a - b);
    const pts = [0, ...strikes];
    const f = (S) => plAtExpiry(legs, S);
    const slopeInf = legs.reduce((a, l) => a + (l.type === "put" ? 0 : legMult(l)), 0);

    let maxP = -Infinity, maxL = Infinity;
    for (const S of pts) { const v = f(S); if (v > maxP) maxP = v; if (v < maxL) maxL = v; }
    const unlimitedProfit = slopeInf > 1e-9;
    const unlimitedLoss = slopeInf < -1e-9;

    // Breakevens: sign changes between consecutive bend points, then the ray.
    const roots = [];
    const addRoot = (x) => { if (x >= 0 && !roots.some(r => Math.abs(r - x) < 1e-7)) roots.push(x); };
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[i], fa = f(a);
      if (Math.abs(fa) < 1e-9) addRoot(a);
      if (i + 1 < pts.length) {
        const b = pts[i + 1], fb = f(b);
        if ((fa < -1e-9 && fb > 1e-9) || (fa > 1e-9 && fb < -1e-9)) addRoot(a + (0 - fa) * (b - a) / (fb - fa));
      }
    }
    const last = pts[pts.length - 1], fLast = f(last);
    if (Math.abs(slopeInf) > 1e-9) {
      const x = last - fLast / slopeInf;
      if (x > last + 1e-9) addRoot(x);
    }
    roots.sort((a, b) => a - b);

    // Chance of profit: sum the lognormal probability of every interval on
    // which the expiry curve is above zero.
    let pop = null;
    const days = opts.days, S0 = opts.spot;
    if (isFinite(days) && isFinite(S0) && S0 > 0) {
      const T = days / 365;
      const sigs = legs.filter(l => l.type !== "stock").map(l => l.iv).filter(v => v > 0);
      const sigma = sigs.length ? sigs.reduce((a, b) => a + b, 0) / sigs.length : (opts.iv || 0.2);
      if (!(T > 0)) pop = f(S0) > 1e-9 ? 1 : 0;
      else {
        const mu = (opts.r || 0) - (opts.q || 0) - 0.5 * sigma * sigma;
        const F = (x) => x <= 0 ? 0 : cdf((Math.log(x / S0) - mu * T) / (sigma * Math.sqrt(T)));
        const cuts = [...new Set([0, ...strikes, ...roots])].sort((a, b) => a - b);
        let p = 0;
        for (let i = 0; i < cuts.length; i += 1) {
          const a = cuts[i], b = i + 1 < cuts.length ? cuts[i + 1] : Infinity;
          const mid = isFinite(b) ? (a + b) / 2 : a + Math.max(1, a * 0.1);
          if (f(mid) > 1e-9) p += (isFinite(b) ? F(b) : 1) - F(a);
        }
        pop = Math.min(1, Math.max(0, p));
      }
    }

    return {
      netCash: netCash(legs),
      maxProfit: unlimitedProfit ? Infinity : maxP,
      maxLoss: unlimitedLoss ? -Infinity : maxL,
      unlimitedProfit, unlimitedLoss,
      breakevens: roots,
      pop,
    };
  }

  /* ---------- strategy templates ----------
     Strikes are built around the at-the-money strike. `w` is the distance
     between strikes in dollars. Premiums are filled in by the caller. */
  const STRIKE_STEP = (S) => (S < 30 ? 0.5 : 1);
  const roundStrike = (x, S) => Math.max(STRIKE_STEP(S), Math.round(x / STRIKE_STEP(S)) * STRIKE_STEP(S));

  /* a = at-the-money strike, w = spread (wing) width, o = how far the short
     strike sits from the price. With o = w the strikes are evenly spaced. */
  const TEMPLATES = {
    long_call:        (a, w, o) => [["call", 1, a]],
    long_put:         (a, w, o) => [["put", 1, a]],
    covered_call:     (a, w, o) => [["stock", 1, 0], ["call", -1, a + o]],
    cash_secured_put: (a, w, o) => [["put", -1, a - o]],
    bull_call_spread: (a, w, o) => [["call", 1, a], ["call", -1, a + w]],
    bear_put_spread:  (a, w, o) => [["put", 1, a], ["put", -1, a - w]],
    bull_put_spread:  (a, w, o) => [["put", -1, a - o], ["put", 1, a - o - w]],
    bear_call_spread: (a, w, o) => [["call", -1, a + o], ["call", 1, a + o + w]],
    iron_condor:      (a, w, o) => [["put", 1, a - o - w], ["put", -1, a - o], ["call", -1, a + o], ["call", 1, a + o + w]],
    iron_butterfly:   (a, w, o) => [["put", 1, a - w], ["put", -1, a], ["call", -1, a], ["call", 1, a + w]],
    long_straddle:    (a, w, o) => [["call", 1, a], ["put", 1, a]],
    short_straddle:   (a, w, o) => [["call", -1, a], ["put", -1, a]],
    long_strangle:    (a, w, o) => [["put", 1, a - o], ["call", 1, a + o]],
    long_butterfly:   (a, w, o) => [["call", 1, a - w], ["call", -2, a], ["call", 1, a + w]],
  };

  /* Legs for a template, priced by the model at the given volatility. */
  function buildTemplate(name, spot, width, iv, days, r, q, offset) {
    const make = TEMPLATES[name];
    if (!make) return [];
    const atm = roundStrike(spot, spot);
    const w = Math.max(width || STRIKE_STEP(spot), STRIKE_STEP(spot));
    const o = offset > 0 ? offset : w;
    const T = days / 365;
    return make(atm, w, o).map(([type, side, k]) => {
      const strike = type === "stock" ? 0 : roundStrike(k, spot);
      const qty = Math.abs(side) === 2 ? 2 : 1;
      const prem = type === "stock" ? spot : Math.round(price(type, spot, strike, T, iv, r, q) * 100) / 100;
      return { type, side: side > 0 ? 1 : -1, strike, qty, premium: prem, iv: type === "stock" ? 0 : iv, auto: true };
    });
  }

  global.JSSOptions = {
    cdf, pdf, price, greeks, impliedVol,
    plAtExpiry, plAtTime, positionGreeks, netCash, analyze,
    buildTemplate, TEMPLATES, roundStrike, MULT,
  };
})(typeof window !== "undefined" ? window : globalThis);
