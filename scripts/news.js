/* ============================================================
   JSS — Market news page (CNBC / finance feeds via RSS->JSON)
   ============================================================ */
(function () {
  "use strict";
  const CFG = window.JSS_CONFIG;
  const feeds = (CFG.news && CFG.news.feeds) || [];
  let active = 0;

  document.addEventListener("DOMContentLoaded", () => {
    renderTabs();
    load(0);
  });

  function renderTabs() {
    const el = document.getElementById("newsTabs");
    if (!el) return;
    el.innerHTML = feeds.map((f, i) =>
      `<button class="chip ${i === 0 ? "is-active" : ""}" data-i="${i}">${f.label}</button>`
    ).join("");
    el.querySelectorAll(".chip").forEach((c) =>
      c.addEventListener("click", () => {
        active = parseInt(c.dataset.i, 10);
        el.querySelectorAll(".chip").forEach((x) => x.classList.remove("is-active"));
        c.classList.add("is-active");
        load(active);
      })
    );
  }

  async function load(i) {
    const list = document.getElementById("newsList");
    if (!list) return;
    list.innerHTML = `<div class="snap__loading">Loading headlines…</div>`;
    const items = await window.JSS.getNews(feeds[i]);
    if (!items.length) { list.innerHTML = `<div class="snap__loading">No headlines available.</div>`; return; }
    list.innerHTML = items.map(article).join("");
  }

  function timeAgo(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + "h ago";
    return Math.round(hrs / 24) + "d ago";
  }

  function article(a) {
    const safe = (s) => (s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const ext = a.link && a.link !== "#";
    return `
    <article class="newscard reveal">
      <div class="newscard__meta"><span class="newscard__src">${safe(a.source)}</span><span class="newscard__time">${timeAgo(a.date)}</span></div>
      <h3 class="newscard__title">${safe(a.title)}</h3>
      ${a.desc ? `<p class="newscard__desc">${safe(a.desc)}</p>` : ""}
      ${ext ? `<a class="newscard__link" href="${a.link}" target="_blank" rel="noopener noreferrer">Read on source ↗</a>` : ""}
    </article>`;
  }
})();
