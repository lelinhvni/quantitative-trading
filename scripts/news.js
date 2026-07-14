/* ============================================================
   BPSQuant — Market news page (CNBC / Yahoo Finance via RSS->JSON)
   Featured lead story + grid; each item opens the full article
   on the source site in a new browser tab.
   ============================================================ */
(function () {
  "use strict";
  const CFG = window.JSS_CONFIG;
  const feeds = (CFG.news && CFG.news.feeds) || [];
  let active = 0;
  let timer = null;

  document.addEventListener("DOMContentLoaded", () => {
    renderTabs();
    bindRefresh();
    load(0);
    // Auto-refresh the active feed periodically (page promises live-through-the-day).
    const ms = Math.max(120000, (CFG.data && CFG.data.refreshMs ? CFG.data.refreshMs * 3 : 180000));
    timer = setInterval(() => load(active, true), ms);
  });

  function bindRefresh() {
    const btn = document.getElementById("newsRefresh");
    if (btn) btn.addEventListener("click", () => load(active));
  }

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

  async function load(i, quiet) {
    const feat = document.getElementById("newsFeatured");
    const list = document.getElementById("newsList");
    if (!list) return;
    if (!quiet) {
      if (feat) feat.innerHTML = "";
      list.innerHTML = `<div class="snap__loading">Loading headlines…</div>`;
    }

    const items = await window.JSS.getNews(feeds[i]);
    if (!items.length) {
      if (!quiet) list.innerHTML = `<div class="snap__loading">No headlines available.</div>`;
      return;
    }
    if (feat && items.length) feat.innerHTML = featured(items[0]);
    list.innerHTML = items.slice(1).map(card).join("");
    const upd = document.getElementById("newsUpdated");
    if (upd) upd.textContent = "Updated " + new Date().toLocaleTimeString();
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

  const safe = (s) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u.replace(/"/g, "%22") : "");

  function meta(a) {
    return `<div class="newscard__meta"><span class="newscard__src">${safe(a.source)}</span><span class="newscard__time">${timeAgo(a.date)}</span></div>`;
  }

  function featured(a) {
    const url = safeUrl(a.link);
    const open = url ? `href="${url}" target="_blank" rel="noopener noreferrer"` : "";
    const Tag = url ? "a" : "article";
    const hasImg = !!a.image;
    return `
    <${Tag} class="news-featured reveal ${hasImg ? "" : "news-featured--noimg"}" ${open}>
      ${hasImg ? `<div class="news-featured__img" style="background-image:url('${safeUrl(a.image)}')"></div>` : ""}
      <div class="news-featured__body">
        <span class="news-featured__badge">Top story</span>
        ${meta(a)}
        <h2 class="news-featured__title">${safe(a.title)}</h2>
        ${a.desc ? `<p class="news-featured__desc">${safe(a.desc)}</p>` : ""}
        ${url ? `<span class="newscard__link">Read full story ↗</span>` : ""}
      </div>
    </${Tag}>`;
  }

  function card(a) {
    const url = safeUrl(a.link);
    const open = url ? `href="${url}" target="_blank" rel="noopener noreferrer"` : "";
    const Tag = url ? "a" : "article";
    return `
    <${Tag} class="newscard reveal ${url ? "newscard--link" : ""}" ${open}>
      ${a.image ? `<div class="newscard__img" style="background-image:url('${safeUrl(a.image)}')"></div>` : ""}
      <div class="newscard__body">
        ${meta(a)}
        <h3 class="newscard__title">${safe(a.title)}</h3>
        ${a.desc ? `<p class="newscard__desc">${safe(a.desc)}</p>` : ""}
        ${url ? `<span class="newscard__link">Read full story ↗</span>` : ""}
      </div>
    </${Tag}>`;
  }
})();
