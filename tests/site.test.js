// Guards for the mistakes that have actually reached the live site.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
const scripts = fs.readdirSync(path.join(ROOT, "scripts")).filter((f) => f.endsWith(".js"));

test("every script parses", () => {
  for (const f of scripts) {
    assert.doesNotThrow(() => new vm.Script(read("scripts/" + f), { filename: f }), f);
  }
});

test("every asset a page references exists", () => {
  for (const p of pages) {
    const refs = [...read(p).matchAll(/(?:src|href)="((?:scripts|styles|assets)\/[^"?#]+)/g)].map((m) => m[1]);
    for (const r of refs) assert.ok(fs.existsSync(path.join(ROOT, r)), `${p} references missing ${r}`);
  }
});

test("one cache version across every page and every asset", () => {
  // A page on an older version than the rest serves stale scripts to anyone
  // who loaded it before. It happened once; this stops it happening again.
  const seen = new Map();
  for (const p of pages) {
    for (const m of read(p).matchAll(/\?v=([0-9a-z]+)/g)) {
      if (!seen.has(m[1])) seen.set(m[1], new Set());
      seen.get(m[1]).add(p);
    }
  }
  assert.ok(seen.size <= 1, "mixed cache versions: " +
    [...seen].map(([v, ps]) => `${v} in ${[...ps].join(",")}`).join(" | "));
});

test("i18n.js loads before site.js, and before portal.js", () => {
  // The reverse order rendered the whole nav as raw keys ("nav.home").
  for (const p of pages) {
    const s = read(p);
    const i = s.indexOf("scripts/i18n.js"), site = s.indexOf("scripts/site.js"), portal = s.indexOf("scripts/portal.js");
    if (site >= 0) assert.ok(i >= 0 && i < site, `${p}: i18n.js must load before site.js`);
    if (portal >= 0) assert.ok(i >= 0 && i < portal, `${p}: i18n.js must load before portal.js`);
  }
});

test("a page that loads a script also loads what it needs first", () => {
  for (const p of pages) {
    const s = read(p);
    if (s.includes("scripts/portal.js")) {
      for (const dep of ["config.js", "db.js", "tradeimport.js", "waterfall.js"]) {
        assert.ok(s.includes("scripts/" + dep), `${p} loads portal.js without ${dep}`);
      }
    }
  }
});

/* ---------- translations ---------- */
function dictionaries() {
  const sandbox = { window: undefined, navigator: { language: "en" }, document: { documentElement: {} },
    localStorage: { getItem() { return null; }, setItem() {} } };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("scripts/i18n.js") + "\n;this.__d = DICT;", sandbox);
  return sandbox.__d;
}
function dictsFromSource() {
  // DICT is not exported, so read the two object literals out of the source.
  const src = read("scripts/i18n.js");
  const grab = (name) => {
    const start = src.indexOf(`const ${name} = {`);
    const end = src.indexOf("\n  };", start);
    return new vm.Script(`(${src.slice(start + `const ${name} = `.length, end + 4)})`).runInNewContext({});
  };
  return { en: grab("EN"), vi: grab("VI") };
}
const { en: EN, vi: VI } = dictsFromSource();

test("English and Vietnamese have exactly the same keys", () => {
  const missingVi = Object.keys(EN).filter((k) => !(k in VI));
  const extraVi = Object.keys(VI).filter((k) => !(k in EN));
  assert.deepEqual(missingVi, [], "keys with no Vietnamese: " + missingVi.join(", "));
  assert.deepEqual(extraVi, [], "Vietnamese keys with no English: " + extraVi.join(", "));
});

test("{placeholders} match between languages", () => {
  const ph = (s) => (String(s).match(/\{[a-zA-Z]+\}/g) || []).sort().join(",");
  for (const k of Object.keys(EN)) {
    if (k in VI) assert.equal(ph(VI[k]), ph(EN[k]), `placeholders differ for "${k}"`);
  }
});

test("no Vietnamese string is empty or still the English text", () => {
  const SAME_OK = new Set(["login.email", "income.thMonth", "lang.label"]);
  for (const [k, v] of Object.entries(VI)) {
    assert.ok(String(v).trim().length > 0, `empty Vietnamese for "${k}"`);
    if (!SAME_OK.has(k) && EN[k] === v && /[A-Za-z]{4,}/.test(v)) {
      assert.fail(`"${k}" is identical in both languages — untranslated?`);
    }
  }
});

function templateNames() {
  require("../scripts/optionsmath.js");
  return Object.keys(globalThis.JSSOptions.TEMPLATES);
}

function schemaValues(table, column) {
  // The allowed values come from the database's own CHECK constraint, so a
  // new status added there fails this test until it is translated.
  const schema = read("supabase/schema.sql");
  const t = schema.indexOf(table);
  const m = new RegExp(column + "[^;]*?CHECK\\s*\\(\\s*" + column + "\\s+IN\\s*\\(([^)]*)\\)").exec(schema.slice(t));
  assert.ok(m, `no CHECK for ${table}.${column} in schema.sql`);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

test("every t('key') used in the code exists in the dictionary", () => {
  const used = new Set();
  const dynamic = new Set();
  for (const f of ["scripts/portal.js", "scripts/site.js", "scripts/options.js"]) {
    for (const m of read(f).matchAll(/\bt\(\s*"([a-zA-Z0-9_.]+)"(\s*\+)?/g)) {
      (m[2] ? dynamic : used).add(m[1]);
    }
  }
  const missing = [...used].filter((k) => !(k in EN));
  assert.deepEqual(missing, [], "t() keys with no dictionary entry: " + missing.join(", "));

  // Keys built at runtime: check every value the database can actually hold.
  const expected = {
    "opt.s.": templateNames(),
    "st.": schemaValues("withdrawal_requests", "status"),
    "type.": schemaValues("capital_events", "type"),
    "risk.": schemaValues("investor_accounts", "risk_pref"),
  };
  for (const prefix of dynamic) {
    assert.ok(expected[prefix], `dynamic key prefix "${prefix}" has no known value set — add it here`);
    for (const v of expected[prefix]) {
      assert.ok((prefix + v) in EN, `no English for ${prefix}${v}`);
      assert.ok((prefix + v) in VI, `no Vietnamese for ${prefix}${v}`);
      if (prefix === "risk.") assert.ok((prefix + v + "D") in VI, `no Vietnamese description for ${prefix}${v}D`);
    }
  }
});

test("the Options Lab page loads its maths before its interface", () => {
  const s = read("options.html");
  const m = s.indexOf("scripts/optionsmath.js"), u = s.indexOf("scripts/options.js");
  assert.ok(m >= 0 && u > m, "optionsmath.js must load before options.js");
});

test("every strategy template has a name in both languages", () => {
  require("../scripts/optionsmath.js");
  for (const k of Object.keys(globalThis.JSSOptions.TEMPLATES)) {
    assert.ok(("opt.s." + k) in EN, `no English name for ${k}`);
    assert.ok(("opt.s." + k) in VI, `no Vietnamese name for ${k}`);
  }
});

test("styles for every class the nav script emits exist in main.css", () => {
  const css = fs.readFileSync(path.join(ROOT, "styles/main.css"), "utf8");
  for (const cls of [".nav__lang", ".nav__lang--mobile", ".opt-tip[hidden]"]) {
    assert.ok(css.includes(cls), cls + " is missing from main.css");
  }
});
