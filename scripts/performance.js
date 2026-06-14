/* ============================================================
   JSS — Performance dashboard
   ============================================================ */
(function () {
  "use strict";
  const F = window.JSS;

  document.addEventListener("DOMContentLoaded", () => {
    const data = buildSeries();
    metrics(data);
    drawEquity(data);
    drawMonthly(data);
    drawAllocation();
    window.addEventListener("resize", debounce(() => {
      drawEquity(data); drawMonthly(data); drawAllocation();
    }, 200));
  });

  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  /* deterministic series: ~5 years of monthly points */
  function buildSeries() {
    let seed = 20240117;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const months = 60;
    const start = new Date(); start.setMonth(start.getMonth() - months + 1);
    const labels = [], strat = [], bench = [], monthly = [];
    let s = 100, b = 100;
    for (let i = 0; i < months; i++) {
      const d = new Date(start); d.setMonth(start.getMonth() + i);
      labels.push(d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }));
      const mkt = (rnd() - 0.46) * 0.06;            // benchmark monthly return
      const alpha = 0.004 + (rnd() - 0.42) * 0.03;  // strategy: small edge, lower vol
      const sr = alpha + mkt * 0.35;                 // partial market exposure
      s *= 1 + sr; b *= 1 + mkt;
      strat.push(s); bench.push(b);
      monthly.push({ label: d.toLocaleDateString("en-US", { month: "short" }), ret: sr * 100 });
    }
    return { labels, strat, bench, monthly };
  }

  function metrics(d) {
    const el = document.getElementById("metricRow");
    if (!el) return;
    const totRet = (d.strat[d.strat.length - 1] / d.strat[0] - 1) * 100;
    const years = d.strat.length / 12;
    const cagr = (Math.pow(d.strat[d.strat.length - 1] / d.strat[0], 1 / years) - 1) * 100;
    let peak = -Infinity, maxdd = 0;
    d.strat.forEach((v) => { peak = Math.max(peak, v); maxdd = Math.min(maxdd, v / peak - 1); });
    const rets = d.monthly.map((m) => m.ret / 100);
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length);
    const sharpe = (mean / sd) * Math.sqrt(12);
    const wins = (rets.filter((r) => r > 0).length / rets.length) * 100;
    const cards = [
      { v: F.fmtPct(totRet, 0), l: "Cumulative return (sim.)" },
      { v: F.fmtPct(cagr, 1), l: "CAGR" },
      { v: sharpe.toFixed(2), l: "Sharpe ratio" },
      { v: (maxdd * 100).toFixed(1) + "%", l: "Max drawdown" },
      { v: wins.toFixed(0) + "%", l: "Positive months" },
    ];
    el.innerHTML = cards.map((c) => `<div class="metric reveal"><div class="metric__v">${c.v}</div><div class="metric__l">${c.l}</div></div>`).join("");
  }

  function drawEquity(d) {
    const c = document.getElementById("equityChart");
    if (!c) return;
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
    const w = rect.width, h = 240;
    c.width = w * ratio; c.height = h * ratio; c.style.height = h + "px";
    const ctx = c.getContext("2d"); ctx.scale(ratio, ratio);
    const data = d.monthly.slice(-24);
    const pad = { t: 14, b: 22, l: 36, r: 8 };
    const maxAbs = Math.max(...data.map((m) => Math.abs(m.ret))) || 1;
    const bw = (w - pad.l - pad.r) / data.length;
    const zero = pad.t + (h - pad.t - pad.b) / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.beginPath(); ctx.moveTo(pad.l, zero); ctx.lineTo(w - pad.r, zero); ctx.stroke();
    ctx.font = "10px JetBrains Mono, monospace"; ctx.fillStyle = "rgba(147,160,189,0.7)"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText("0%", pad.l - 6, zero);
    data.forEach((m, i) => {
      const x = pad.l + i * bw + bw * 0.18;
      const bh = (Math.abs(m.ret) / maxAbs) * ((h - pad.t - pad.b) / 2);
      ctx.fillStyle = m.ret >= 0 ? "#34d399" : "#f87171";
      if (m.ret >= 0) ctx.fillRect(x, zero - bh, bw * 0.64, bh);
      else ctx.fillRect(x, zero, bw * 0.64, bh);
    });
  }

  function drawAllocation() {
    const c = document.getElementById("allocChart");
    const legend = document.getElementById("allocLegend");
    if (!c) return;
    const segs = [
      { label: "SPY (S&P 500)", value: 40, color: "#5eead4" },
      { label: "QQQ (Nasdaq-100)", value: 32, color: "#6366f1" },
      { label: "DIA (Dow Jones)", value: 16, color: "#818cf8" },
      { label: "Cash / hedge", value: 12, color: "#3b465f" },
    ];
    F.chart.donut(c, segs);
    if (legend) legend.innerHTML = segs.map((s) =>
      `<li><span class="dot" style="background:${s.color}"></span>${s.label}<b>${s.value}%</b></li>`).join("");
  }
})();
