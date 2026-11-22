// One test per defect found in the independent code review. Each was a real
// bug in shipped code; these keep it from coming back.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
require("../scripts/tradeimport.js");
require("../scripts/waterfall.js");
const P = globalThis.JSSTradeImport;
const W = globalThis.JSSWaterfall;

/* ---------- escaping (stored XSS in the manager's Inbox) ---------- */
function fnFrom(file, re) {
  const m = re.exec(read(file));
  assert.ok(m, `could not find esc() in ${file}`);
  return vm.runInNewContext("(" + m[0] + ")");
}
const escs = {
  "portal.js": fnFrom("scripts/portal.js", /function esc\(s\) \{[\s\S]*?\n  \}/),
  "ops.js": vm.runInNewContext("(" + /const esc = (\(s\) => [^\n]*);/.exec(read("scripts/ops.js"))[1] + ")"),
};
for (const [name, esc] of Object.entries(escs)) {
  test(`${name} esc() is safe inside a quoted attribute`, () => {
    const hostile = `a@b.co"onmouseover="alert(1)`;
    const out = esc(hostile);
    assert.ok(!out.includes('"'), `raw quote survived: ${out}`);
    assert.ok(!esc("x'y").includes("'"), "single quote survived");
    assert.equal(esc("<b>&"), "&lt;b&gt;&amp;");
  });
  test(`${name} esc() tolerates non-strings`, () => {
    assert.equal(esc(null), ""); assert.equal(esc(undefined), ""); assert.equal(esc(5), "5");
  });
}

/* ---------- waterfall: a capped month must still record a real shortfall ---------- */
test("annual cap + weak fund: the part of the capped target the fund missed is owed", () => {
  const o = W.run({ period: "2026-12-01", fundProfit: 100, targetRate: 0.017, reserveCapMonths: 6,
    annualCapMonths: 12, investors: [{ id: "i", name: "A", units: 100000, openingValue: 100000,
      reserve: 0, shortfall: 0, ytdPaid: 19550, mode: "cash" }] }).rows[0];
  assert.equal(o.paid, 100);
  assert.equal(o.shortfallDelta, 750, "850 was payable under the cap, 100 was paid");
});
test("annual cap already reached: nothing payable, so nothing owed", () => {
  const o = W.run({ period: "2026-12-01", fundProfit: -500, targetRate: 0.017, reserveCapMonths: 6,
    annualCapMonths: 12, investors: [{ id: "i", name: "A", units: 100000, openingValue: 100000,
      reserve: 0, shortfall: 0, ytdPaid: 20400, mode: "cash" }] }).rows[0];
  assert.equal(o.paid, 0); assert.equal(o.shortfallDelta, 0);
});

/* ---------- trade importer ---------- */
test("a tab-separated row with an empty first cell keeps its columns", () => {
  const r = P.parse("Date\tSymbol\tSide\tQty\tPrice\n\tAAPL\tBUY\t10\t150");
  assert.ok(r.ok, r.error);
  assert.equal(r.rows[0].symbol, "AAPL");
  assert.equal(r.rows[0].side, "BUY");
  assert.equal(r.rows[0].qty, 10);
  assert.equal(r.rows[0].price, 150);
});
test("a tab-separated row with an empty last cell keeps its columns", () => {
  const r = P.parse("Date\tSymbol\tSide\tQty\tPrice\tFees\n2026-01-06\tAAPL\tBUY\t10\t150\t");
  assert.equal(r.rows[0].price, 150);
});

test("dates do not slide a day back east of UTC (Vietnam is UTC+7)", () => {
  const code = `require(${JSON.stringify(path.join(ROOT, "scripts/tradeimport.js"))});
    const P = globalThis.JSSTradeImport;
    console.log(JSON.stringify([P._dateOf("6 Jan 2026"), P._dateOf("January 6, 2026"), P._dateOf("2026-01-06")]));`;
  const out = execFileSync(process.execPath, ["-e", code], { env: { ...process.env, TZ: "Asia/Ho_Chi_Minh" } });
  assert.deepEqual(JSON.parse(out), ["2026-01-06", "2026-01-06", "2026-01-06"]);
});
test("impossible dates are rejected rather than saved", () => {
  assert.equal(P._dateOf("31/02/2026"), null);
  assert.equal(P._dateOf("2026-13-01"), null);
  assert.equal(P._dateOf("2026-02-30"), null);
});
test("a day over 12 is read day-first instead of becoming month 13", () => {
  assert.equal(P._dateOf("13/01/2026"), "2026-01-13");
  assert.equal(P._dateOf("01/06/2026"), "2026-01-06");           // ambiguous: US month-first, as documented
});

