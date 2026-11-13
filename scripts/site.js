/* ============================================================
   BPSQuant — Shared site chrome: nav, footer, scroll effects,
   reveal-on-scroll, animated counters.
   ============================================================ */
(function () {
  "use strict";
  const CFG = window.JSS_CONFIG || { brand: { name: "BPSQuant" } };
  const page = document.body.dataset.page || "";
  /* Resolved on every call, not captured once: if this file happens to load
     before i18n.js, capturing would freeze a stub and every label would
     render as its key. Without i18n present at all, English still renders. */
  const NO_I18N = { t: (k) => k, lang: "en", other: () => "en", set() {}, onChange() {} };
  const I = new Proxy({}, {
    get(_, prop) {
      const live = window.JSSI18N || NO_I18N;
      const v = live[prop];
      return typeof v === "function" ? v.bind(live) : v;
    },
  });
  const t = (k, v) => I.t(k, v);

  const NAV = [
    { id: "home",       key: "nav.home",       href: "index.html" },
    { id: "quant",      key: "nav.quant",      href: "performance.html" },
    { id: "markets",    key: "nav.markets",    href: "markets.html" },
    { id: "news",       key: "nav.news",       href: "news.html" },
    { id: "discussion", key: "nav.discussion", href: "discussion.html" },
  ];

  /* ---------- header ---------- */
  function header() {
    const links = NAV.map(
      (n) => `<a href="${n.href}" class="${n.id === page ? "is-active" : ""}">${t(n.key)}</a>`
    ).join("");
    return `
    <header class="nav" id="nav">
      <div class="container nav__inner">
        <a class="brand" href="index.html" aria-label="${CFG.brand.full || "BPSQuant"} home">
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
          <button type="button" class="nav__lang" id="siteLangBtn" aria-label="${t("lang.label")}">${t("lang.switch")}</button>
          <a href="portal.html" class="nav__cta ${page === "portal" ? "is-active" : ""}">${t("nav.portal")}</a>
        </nav>
        <button class="nav__toggle" id="navToggle" aria-label="${t("nav.menu")}" aria-expanded="false" aria-controls="mobileMenu">
          <span></span><span></span><span></span>
        </button>
      </div>
      <nav class="nav__mobile" id="mobileMenu" aria-label="Mobile">
        ${links}
        <a href="portal.html">${t("nav.portal")}</a>
        <button type="button" class="nav__lang nav__lang--mobile" id="siteLangBtnMobile">${t("lang.switch")}</button>
      </nav>
    </header>`;
  }

  /* ---------- footer ---------- */
  function footer() {
    const year = new Date().getFullYear();
    const links = NAV.concat([{ key: "nav.portal", href: "portal.html" }])
      .map((n) => `<a href="${n.href}">${t(n.key)}</a>`).join("");
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
        <p>${t("foot.rights", { year, brand: CFG.brand.full || CFG.brand.name })}</p>
        <p class="footer__disclaimer">${t("foot.disclaimer")}</p>
      </div>
    </footer>`;
  }

  /* ---------- mount chrome ---------- */
  function mount() {
    const h = document.querySelector("[data-slot=header]");
    const f = document.querySelector("[data-slot=footer]");
    if (h) h.outerHTML = header();
    if (f) f.outerHTML = footer();
    bindLang();
  }

  /* Re-render the chrome in place. The slots are gone after the first
     mount, so swap the rendered elements instead. */
  function remount() {
    const nav = document.getElementById("nav");
    const foot = document.querySelector(".footer");
    if (nav) nav.outerHTML = header();
    if (foot) foot.outerHTML = footer();
    bindLang();
    navBehavior();
  }

  function bindLang() {
    ["siteLangBtn", "siteLangBtnMobile"].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.onclick = () => I.set(I.other());
    });
  }

  I.onChange(() => remount());

  /* ---------- nav behavior ---------- */
  let _scrollBound = false;

  function navBehavior() {
    const nav = document.getElementById("nav");
    const onScroll = () => {
      const n = document.getElementById("nav");
      if (n) n.classList.toggle("is-scrolled", window.scrollY > 12);
    };
    onScroll();
    // The chrome is re-rendered on a language switch; binding scroll again
    // each time would stack listeners for the life of the page.
    if (!_scrollBound) {
      window.addEventListener("scroll", onScroll, { passive: true });
      _scrollBound = true;
    }

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
