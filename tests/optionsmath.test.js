// Pricing and strategy maths, checked against published values and against
// independent identities rather than against the module's own output.
const test = require("node:test");
const assert = require("node:assert/strict");
require("../scripts/optionsmath.js");
const O = globalThis.JSSOptions;
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ""} ${a} vs ${b} (tol ${tol})`);

test("normal CDF matches published values", () => {
  near(O.cdf(0), 0.5, 1e-12);
  near(O.cdf(1), 0.8413447460685429, 1e-12);
  near(O.cdf(1.96), 0.9750021048517795, 1e-12);
  near(O.cdf(-1.96), 0.024997895148220435, 1e-12);
  assert.equal(O.cdf(-40), 0); assert.equal(O.cdf(40), 1);
});

test("Black-Scholes reproduces the textbook example (Hull)", () => {
  // S=100 K=100 T=1 sigma=20% r=5%, no dividend: call 10.4506, put 5.5735
  near(O.price("call", 100, 100, 1, 0.2, 0.05, 0), 10.4506, 5e-4);
  near(O.price("put", 100, 100, 1, 0.2, 0.05, 0), 5.5735, 5e-4);
});

test("put-call parity holds, with a dividend yield and across strikes", () => {
  for (const K of [70, 90, 100, 115, 140]) {
    const S = 100, T = 0.42, sig = 0.27, r = 0.031, q = 0.017;
    const c = O.price("call", S, K, T, sig, r, q), p = O.price("put", S, K, T, sig, r, q);
    near(c - p, S * Math.exp(-q * T) - K * Math.exp(-r * T), 1e-9, `K=${K}`);
  }
});

test("prices collapse to intrinsic value at expiry, and never go negative", () => {
  assert.equal(O.price("call", 105, 100, 0, 0.2, 0.05, 0), 5);
  assert.equal(O.price("put", 105, 100, 0, 0.2, 0.05, 0), 0);
  assert.equal(O.price("put", 90, 100, 0, 0.2, 0.05, 0), 10);
  for (const K of [50, 100, 200]) for (const T of [0.001, 0.1, 2]) {
    assert.ok(O.price("call", 100, K, T, 0.3, 0.04, 0) >= 0);
    assert.ok(O.price("put", 100, K, T, 0.3, 0.04, 0) >= 0);
  }
});

test("greeks agree with finite differences of the price", () => {
  const S = 100, K = 105, T = 0.3, sig = 0.25, r = 0.04, q = 0.01, h = 1e-3;
  for (const type of ["call", "put"]) {
    const g = O.greeks(type, S, K, T, sig, r, q);
    const p = (s, t, v) => O.price(type, s, K, t, v, r, q);
    near(g.delta, (p(S + h, T, sig) - p(S - h, T, sig)) / (2 * h), 1e-6, `${type} delta`);
    near(g.gamma, (p(S + h, T, sig) - 2 * p(S, T, sig) + p(S - h, T, sig)) / (h * h), 1e-4, `${type} gamma`);
    near(g.vega, (p(S, T, sig + h) - p(S, T, sig - h)) / (2 * h) / 100, 1e-6, `${type} vega`);
    const dT = 1e-5;
    near(g.theta, (p(S, T - dT, sig) - p(S, T + dT, sig)) / (2 * dT) / 365, 1e-5, `${type} theta/day`);
  }
});

test("implied volatility inverts the price, and refuses an impossible premium", () => {
  for (const sig of [0.08, 0.2, 0.55, 1.4]) {
    const pr = O.price("call", 100, 110, 0.25, sig, 0.04, 0);
    near(O.impliedVol("call", pr, 100, 110, 0.25, 0.04, 0), sig, 1e-6, `sigma ${sig}`);
  }
  assert.equal(O.impliedVol("call", 0.0001, 100, 60, 0.25, 0.04, 0), null, "below intrinsic");
  assert.equal(O.impliedVol("call", 500, 100, 100, 0.25, 0.04, 0), null, "above any volatility");
  assert.equal(O.impliedVol("stock", 5, 100, 100, 0.25, 0.04, 0), null);
});

/* ---------- positions ---------- */
const L = (type, side, strike, premium, qty = 1, iv = 0.2) => ({ type, side, strike, premium, qty, iv });

test("iron condor: credit, max profit, max loss and breakevens are exact", () => {
  const legs = [L("put", 1, 90, 0.5), L("put", -1, 95, 1.5), L("call", -1, 105, 1.5), L("call", 1, 110, 0.5)];
  const a = O.analyze(legs);
  near(a.netCash, 200, 1e-9);
  near(a.maxProfit, 200, 1e-9);
  near(a.maxLoss, -300, 1e-9);                    // width 5 minus 2.00 credit, x100
  assert.deepEqual(a.breakevens.map(x => +x.toFixed(6)), [93, 107]);
  assert.equal(a.unlimitedProfit, false); assert.equal(a.unlimitedLoss, false);
});

test("long call: unlimited profit, loss capped at the premium, breakeven above the strike", () => {
  const a = O.analyze([L("call", 1, 100, 3)]);
  assert.equal(a.unlimitedProfit, true); assert.equal(a.maxProfit, Infinity);
  near(a.maxLoss, -300, 1e-9);
  near(a.breakevens[0], 103, 1e-9);
});

test("short straddle: unlimited loss in both directions, two breakevens", () => {
  const a = O.analyze([L("call", -1, 100, 4), L("put", -1, 100, 4)]);
  assert.equal(a.unlimitedLoss, true); assert.equal(a.maxLoss, -Infinity);
  near(a.maxProfit, 800, 1e-9);
  assert.deepEqual(a.breakevens.map(x => +x.toFixed(6)), [92, 108]);
});

test("covered call: bounded above, and the downside is the stock falling to zero", () => {
  const a = O.analyze([{ type: "stock", side: 1, strike: 0, premium: 100, qty: 1, iv: 0 }, L("call", -1, 105, 2)]);
  assert.equal(a.unlimitedProfit, false);
  near(a.maxProfit, 700, 1e-9);                    // (105-100+2) x 100
  near(a.maxLoss, -9800, 1e-9);                    // stock to 0, keep the 2.00 credit
  near(a.breakevens[0], 98, 1e-9);
});

test("a position with no legs is harmless", () => {
  const a = O.analyze([]);
  assert.equal(a.netCash, 0); assert.deepEqual(a.breakevens, []);
});

test("chance of profit equals the lognormal probability between the breakevens", () => {
  const legs = [L("put", 1, 90, 0.5), L("put", -1, 95, 1.5), L("call", -1, 105, 1.5), L("call", 1, 110, 0.5)];
  const spot = 100, days = 30, sig = 0.2, r = 0.04, q = 0;
  const a = O.analyze(legs, { spot, days, r, q, iv: sig });
  const T = days / 365, mu = r - q - 0.5 * sig * sig;
  const F = (x) => O.cdf((Math.log(x / spot) - mu * T) / (sig * Math.sqrt(T)));
  near(a.pop, F(107) - F(93), 1e-9);
  assert.ok(a.pop > 0.5 && a.pop < 1);
});

test("chance of profit at zero days is 0 or 1", () => {
  const legs = [L("call", 1, 100, 3)];
  assert.equal(O.analyze(legs, { spot: 110, days: 0 }).pop, 1);
  assert.equal(O.analyze(legs, { spot: 99, days: 0 }).pop, 0);
});

test("profit and loss today converges to the expiry curve as time runs out", () => {
  const legs = [L("put", 1, 90, 0.5), L("put", -1, 95, 1.5), L("call", -1, 105, 1.5), L("call", 1, 110, 0.5)];
  for (const S of [85, 94, 100, 106, 120]) {
    near(O.plAtTime(legs, S, 0, 0, 0.04, 0), O.plAtExpiry(legs, S), 1e-9, `S=${S}`);
    assert.ok(Math.abs(O.plAtTime(legs, S, 0.001, 0, 0.04, 0) - O.plAtExpiry(legs, S)) < 1);
  }
});

test("templates open at roughly zero profit, because they are priced by the same model", () => {
  const spot = 100, iv = 0.22, days = 35, r = 0.04, q = 0.01;
  for (const name of Object.keys(O.TEMPLATES)) {
    const legs = O.buildTemplate(name, spot, 5, iv, days, r, q);
    assert.ok(legs.length >= 1, name);
    // cents rounding on at most four legs: a few dollars at the very most
    assert.ok(Math.abs(O.plAtTime(legs, spot, days, 0, r, q)) < 3, `${name} opens at ${O.plAtTime(legs, spot, days, 0, r, q)}`);
  }
});

test("each template has the legs and shape its name promises", () => {
  const t = (n) => O.buildTemplate(n, 100, 5, 0.2, 30, 0.04, 0);
  assert.equal(t("iron_condor").length, 4);
  const ic = t("iron_condor").filter(l => l.type === "put").map(l => l.strike);
  assert.ok(ic[0] < ic[1] && ic[1] < 100);
  assert.equal(t("bull_put_spread").filter(l => l.side === -1)[0].strike > t("bull_put_spread").filter(l => l.side === 1)[0].strike, true);
  assert.equal(t("long_butterfly").find(l => l.side === -1).qty, 2);
  assert.ok(O.analyze(t("iron_condor")).netCash > 0, "a condor is a credit");
  assert.ok(O.analyze(t("long_straddle")).netCash < 0, "a long straddle is a debit");
  assert.equal(O.analyze(t("covered_call")).unlimitedProfit, false);
  assert.equal(O.analyze(t("short_straddle")).unlimitedLoss, true);
  assert.equal(t("nonsense").length, 0);
});

test("net greeks of a symmetric condor are near delta-neutral, short gamma and long theta", () => {
  const legs = O.buildTemplate("iron_condor", 100, 5, 0.2, 30, 0.0, 0.0);
  const g = O.positionGreeks(legs, 100, 30, 0, 0, 0);
  assert.ok(Math.abs(g.delta) < 8, "delta " + g.delta);
  assert.ok(g.gamma < 0, "gamma " + g.gamma);
  assert.ok(g.theta > 0, "theta " + g.theta);
  assert.ok(g.vega < 0, "vega " + g.vega);
});

/* ---------- live chain and optimizer ---------- */
const NOW = Date.UTC(2026, 10, 24, 17, 0);           // 24 Nov 2026, noon New York
function fixture() {
  const opts = [];
  for (const [exp, T] of [["261127", 3 / 365], ["261218", 24 / 365], ["261124", 0.0001]]) {
    for (let k = 680; k <= 750; k += 5) {
      for (const ty of ["C", "P"]) {
        const type = ty === "C" ? "call" : "put", m = O.price(type, 716, k, T, 0.2, 0.04, 0);
        opts.push({ option: `SPY${exp}${ty}${String(k * 1000).padStart(8, "0")}`, bid: Math.max(0, m - 0.05), ask: m + 0.05, iv: 0.2, delta: 0.5, open_interest: 100, volume: 10 });
      }
    }
  }
  return { timestamp: "2026-11-24 17:00:00", data: { symbol: "SPY", current_price: 716, options: opts } };
}

test("OCC option symbols parse into expiry, type and strike", () => {
  assert.deepEqual(O.parseOcc("SPY261127C00715000"), { root: "SPY", expiry: "2026-11-27", type: "call", strike: 715 });
  assert.deepEqual(O.parseOcc("BRK.B270115P00412500"), { root: "BRK.B", expiry: "2027-01-15", type: "put", strike: 412.5 });
  assert.equal(O.parseOcc("nonsense"), null);
});

test("a Cboe chain parses into expiries with matched call and put strikes", () => {
  const c = O.parseCboeChain(fixture(), NOW);
  assert.equal(c.spot, 716);
  assert.deepEqual(c.expiries.map((e) => e.date), ["2026-11-27", "2026-12-18"], "same-day expiry is dropped");
  near(c.expiries[0].days, 3.1667, 1e-3);
  const e = c.chain["2026-11-27"];
  assert.equal(e.strikes.length, 15);
  const q = e.call[715];
  near(q.mid, (q.bid + q.ask) / 2, 0.006);
  near(O.atmIv(e, 716), 0.2, 1e-12);
  assert.equal(O.nearestStrike(e.strikes, 717.4), 715);
  assert.equal(O.parseCboeChain({ data: { options: [] } }, NOW), null);
  assert.equal(O.parseCboeChain(null, NOW), null);
});

test("the optimizer keeps only trades that profit at the target, best first", () => {
  const e = O.parseCboeChain(fixture(), NOW).chain["2026-12-18"];
  const up = O.optimize(e, 716, 735, { limit: 20 });
  assert.ok(up.length > 0);
  for (let i = 1; i < up.length; i += 1) assert.ok(up[i - 1].ret >= up[i].ret, "sorted by return");
  for (const r of up) {
    near(r.pl, O.plAtExpiry(r.legs, 735), 1e-9);
    assert.ok(r.pl > 0 && r.maxLoss < 0);
    near(r.ret, r.pl / -r.maxLoss, 1e-12);
  }
  assert.ok(up.every((r) => r.kind !== "long_put" && r.kind !== "bear_put_spread"), "a rise to the target never favours bearish debit trades");
  const down = O.optimize(e, 716, 690, { limit: 20 });
  assert.ok(down.some((r) => r.kind === "long_put" || r.kind === "bear_put_spread"));
  assert.deepEqual(O.optimize(null, 716, 735), []);
});
