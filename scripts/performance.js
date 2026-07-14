/* ============================================================
   BPSQuant — Quant Finance page
   Educational charts + performance dashboard.
   Uses real NAV history from Supabase when configured,
   otherwise falls back to a deterministic demo curve.
   ============================================================ */
(function () {
  "use strict";
  const F = window.JSS;
  const DB = window.JSSDB;

  let navData = null;

  document.addEventListener("DOMContentLoaded", async () => {
    const liveMode = DB && DB.init();
    if (liveMode) {
      try {
        const session = await DB.getSession();
        if (session) navData = await DB.getAllNavHistory();
      } catch (e) {
        console.warn("[BPSQuant] Could not load NAV history:", e.message);
      }
    }

    const perfData = navData && navData.length >= 2 ? buildFromReal(navData) : buildDemo();

    // Educational charts (always illustrative)
    drawQuantEdge();
    drawSignalChart();
    drawDistChart(perfData);
    drawDrawdownChart(perfData);

    // Performance section
    renderMetrics(perfData);
    drawEquity(perfData);
    drawMonthly(perfData);
    drawAllocation();

    if (navData && navData.length >= 2) {
      const note = document.querySelector(".data-source");
      if (note) note.textContent = `Live NAV data: ${navData.length} data points from ${navData[0].date} to ${navData[navData.length - 1].date}.`;
    }

    window.addEventListener("resize", debounce(() => {
      drawQuantEdge();
      drawSignalChart();
      drawDistChart(perfData);
      drawDrawdownChart(perfData);
      drawEquity(perfData);
      drawMonthly(perfData);
      drawAllocation();
    }, 200));
  });

  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  /* ============================================================
     Educational charts
     ============================================================ */

  function drawQuantEdge() {
    const c = document.getElementById("quantEdgeChart");
    if (!c || !F || !F.chart) return;
    let seed = 99991;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const n = 36;
    const sys = [], disc = [], labels = [];
    let s = 100, d = 100;
    for (let i = 0; i < n; i++) {
      const mkt = (rnd() - 0.47) * 0.05;
      s *= 1 + 0.006 + (rnd() - 0.43) * 0.025 + mkt * 0.3;
      d *= 1 + 0.003 + (rnd() - 0.46) * 0.04 + mkt * 0.5;
      sys.push(s); disc.push(d);
      labels.push(i % 6 === 0 ? "M" + (i + 1) : "");
    }
    F.chart.lineChart(c, {
      labels,
      series: [
        { values: sys,  color: "#5eead4", fill: "rgba(94,234,212,0.15)", width: 2.4 },
        { values: disc, color: "#5d6b8a", width: 1.8 },
      ],
      yFmt: (v) => v.toFixed(0),
    });
  }

  function drawSignalChart() {
    const c = document.getElementById("signalChart");
    if (!c || !F || !F.chart) return;
    const signals = [
      { label: "Vol Premium",   val: 76, color: "#5eead4" },
      { label: "Theta Decay",   val: 71, color: "#818cf8" },
      { label: "Mean Revert",   val: 63, color: "#6366f1" },
      { label: "VRP + Theta",   val: 82, color: "#34d399" },
      { label: "All combined",  val: 85, color: "#fbbf24" },
    ];
    F.chart.barChart(c, {
      yFmt: (v) => Math.round(v) + "%",
      groups: signals.map((s) => ({ label: s.label, bars: [{ value: s.val, color: s.color }] })),
    });
  }

  function drawDistChart(d) {
    const c = document.getElementById("distChart");
    if (!c || !F || !F.chart) return;
    // Build a distribution histogram of monthly returns
    const rets = d.monthly.map((m) => m.ret);
    const buckets = [-6, -4, -2, 0, 1, 2, 3, 4, 5, 6, 8].map((v) => ({ v, count: 0 }));
    rets.forEach((r) => {
      let placed = false;
      for (let i = 0; i < buckets.length - 1; i++) {
        if (r >= buckets[i].v && r < buckets[i + 1].v) { buckets[i].count++; placed = true; break; }
      }
      if (!placed) buckets[buckets.length - 1].count++;
    });
    F.chart.barChart(c, {
      yFmt: (v) => Math.round(v) + "",
      groups: buckets.map((b) => ({
        label: b.v + "%",
        bars: [{ value: b.count, color: b.v >= 0 ? "#34d399" : "#f87171" }],
      })),
    });
  }

  function drawDrawdownChart(d) {
    const c = document.getElementById("drawdownChart");
    if (!c || !F || !F.chart) return;
    // Compute drawdown series
    let peak = -Infinity;
    const ddStrat = d.strat.map((v) => { peak = Math.max(peak, v); return ((v / peak) - 1) * 100; });
    let peakB = -Infinity;
    const ddBench = d.bench.map((v) => { peakB = Math.max(peakB, v); return ((v / peakB) - 1) * 100; });
    F.chart.lineChart(c, {
      labels: d.labels,
      series: [
        { values: ddStrat, color: "#5eead4", fill: "rgba(94,234,212,0.15)", width: 2 },
        { values: ddBench, color: "#f87171", fill: "rgba(248,113,113,0.1)", width: 1.6 },
      ],
      yFmt: (v) => v.toFixed(1) + "%",
    });
  }

  /* ============================================================
     Performance dashboard
     ============================================================ */
  function buildFromReal(nav) {
    const base = +nav[0].nav_per_unit;
    const strat = nav.map((n) => (+n.nav_per_unit / base) * 100);
    const labels = nav.map((n) => n.date.slice(5));
    const bench = buildDemoBench(nav.length, 0.008);
    const monthly = [];
    for (let i = 1; i < nav.length; i++) {
      monthly.push({
        label: nav[i].date.slice(5, 7),
        ret: ((+nav[i].nav_per_unit - +nav[i - 1].nav_per_unit) / +nav[i - 1].nav_per_unit) * 100,
      });
    }
    return { labels, strat, bench, monthly, isReal: true, navHistory: nav };
  }

  function buildDemoBench(n, drift) {
    let seed = 20240301;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    let v = 100;
    return Array.from({ length: n }, () => { v *= 1 + drift * (rnd() - 0.46) * 1.5; return v; });
  }

  function buildDemo() {
    let seed = 20240117;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const months = 60;
    const start = new Date(); start.setMonth(start.getMonth() - months + 1);
    const labels = [], strat = [], bench = [], monthly = [];
    let s = 100, b = 100;
    for (let i = 0; i < months; i++) {
      const d = new Date(start); d.setMonth(start.getMonth() + i);
      labels.push(d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }));
      const mkt = (rnd() - 0.46) * 0.06;
      const sr = 0.004 + (rnd() - 0.42) * 0.03 + mkt * 0.35;
      s *= 1 + sr; b *= 1 + mkt;
      strat.push(s); bench.push(b);
      monthly.push({ label: d.toLocaleDateString("en-US", { month: "short" }), ret: sr * 100 });
    }
    return { labels, strat, bench, monthly, isReal: false };
  }

  function renderMetrics(d) {
    const el = document.getElementById("quantMetricRow");
    if (!el) return;
    const last = d.strat[d.strat.length - 1], first = d.strat[0];
    const totRet = (last / first - 1) * 100;
    const years = d.strat.length / 12;
    const cagr = years >= 0.1 ? (Math.pow(last / first, 1 / years) - 1) * 100 : null;
    let peak = -Infinity, maxdd = 0;
    d.strat.forEach((v) => { peak = Math.max(peak, v); maxdd = Math.min(maxdd, v / peak - 1); });
    const rets = d.monthly.map((m) => m.ret / 100);
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length || 0;
    const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length || 1);
    const sharpe = sd ? (mean / sd) * Math.sqrt(12) : 0;
    const wins = (rets.filter((r) => r > 0).length / Math.max(rets.length, 1)) * 100;
    const cards = [
      { v: F.fmtPct(totRet, 1), l: "Cumulative return" + (d.isReal ? "" : " (sim.)") },
      { v: cagr != null ? F.fmtPct(cagr, 1) : "—", l: "CAGR" },
      { v: sharpe.toFixed(2), l: "Sharpe ratio (ann.)" },
      { v: (maxdd * 100).toFixed(1) + "%", l: "Max drawdown" },
      { v: wins.toFixed(0) + "%", l: "Positive periods" },
    ];
    el.innerHTML = cards.map((c) => `<div class="metric reveal"><div class="metric__v">${c.v}</div><div class="metric__l">${c.l}</div></div>`).join("");
    if (d.isReal) {
      const nav = d.navHistory;
      const latest = nav[nav.length - 1];
      el.innerHTML += `<div class="metric reveal"><div class="metric__v mono">${F.fmtNum(latest.nav_per_unit, 2)}</div><div class="metric__l">Latest NAV / unit (${latest.date})</div></div>`;
    }
  }

  function drawEquity(d) {
    const c = document.getElementById("equityChart");
    if (!c || !F) return;
    F.chart.lineChart(c, {
      labels: d.labels,
      series: [
        { values: d.strat, color: "#5eead4", fill: "rgba(94,234,212,0.18)", width: 2.4 },
        { values: d.bench, color: "#5d6b8a", width: 1.6 },
      ],
      yFmt: (v) => v.toFixed(0),
    });
  }

  function drawMonthly(d) {
    const c = document.getElementById("monthlyChart");
    if (!c) return;
    const ratio = devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    const w = rect.width || 600, h = 240;
    c.width = w * ratio; c.height = h * ratio; c.style.height = h + "px";
    const ctx = c.getContext("2d"); ctx.scale(ratio, ratio);
    const data = d.monthly.slice(-24);
    const pad = { t: 14, b: 22, l: 42, r: 8 };
    const maxAbs = Math.max(...data.map((m) => Math.abs(m.ret)), 0.1);
    const bw = (w - pad.l - pad.r) / data.length;
    const zero = pad.t + (h - pad.t - pad.b) / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.beginPath(); ctx.moveTo(pad.l, zero); ctx.lineTo(w - pad.r, zero); ctx.stroke();
    ctx.font = "10px JetBrains Mono, monospace"; ctx.fillStyle = "rgba(147,160,189,0.7)";
    ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText("0%", pad.l - 5, zero);
    data.forEach((m, i) => {
      const x = pad.l + i * bw + bw * 0.18;
      const bh = (Math.abs(m.ret) / maxAbs) * ((h - pad.t - pad.b) / 2);
      ctx.fillStyle = m.ret >= 0 ? "#34d399" : "#f87171";
      ctx.fillRect(x, m.ret >= 0 ? zero - bh : zero, bw * 0.64, bh);
    });
  }

  function drawAllocation() {
    const c = document.getElementById("allocChart");
    const legend = document.getElementById("allocLegend");
    if (!c || !F) return;
    const segs = [
      { label: "SPY (S&P 500)",   value: 40, color: "#5eead4" },
      { label: "QQQ (Nasdaq-100)", value: 32, color: "#6366f1" },
      { label: "DIA (Dow Jones)", value: 16, color: "#818cf8" },
      { label: "Cash / hedge",    value: 12, color: "#3b465f" },
    ];
    F.chart.donut(c, segs);
    if (legend) legend.innerHTML = segs.map((s) =>
      `<li><span class="dot" style="background:${s.color}"></span>${s.label}<b>${s.value}%</b></li>`).join("");
  }
})();
