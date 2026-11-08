/* ============================================================
   BPSQuant — trade paste parser

   Takes whatever a broker or a spreadsheet puts on the clipboard and
   works out which column is which, instead of demanding one exact
   header order that no broker actually exports.

   Handles: comma, tab, semicolon and pipe delimiters; quoted fields
   with embedded delimiters; "$1,234.56"; "(123.45)" for negatives;
   a BOM; blank lines; and headers in any order or letter case.

   P&L comes from the file when the file has it. When it does not, the
   parser nets each group's buys and sells, which is only the real
   answer once that group is closed — and it says which of the two it
   did, rather than leaving you to guess.

   window.JSSTradeImport.parse(text, { multiplier }) -> result
   ============================================================ */
(function (global) {
  "use strict";

  /* Column synonyms, longest and most specific first so that "fill price"
     is not matched by the looser "price", and "realized p/l" wins over
     a bare "p/l". */
  const FIELDS = {
    pnl:      ["realized p/l","realised p/l","realized pnl","realised pnl","realized","realised",
               "profit/loss","profit loss","net p/l","p/l","p&l","pnl","profit","gain/loss","gain"],
    date:     ["executed at","execution time","exec time","trade date","date/time","datetime",
               "created at","closed date","close date","open date","opened","created",
               "executed","filled","date","time"],
    symbol:   ["underlying symbol","option symbol","root symbol","instrument","underlying",
               "security","symbol","ticker"],
    side:     ["buy/sell","b/s","side","action","transaction type","order type","effect"],
    qty:      ["contracts","quantity","shares","filled qty","qty","size","units"],
    price:    ["average price","avg fill price","fill price","exec price","trade price",
               "unit price","avg price","price"],
    fees:     ["commission & fees","commissions","commission","fees","fee"],
    strategy: ["strategy","structure","spread type","group","category","type"],
  };

  const DELIMS = [["\t", "tab"], [",", "comma"], [";", "semicolon"], ["|", "pipe"]];

  function sniffDelimiter(lines) {
    let best = ",", bestScore = -1;
    for (const [d] of DELIMS) {
      // A real delimiter splits every line into the same number of fields.
      const counts = lines.slice(0, 12).map(l => splitLine(l, d).length);
      if (!counts.length || counts[0] < 2) continue;
      const consistent = counts.every(c => c === counts[0]);
      const score = (consistent ? 100 : 0) + counts[0];
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }

  /* Split one line, honouring "quoted, fields" and "" escapes. */
  function splitLine(line, delim) {
    const out = [];
    let cur = "", q = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === delim) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out.map(s => s.trim());
  }

  const norm = (s) => String(s || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")      // CreatedAt -> Created At
    .toLowerCase().replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ").replace(/[()\[\]]/g, "").trim();

  /* Match each wanted field to a column. A header is claimed once, so two
     fields can never fight over the same column. */
  function mapColumns(headers) {
    const h = headers.map(norm);
    const used = new Set();
    const map = {};
    for (const field of Object.keys(FIELDS)) {
      let found = -1;
      for (const syn of FIELDS[field]) {
        for (let i = 0; i < h.length; i += 1) {
          if (used.has(i)) continue;
          if (h[i] === syn) { found = i; break; }
        }
        if (found >= 0) break;
        for (let i = 0; i < h.length; i += 1) {         // then substring
          if (used.has(i)) continue;
          if (h[i].includes(syn)) { found = i; break; }
        }
        if (found >= 0) break;
      }
      map[field] = found;
      if (found >= 0) used.add(found);
    }
    return map;
  }

  /* "$1,234.56" -> 1234.56 ; "(89.10)" -> -89.10 ; "" -> null */
  function num(v) {
    if (v == null) return null;
    let s = String(v).trim();
    if (!s) return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.replace(/[$€£₫\s]/g, "").replace(/,/g, "");
    if (s.startsWith("-")) { neg = true; s = s.slice(1); }
    if (s.startsWith("+")) s = s.slice(1);
    if (!/^\d*\.?\d+$/.test(s)) return null;
    const n = parseFloat(s);
    if (!isFinite(n)) return null;
    return neg ? -n : n;
  }

  /* Accepts 2026-01-06, 01/06/2026, 6 Jan 2026, with or without a time. */
  function dateOf(v) {
    const s = String(v || "").trim();
    if (!s) return null;
    let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/(\d{1,2})[/](\d{1,2})[/](\d{4})/);          // US month first
    if (m) return `${m[3]}-${String(m[1]).padStart(2,"0")}-${String(m[2]).padStart(2,"0")}`;
    const d = new Date(s);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  }

  function sideOf(v) {
    const s = norm(v);
    if (!s) return null;
    if (/\bsell|^s$|sold|sell to|stc|sto|short|credit\b/.test(s)) return "SELL";
    if (/\bbuy|^b$|bought|buy to|btc|bto|long|debit\b/.test(s)) return "BUY";
    return null;
  }

  /* An option symbol carries a strike and a call/put marker, so each
     contract is 100 shares. Guessing this wrong silently would be worse
     than asking, so the caller can override and the UI shows which. */
  function looksLikeOption(sym, strategy) {
    const s = String(sym || "");
    if (/\d+(\.\d+)?\s*[CP]\b/i.test(s)) return true;
    if (/\b(call|put)\b/i.test(s)) return true;
    return /\b(condor|spread|straddle|strangle|wheel|csp|covered call|option)\b/i
      .test(String(strategy || ""));
  }

  function parse(text, opts) {
    opts = opts || {};
    const res = { ok: false, error: "", delimiter: "", delimiterName: "",
                  headers: [], mapping: {}, rows: [], skipped: 0, summary: null };

    let raw = String(text || "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
    const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      res.error = "Paste at least a header row and one trade.";
      return res;
    }

    const delim = sniffDelimiter(lines);
    res.delimiter = delim;
    res.delimiterName = (DELIMS.find(d => d[0] === delim) || [null, "comma"])[1];

    const headers = splitLine(lines[0], delim);
    res.headers = headers;
    const map = mapColumns(headers);
    res.mapping = map;

    if (map.symbol < 0 && map.pnl < 0) {
      res.error = "Could not find a symbol or a profit/loss column. Check the first row holds column names.";
      return res;
    }

    const at = (cells, i) => (i >= 0 && i < cells.length ? cells[i] : "");
    for (let i = 1; i < lines.length; i += 1) {
      const c = splitLine(lines[i], delim);
      if (c.every(x => !x)) continue;
      const symbol = at(c, map.symbol).toUpperCase();
      const pnl = num(at(c, map.pnl));
      const qty = num(at(c, map.qty));
      const price = num(at(c, map.price));
      // A row with no symbol and no usable number is a total line or a note.
      if (!symbol && pnl == null && qty == null) { res.skipped += 1; continue; }
      res.rows.push({
        line: i + 1,
        date: dateOf(at(c, map.date)),
        symbol,
        side: sideOf(at(c, map.side)),
        qty: qty != null ? Math.abs(qty) : null,
        price,
        pnl,
        fees: num(at(c, map.fees)) || 0,
        strategy: at(c, map.strategy) || "",
      });
    }

    if (!res.rows.length) { res.error = "No trade rows found below the header."; return res; }

    res.summary = compute(res.rows, map, opts);
    res.ok = true;
    return res;
  }

  /* P&L from the file if it is there; otherwise net each group's cash. */
  function compute(rows, map, opts) {
    const haveFilePnl = map.pnl >= 0 && rows.some(r => r.pnl != null);
    const forced = opts.multiplier;

    rows.forEach(r => {
      r.multiplier = forced != null ? forced
        : (looksLikeOption(r.symbol, r.strategy) ? 100 : 1);
      if (haveFilePnl) {
        r.pnlFinal = r.pnl != null ? r.pnl - Math.abs(r.fees || 0) : null;
        r.cash = null;
      } else {
        // SELL brings money in, BUY takes it out. Netting the two over a
        // closed group gives that group's realised profit.
        r.cash = (r.side && r.qty != null && r.price != null)
          ? (r.side === "SELL" ? 1 : -1) * r.qty * r.price * r.multiplier - Math.abs(r.fees || 0)
          : null;
        r.pnlFinal = null;
      }
    });

    const groups = new Map();
    rows.forEach(r => {
      const key = (r.strategy || r.symbol || "—").trim() || "—";
      if (!groups.has(key)) groups.set(key, { key, rows: [], pnl: 0, complete: true });
      const g = groups.get(key);
      g.rows.push(r);
      const v = haveFilePnl ? r.pnlFinal : r.cash;
      if (v == null) g.complete = false; else g.pnl += v;
    });

    const list = [...groups.values()];
    const total = list.reduce((a, g) => a + g.pnl, 0);
    const wins = list.filter(g => g.pnl > 0).length;
    const losses = list.filter(g => g.pnl < 0).length;
    const sorted = [...list].sort((a, b) => b.pnl - a.pnl);

    return {
      pnlSource: haveFilePnl ? "file" : "computed",
      rowCount: rows.length,
      groups: list,
      groupCount: list.length,
      incomplete: list.filter(g => !g.complete).length,
      totalPnl: total,
      totalFees: rows.reduce((a, r) => a + Math.abs(r.fees || 0), 0),
      wins, losses,
      winRate: (wins + losses) ? (wins / (wins + losses)) * 100 : null,
      best: sorted[0] || null,
      worst: sorted[sorted.length - 1] || null,
      // Only a problem when the legs have to be netted; irrelevant when the
      // file already states the profit.
      missingSide: haveFilePnl ? 0 : rows.filter(r => !r.side).length,
      missingDate: rows.filter(r => !r.date).length,
    };
  }

  global.JSSTradeImport = { parse, _num: num, _dateOf: dateOf, _sideOf: sideOf,
                            _sniff: sniffDelimiter, _map: mapColumns, FIELDS };
})(typeof window !== "undefined" ? window : globalThis);
