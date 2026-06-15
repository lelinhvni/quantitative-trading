/* ============================================================
   JSS — Home page interactions
   ============================================================ */
(function () {
  "use strict";
  const CFG = window.JSS_CONFIG;
  const F = window.JSS;
  document.addEventListener("DOMContentLoaded", () => {
    renderStats();
    renderStrategies();
    heroCanvas();
    contactForm();
    loadMarkets();
    renderEduCharts();
    let t;
    window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(renderEduCharts, 200); }, { passive: true });
  });

  /* ============================================================
     Educational charts (all illustrative — see on-page disclaimers)
     ============================================================ */
  function renderEduCharts() {
    if (!F || !F.chart) return;
    growthChart();
    regimeChart();
    thetaChart();
    vrpChart();
    cashChart();
  }

  function growthChart() {
    const c = document.getElementById("growthChart");
    if (!c) return;
    const years = 15, start = 10000, savings = 0.04, jss = 0.12;
    const sav = [], fnd = [], labels = [];
    for (let y = 0; y <= years; y++) {
      sav.push(start * Math.pow(1 + savings, y));
      fnd.push(start * Math.pow(1 + jss, y));
      labels.push(y === 0 ? "Now" : "Yr " + y);
    }
    F.chart.lineChart(c, {
      labels,
      series: [
        { values: sav, color: "#5d6b8a", width: 2 },
        { values: fnd, color: "#5eead4", fill: "rgba(94,234,212,0.16)", width: 2.6 },
      ],
      yFmt: (v) => "$" + Math.round(v / 1000) + "k",
    });
    const cap = document.getElementById("growthCaption");
    if (cap) {
      const savEnd = sav[years], fndEnd = fnd[years];
      cap.textContent = `In this illustration, the savings balance grows to about ${F.fmtMoney(savEnd, 0)}, while the JSS-style path reaches about ${F.fmtMoney(fndEnd, 0)} — roughly ${F.fmtMoney(fndEnd - savEnd, 0)} more, purely from compounding a higher rate. Actual returns will differ and are not guaranteed.`;
    }
  }

  function regimeChart() {
    const c = document.getElementById("regimeChart");
    if (!c) return;
    const trad = "#5d6b8a", jss = "#818cf8";
    F.chart.barChart(c, {
      yFmt: (v) => (v > 0 ? "+" : "") + Math.round(v) + "%",
      groups: [
        { label: "Rising market",   bars: [{ value: 15, color: trad }, { value: 12, color: jss }] },
        { label: "Flat / choppy",   bars: [{ value: 1,  color: trad }, { value: 15, color: jss }] },
        { label: "Falling market",  bars: [{ value: -20, color: trad }, { value: 10, color: jss }] },
      ],
    });
  }

  function thetaChart() {
    const c = document.getElementById("thetaChart");
    if (!c) return;
    const vals = [], labels = [];
    for (let d = 90; d >= 0; d -= 3) {
      vals.push(+(100 * Math.sqrt(d / 90)).toFixed(2));
      labels.push(d === 90 ? "90 days" : d === 0 ? "Expiry" : "");
    }
    F.chart.lineChart(c, {
      labels,
      series: [{ values: vals, color: "#5eead4", fill: "rgba(94,234,212,0.18)", width: 2.6 }],
      yFmt: (v) => Math.round(v) + "¢",
    });
  }

  function vrpChart() {
    const c = document.getElementById("vrpChart");
    if (!c) return;
    const n = 26, iv = [], rv = [], labels = [];
    for (let i = 0; i < n; i++) {
      const wig = Math.sin(i * 0.7) * 2.4 + Math.sin(i * 1.9) * 1.1;
      iv.push(+(20 + wig).toFixed(2));
      rv.push(+(13.5 + wig * 0.7).toFixed(2));
      labels.push(i === 0 ? "" : i === n - 1 ? "" : "");
    }
    F.chart.lineChart(c, {
      labels,
      series: [
        { values: iv, color: "#818cf8", fill: "rgba(129,140,248,0.14)", width: 2.4 },
        { values: rv, color: "#5eead4", width: 2.4 },
      ],
      yFmt: (v) => Math.round(v) + "%",
    });
  }

  function cashChart() {
    const c = document.getElementById("cashChart");
    if (!c) return;
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const seed = [0.9, 1.1, 0.8, 1.3, 1.0, 0.7, 1.2, 0.95, 1.15, 0.85, 1.25, 1.05];
    F.chart.barChart(c, {
      yFmt: (v) => v.toFixed(1) + "%",
      groups: months.map((m, i) => ({ label: m, bars: [{ value: seed[i], color: "#5eead4" }] })),
    });
  }

  function renderStats() {
    const el = document.getElementById("statsGrid");
    if (!el) return;
    el.innerHTML = (CFG.metrics || []).map((m) => `
      <div class="stat reveal">
        <div class="stat__value" data-target="${m.value}" data-decimals="${m.decimals || 0}"
             data-prefix="${m.prefix || ""}" data-suffix="${m.suffix || ""}">0</div>
        <div class="stat__label">${m.label}</div>
      </div>`).join("");
  }

  function renderStrategies() {
    const el = document.getElementById("stratCards");
    if (!el) return;
    el.innerHTML = (CFG.strategies || []).map((s) => `
      <article class="card reveal">
        <div class="card__icon">${s.icon}</div>
        <h3>${s.title}</h3>
        <p>${s.desc}</p>
      </article>`).join("");
  }

  async function loadMarkets() {
    const grid = document.getElementById("snapGrid");
    const ticker = document.getElementById("tickerTrack");
    if (!grid && !ticker) return;
    try {
      const quotes = await Promise.all((CFG.tickers || []).map((t) => window.JSS.getQuote(t, 60)));
      if (grid) {
        grid.innerHTML = quotes.map((q, i) => {
          const up = q.changePct >= 0;
          return `
          <a class="snap__card reveal ${up ? "is-up" : "is-down"}" href="markets.html">
            <div class="snap__top">
              <span class="snap__sym">${q.symbol}</span>
              <span class="snap__chg">${window.JSS.fmtPct(q.changePct)}</span>
            </div>
            <div class="snap__price">${window.JSS.fmtMoney(q.close)}</div>
            <canvas class="snap__spark" id="spark-${q.symbol}" height="44"></canvas>
            <div class="snap__range"><span>60d L ${window.JSS.fmtNum(q.lo60)}</span><span>H ${window.JSS.fmtNum(q.hi60)}</span></div>
          </a>`;
        }).join("");
        quotes.forEach((q) => {
          const c = document.getElementById("spark-" + q.symbol);
          if (c) window.JSS.chart.sparkline(c, q.rows.slice(-60).map((r) => r.close), q.changePct >= 0 ? "#34d399" : "#f87171");
        });
      }
      if (ticker) {
        const items = quotes.map((q) => {
          const up = q.changePct >= 0;
          return `<span class="tick"><b>${q.symbol}</b>${window.JSS.fmtNum(q.close)} <span class="${up ? "up" : "down"}">${window.JSS.fmtPct(q.changePct)}</span></span>`;
        }).join("");
        ticker.innerHTML = items + items; // duplicate for seamless scroll
      }
    } catch (e) {
      if (grid) grid.innerHTML = `<div class="snap__loading">Market data unavailable right now.</div>`;
    }
  }

  /* hero animated grid + particles */
  function heroCanvas() {
    const canvas = document.getElementById("heroCanvas");
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    let w, h, pts, raf;
    const N = 46;
    function size() {
      w = canvas.width = canvas.offsetWidth * devicePixelRatio;
      h = canvas.height = canvas.offsetHeight * devicePixelRatio;
    }
    function init() {
      pts = Array.from({ length: N }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25 * devicePixelRatio,
        vy: (Math.random() - 0.5) * 0.25 * devicePixelRatio,
      }));
    }
    function frame() {
      ctx.clearRect(0, 0, w, h);
      pts.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      });
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d = Math.hypot(dx, dy);
          const max = 130 * devicePixelRatio;
          if (d < max) {
            ctx.strokeStyle = `rgba(99,102,241,${0.18 * (1 - d / max)})`;
            ctx.lineWidth = devicePixelRatio;
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
          }
        }
      }
      pts.forEach((p) => {
        ctx.fillStyle = "rgba(94,234,212,0.55)";
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.6 * devicePixelRatio, 0, Math.PI * 2); ctx.fill();
      });
      raf = requestAnimationFrame(frame);
    }
    size(); init(); frame();
    window.addEventListener("resize", () => { cancelAnimationFrame(raf); size(); init(); frame(); });
  }

  function contactForm() {
    const form = document.getElementById("contactForm");
    if (!form) return;
    const note = document.getElementById("formNote");
    // Try to init DB for lead submission (anon INSERT is allowed by RLS)
    const DB = window.JSSDB;
    const dbReady = DB && DB.init();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = form.email.value.trim();
      const name = form.name.value.trim();
      note.classList.remove("is-error");
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        note.textContent = "Please enter your name and a valid email.";
        note.classList.add("is-error");
        return;
      }
      const message = form.message.value.trim();
      if (dbReady) {
        try {
          await DB.submitLead({ name, email, message });
        } catch (err) {
          console.warn("[JSS] Lead save to DB failed, falling back to localStorage:", err.message);
          saveLeadLocally(name, email, message);
        }
      } else {
        saveLeadLocally(name, email, message);
      }
      form.reset();
      note.textContent = "Thanks — we received your message and will be in touch shortly.";
    });
  }

  function saveLeadLocally(name, email, message) {
    try {
      const leads = JSON.parse(localStorage.getItem("jss_leads") || "[]");
      leads.push({ name, email, message, at: new Date().toISOString() });
      localStorage.setItem("jss_leads", JSON.stringify(leads));
    } catch (_) {}
  }
})();
