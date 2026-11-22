// Trade paste parser. Shapes are real broker/spreadsheet exports.
const test = require("node:test");
const assert = require("node:assert/strict");
require("../scripts/tradeimport.js");
const P = globalThis.JSSTradeImport;
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 0.01, `${m}: ${a} vs ${b}`);

test("spreadsheet with its own P&L column uses it", () => {
  const r = P.parse(`Name,Return %,P&L $,CreatedAt,Expiration,Symbol
SPY Iron Condor,8.2,"$820.00",2026-01-06,2026-01-17,SPY
QQQ Bull Put Spread,9.0,"$450.00",2026-01-20,2026-01-30,QQQ
DIA Cash-Secured Put,-3.6,"($180.00)",2026-02-17,2026-03-07,DIA`);
  assert.ok(r.ok, r.error);
  assert.equal(r.summary.pnlSource, "file");
  near(r.summary.totalPnl, 1090, "total");
  assert.equal(r.summary.wins, 2);
  assert.equal(r.summary.losses, 1);
  near(r.summary.worst.pnl, -180, "worst");
});

test("camelCase header CreatedAt is read as the date column", () => {
  const r = P.parse('Name,P&L $,CreatedAt,Symbol\nA,"$5.00",2026-01-06,SPY');
  assert.ok(r.mapping.date >= 0);
  assert.equal(r.rows[0].date, "2026-01-06");
  assert.equal(r.summary.missingDate, 0);
});

test("tab separated, legs netted, options priced at 100", () => {
  const r = P.parse("Date\tSymbol\tSide\tQty\tPrice\tStrategy\n2026-01-06\tSPY 520P\tSELL\t2\t1.85\tIron Condor\n2026-01-17\tSPY 520P\tBUY\t2\t0.10\tIron Condor");
  assert.ok(r.ok, r.error);
  assert.equal(r.delimiterName, "tab");
  assert.equal(r.summary.pnlSource, "computed");
  assert.equal(r.rows[0].multiplier, 100);
  near(r.summary.totalPnl, 350, "net");
});

test("reordered columns, US dates, fees", () => {
  const r = P.parse(`Action,Ticker,Filled Qty,Avg Fill Price,Commission,Trade Date
Sell to Open,AAPL,100,195.50,1.25,01/15/2026
Buy to Close,AAPL,100,190.00,1.25,02/02/2026`);
  assert.ok(r.ok, r.error);
  assert.deepEqual(r.rows.map(x => x.side), ["SELL", "BUY"]);
  assert.equal(r.rows[0].date, "2026-01-15");
  assert.equal(r.rows[0].multiplier, 1);
  near(r.summary.totalPnl, 547.5, "net after fees");
  near(r.summary.totalFees, 2.5, "fees");
});

test("quoted field with an embedded comma", () => {
  const r = P.parse('Date,Symbol,Side,Qty,Price,Note\n2026-03-01,SPY,SELL,1,"2,100.50","sold the rip, took profit"');
  assert.ok(r.ok, r.error);
  near(r.rows[0].price, 2100.5, "price");
});

test("junk is rejected, not guessed at", () => {
  assert.equal(P.parse("").ok, false);
  assert.equal(P.parse("just one line").ok, false);
  assert.equal(P.parse("alpha,beta,gamma\n1,2,3").ok, false);
});

test("blank and totals rows are skipped", () => {
  const r = P.parse("Date,Symbol,Side,Qty,Price\n2026-01-06,SPY,SELL,2,1.85\n\n,,,,\nTotal,,,,");
  assert.ok(r.ok);
  assert.equal(r.rows.length, 1);
  assert.ok(r.skipped >= 1);
});

test("BOM, CRLF and semicolons", () => {
  const r = P.parse("﻿Date;Symbol;Side;Qty;Price\r\n2026-01-06;SPY;SELL;2;1.85\r\n");
  assert.ok(r.ok, r.error);
  assert.equal(r.delimiterName, "semicolon");
});

test("multiplier override is honoured", () => {
  const r = P.parse("Date,Symbol,Side,Qty,Price\n2026-01-06,SPY 520P,SELL,2,1.85", { multiplier: 1 });
  assert.equal(r.rows[0].multiplier, 1);
  near(r.summary.totalPnl, 3.7, "3.70 not 370");
});

test("a missing buy/sell only matters when legs are netted", () => {
  const withPnl = P.parse('Name,P&L $,CreatedAt,Symbol\nA,"$5.00",2026-01-06,SPY');
  assert.equal(withPnl.summary.missingSide, 0);
  const netted = P.parse("Date,Symbol,Qty,Price\n2026-01-06,SPY,2,1.85");
  assert.equal(netted.summary.missingSide, 1);
});

test("number formats", () => {
  assert.equal(P._num("$1,234.56"), 1234.56);
  assert.equal(P._num("(89.10)"), -89.1);
  assert.equal(P._num("-5"), -5);
  assert.equal(P._num(""), null);
  assert.equal(P._num("abc"), null);
});
