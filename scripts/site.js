/* ============================================================
   JSS — Shared site chrome: nav, footer, scroll effects,
   reveal-on-scroll, animated counters.
   ============================================================ */
(function () {
  "use strict";
  const CFG = window.JSS_CONFIG || { brand: { name: "JSS" } };
  const page = document.body.dataset.page || "";

  const NAV = [
    { id: "home",        label: "Home",        href: "index.html" },
    { id: "performance", label: "Performance", href: "performance.html" },
    { id: "trades",      label: "Trades",      href: "trades.html" },
    { id: "markets",     label: "Markets",     href: "markets.html" },
    { id: "news",        label: "News",        href: "news.html" },
  ];

  /* ---------- header ---------- */
  function header() {
    const links = NAV.map(
      (n) => `<a href="${n.href}" class="${n.id === page ? "is-active" : ""}">${n.label}</a>`
    ).join("");
    return `
    <header class="nav" id="nav">
      <div class="container nav__inner">
        <a class="brand" href="index.html" aria-label="${CFG.brand.full || "JSS"} home">
          <svg class="brand__mark" width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M16 2 2 9v14l14 7 14-7V9L16 2Z" stroke="url(#bg)" stroke-width="2" stroke-linejoin="round"/>
            <path d="M9 19l4-5 4 3 6-8" stroke="url(#bg)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <defs><linearGradient id="bg" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
              <stop stop-color="#5eead4"/><stop offset="1" stop-color="#6366f1"/></linearGradient></defs>
          </svg>
          <span class="brand__name">${CFG.brand.name}</span>
        </a>
        <nav class="nav__links" aria-label="Primary">
          ${links}
          <a href="portal.html" class="nav__cta ${page === "portal" ? "is-active" : ""}">Investor portal</a>
        </nav>
        <button class="nav__toggle" id="navToggle" aria-label="Toggle menu" aria-expanded="false" aria-controls="mobileMenu">
          <span></span><span></span><span></span>
        </button>
      </div>
      <nav class="nav__mobile" id="mobileMenu" aria-label="Mobile">
        ${links}
        <a href="portal.html">Investor portal</a>
      </nav>
    </header>`;
  }

  /* ---------- footer ---------- */
  function footer() {
    const year = new Date().getFullYear();
    const links = NAV.concat([{ label: "Investor portal", href: "portal.html" }])
      .map((n) => `<a href="${n.href}">${n.label}</a>`).join("");
    return `
    <footer class="footer">
      <div class="container footer__inner">
        <div class="footer__brand">
          <span class="brand__name">${CFG.brand.full || CFG.brand.name}</span>
          <p>${CFG.brand.tagline || ""}</p>
          <a class="footer__mail" href="mailto:${CFG.brand.email}">${CFG.brand.email}</a>
        </div>
        <nav class="footer__links" aria-label="Footer">${links}</nav>
      </div>
      <div class="container footer__bottom">
        <p>© ${year} ${CFG.brand.full || CFG.brand.name}. For informational purposes only — not investment advice.</p>
        <p class="footer__disclaimer">Performance figures may be simulated or illustrative. Investing involves risk of loss.</p>
      </div>
    </footer>`;
  }

  /* ---------- mount chrome ---------- */
  function mount() {
    const h = document.querySelector("[data-slot=header]");
    const f = document.querySelector("[data-slot=footer]");
    if (h) h.outerHTML = header();
    if (f) f.outerHTML = footer();
  }

  /* ---------- nav behavior ---------- */
  function navBehavior() {
    const nav = document.getElementById("nav");
    const onScroll = () => nav && nav.classList.toggle("is-scrolled", window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const toggle = document.getElementById("navToggle");
    const menu = document.getElementById("mobileMenu");
    if (toggle && menu) {
      toggle.addEventListener("click", () => {
        const open = menu.classList.toggle("is-open");
        toggle.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", String(open));
      });
      menu.querySelectorAll("a").forEach((a) =>
        a.addEventListener("click", () => {
          menu.classList.remove("is-open");
          toggle.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
        })
      );
    }
  }

  /* ---------- reveal on scroll ---------- */
  function reveal() {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".reveal").forEach((e) => e.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); }
      }),
      { threshold: 0.08, rootMargin: "0px 0px -20px 0px" }
    );
    document.querySelectorAll(".reveal").forEach((e) => io.observe(e));

    // Auto-observe .reveal elements injected dynamically (async data, portals etc.)
    new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          const newEls = node.classList && node.classList.contains("reveal")
            ? [node]
            : Array.from(node.querySelectorAll(".reveal"));
          newEls.forEach((e) => { if (!e.classList.contains("is-visible")) io.observe(e); });
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- animated counters ---------- */
  function counters() {
    const els = document.querySelectorAll("[data-target]");
    if (!els.length) return;
    const run = (el) => {
      const target = parseFloat(el.dataset.target);
      const dec = parseInt(el.dataset.decimals || "0", 10);
      const pre = el.dataset.prefix || "", suf = el.dataset.suffix || "";
      const dur = 1300; const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min((t - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = pre + (target * eased).toFixed(dec) + suf;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if (!("IntersectionObserver" in window)) { els.forEach(run); return; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } }),
      { threshold: 0.5 }
    );
    els.forEach((e) => io.observe(e));
  }

  document.addEventListener("DOMContentLoaded", () => {
    mount();
    navBehavior();
    reveal();
    counters();
  });
})();
