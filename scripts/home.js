/* ============================================================
   JSS — Home page interactions
   ============================================================ */
(function () {
  "use strict";
  const CFG = window.JSS_CONFIG;
  document.addEventListener("DOMContentLoaded", () => {
    renderStats();
    renderStrategies();
    heroCanvas();
    contactForm();
    loadMarkets();
  });

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
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = form.email.value.trim();
      const name = form.name.value.trim();
      note.classList.remove("is-error");
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        note.textContent = "Please enter your name and a valid email.";
        note.classList.add("is-error");
        return;
      }
      // v1: no backend — store locally so the manager can review demo leads.
      try {
        const leads = JSON.parse(localStorage.getItem("jss_leads") || "[]");
        leads.push({ name, email, message: form.message.value.trim(), at: new Date().toISOString() });
        localStorage.setItem("jss_leads", JSON.stringify(leads));
      } catch (_) {}
      form.reset();
      note.textContent = "Thanks — your request was recorded. We'll be in touch shortly.";
    });
  }
})();
