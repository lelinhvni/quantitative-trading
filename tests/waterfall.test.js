// Clause 6 waterfall. Each case names the clause it exercises.
const test = require("node:test");
const assert = require("node:assert/strict");
require("../scripts/waterfall.js");
const W = globalThis.JSSWaterfall;

const inv = (o) => Object.assign({ id: "i1", name: "A", units: 100000, openingValue: 100000,
  reserve: 0, shortfall: 0, ytdPaid: 0, mode: "cash" }, o);
const run = (fundProfit, o, extra) => W.run(Object.assign({
  period: "2026-12-01", fundProfit, targetRate: 0.017, reserveCapMonths: 6,
  annualCapMonths: 12, investors: [inv(o)] }, extra)).rows[0];

test("6.4(a) good month: target paid, surplus into the reserve", () => {
  const r = run(2400);
  assert.equal(r.target, 1700); assert.equal(r.paid, 1700);
  assert.equal(r.reserveDelta, 700); assert.equal(r.companyExcess, 0);
});

test("6.4(b) short month: the reserve tops the payment up", () => {
  const r = run(1100, { reserve: 900 });
  assert.equal(r.paid, 1700); assert.equal(r.reserveDelta, -600); assert.equal(r.reserveAfter, 300);
});

test("6.4(c) loss, reserve covers part: the gap is recorded as owed", () => {
  const r = run(-1800, { reserve: 1200 });
  assert.equal(r.paid, 1200); assert.equal(r.reserveAfter, 0); assert.equal(r.shortfallDelta, 500);
});

test("6.4(d) loss, empty reserve: no payment, full target owed", () => {
  const r = run(-2000);
  assert.equal(r.paid, 0); assert.equal(r.shortfallDelta, 1700);
});

test("6.6 shortfall is repaid before the Company keeps anything", () => {
  const r = run(5000, { reserve: 10200, shortfall: 800 });
  assert.equal(r.paid, 2500); assert.equal(r.shortfallAfter, 0); assert.equal(r.companyExcess, 2500);
});

test("6.5 reserve caps at six months, the rest is the Company's", () => {
  const r = run(20000, { reserve: 9000 });
  assert.equal(r.reserveCap, 10200); assert.equal(r.reserveDelta, 1200); assert.equal(r.companyExcess, 17100);
});

test("6.4A annual cap: only the room left is paid, and it is not owed", () => {
  let r = run(9999, { ytdPaid: 19550 });
  assert.equal(r.paid, 850); assert.equal(r.cappedByAnnual, true);
  r = run(5000, { ytdPaid: 20400 });
  assert.equal(r.paid, 0); assert.equal(r.shortfallDelta, 0);
});

test("profit is shared pro rata by units, cash and reinvest split", () => {
  const out = W.run({ period: "2026-12-01", fundProfit: 3000, targetRate: 0.017,
    reserveCapMonths: 6, annualCapMonths: 12, investors: [
      inv({ id: "a", units: 75000, openingValue: 75000 }),
      inv({ id: "b", units: 25000, openingValue: 25000, mode: "reinvest" })] });
  assert.equal(out.rows[0].profitShare, 2250);
  assert.equal(out.rows[1].profitShare, 750);
  assert.equal(out.totals.cash, 1275); assert.equal(out.totals.reinvested, 425);
});

test("conservation: paid + reserve movement + Company share = positive profit", () => {
  let seed = 12345;                          // deterministic, so a failure reproduces
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let t = 0; t < 500; t++) {
    const investors = Array.from({ length: 1 + Math.floor(rnd() * 5) }, (_, i) => {
      const u = 1000 + rnd() * 200000;
      return inv({ id: "i" + i, units: u, openingValue: u, reserve: rnd() * 5000,
        shortfall: rnd() * 2000, ytdPaid: rnd() * 25000, mode: rnd() < .5 ? "cash" : "reinvest" });
    });
    const o = W.run({ period: "2026-12-01", fundProfit: (rnd() - 0.35) * 60000,
      targetRate: 0.017, reserveCapMonths: 6, annualCapMonths: 12, investors });
    assert.ok(Math.abs(o.totals.unaccounted) < 0.06, `leak ${o.totals.unaccounted} on trial ${t}`);
    o.rows.forEach(x => { assert.ok(x.reserveAfter > -0.01, "negative reserve"); assert.ok(x.paid > -0.01, "negative payment"); });
  }
});

test("no investors is a warning, not a crash", () => {
  const out = W.run({ period: "2026-12-01", fundProfit: 5000, investors: [] });
  assert.equal(out.rows.length, 0); assert.ok(out.warnings.length > 0);
});