test("European decimals are not read as US thousands", () => {
  assert.equal(P._num("1.234,56"), 1234.56);
  assert.equal(P._num("1,5"), 1.5);
  assert.equal(P._num("1,234.56"), 1234.56);                      // US still works
  assert.equal(P._num("1,234"), 1234);                            // three digits: thousands
});
test("a semicolon file with decimal commas is read correctly end to end", () => {
  const r = P.parse("Date;Symbol;Side;Qty;Price\n2026-01-06;SPY;SELL;2;1.234,56");
  assert.ok(r.ok, r.error);
  assert.equal(r.rows[0].price, 1234.56);
});

test("side words are matched whole, not as substrings", () => {
  assert.equal(P._sideOf("Stock Buy"), "BUY");
  assert.equal(P._sideOf("Buy - stop order"), "BUY");
  assert.equal(P._sideOf("Custom sell"), "SELL");
  assert.equal(P._sideOf("Sell to Open"), "SELL");
  assert.equal(P._sideOf("Buy to Close"), "BUY");
  assert.equal(P._sideOf("Buy or Sell"), null, "ambiguous must not be guessed");
  assert.equal(P._sideOf("hold"), null);
});

/* ---------- db.js: bulk trade save ---------- */
function loadDB(client) {
  const sandbox = { window: {}, console };
  sandbox.window.JSS_CONFIG = {};
  vm.createContext(sandbox);
  vm.runInContext(read("scripts/db.js"), sandbox);
  sandbox.window.JSSDB._client = client;
  return sandbox.window.JSSDB;
}
function fakeClient(failOnCall) {
  const log = { inserted: [], deletedImports: [] };
  let n = 0;
  return { log, from: (table) => ({
    insert: async (rows) => { n += 1; if (n === failOnCall) return { error: { message: "boom" } }; log.inserted.push(...rows); return { error: null }; },
    delete: () => ({ eq: async (_c, id) => { log.deletedImports.push(id); log.inserted = log.inserted.filter(r => r.import_id !== id); return { error: null }; } }),
  }) };
}
const mk = (i, over) => Object.assign({ symbol: "SPY", side: "BUY", qty: 1, price: 1, pnlFinal: 5, fees: 0, multiplier: 1, strategy: "g", date: "2026-01-06" }, over, { line: i });

test("a bulk save that fails part-way leaves nothing behind", async () => {
  const c = fakeClient(2);                                         // second chunk fails
  const DB = loadDB(c);
  const rows = Array.from({ length: 450 }, (_, i) => mk(i));
  await assert.rejects(() => DB.addTradesBulk(rows, "imp-1"), /nothing was saved/i);
  assert.equal(c.log.inserted.length, 0, "orphaned rows left in the table");
});
test("rows missing side/qty/price are saved marked as placeholders, not passed off as real", async () => {
  const c = fakeClient(0);
  const DB = loadDB(c);
  await DB.addTradesBulk([mk(1, { side: null, qty: null, price: null })], "imp-2");
  const row = c.log.inserted[0];
  assert.match(String(row.note), /placeholder|no side|not in the source/i);
});

/* ---------- Gmail notifier ---------- */
test("a lead name with a newline cannot jam the notifier", () => {
  const script = `
import importlib.util, sys
spec = importlib.util.spec_from_file_location("nl", ${JSON.stringify(path.join(ROOT, ".github/scripts/notify_leads.py"))})
nl = importlib.util.module_from_spec(spec); spec.loader.exec_module(nl)
m = nl.build_message({"name": "Bob\\nBcc: x@evil.com", "email": "b@x.com", "message": "hi", "created_at": "2026-01-01T00:00:00Z"}, "info@bpsquant.com", ["info@bpsquant.com"])
assert "\\n" not in m["Subject"] and "\\r" not in m["Subject"], m["Subject"]
assert m["Bcc"] is None, "header injection"
print("ok")`;
  const out = execFileSync("python3", ["-c", script]).toString().trim();
  assert.equal(out, "ok");
});
