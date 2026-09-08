/* ============================================================
   BPSQuant — Discussion board
   Topics + threaded replies stored in localStorage.
   ============================================================ */
(function () {
  "use strict";

  const STORE_KEY = "jss_discussion_v1";
  const COLORS = ["sticky--teal", "sticky--indigo", "sticky--yellow", "sticky--green", "sticky--red"];

  /* ---- Attachments ----------------------------------------------------
     Files are held as data URLs alongside the post in localStorage, so
     they stay small on purpose. Only these types are ever accepted or
     rendered — anything else is rejected at pick time and again at
     render time, so a hand-edited store can't inject an active type.  */
  const MAX_FILES = 3;
  const MAX_BYTES = 300 * 1024;                  // 300 KB per file
  const ALLOWED = {
    "image/png": "PNG", "image/jpeg": "JPG", "image/gif": "GIF",
    "image/webp": "WEBP", "application/pdf": "PDF",
    "text/plain": "TXT", "text/csv": "CSV",
  };
  const ACCEPT = Object.keys(ALLOWED).join(",");

  /* pending picks, cleared once the post is saved */
  let pendingTopic = [];
  const pendingReply = {};                        // topicId -> [file objects]

  function fmtBytes(n) {
    return n < 1024 ? n + " B"
      : n < 1024 * 1024 ? (n / 1024).toFixed(0) + " KB"
      : (n / (1024 * 1024)).toFixed(1) + " MB";
  }

  /* Read picked files into {name,type,size,dataUrl}; returns errors too */
  function readFiles(fileList, existing) {
    const errors = [];
    const room = MAX_FILES - existing.length;
    const picked = Array.from(fileList);
    if (picked.length > room) {
      errors.push(`Up to ${MAX_FILES} files per post.`);
    }
    const jobs = picked.slice(0, Math.max(0, room)).map((f) => new Promise((resolve) => {
      if (!ALLOWED[f.type]) {
        errors.push(`${f.name}: only images, PDF, TXT and CSV are allowed.`);
        return resolve(null);
      }
      if (f.size > MAX_BYTES) {
        errors.push(`${f.name} is ${fmtBytes(f.size)} — the limit is ${fmtBytes(MAX_BYTES)}.`);
        return resolve(null);
      }
      const reader = new FileReader();
      reader.onload = () => resolve({ name: f.name, type: f.type, size: f.size, dataUrl: reader.result });
      reader.onerror = () => { errors.push(`${f.name}: could not be read.`); resolve(null); };
      reader.readAsDataURL(f);
    }));
    return Promise.all(jobs).then((res) => ({ files: res.filter(Boolean), errors }));
  }

  /* A stored attachment is only trusted if its data URL matches its type */
  function safeAttachment(a) {
    return a && ALLOWED[a.type] && typeof a.dataUrl === "string" &&
      a.dataUrl.startsWith("data:" + a.type + ";base64,");
  }

  /* ---- Seed topics (shown until user adds their own) ---- */
  const SEED_TOPICS = [
    {
      id: "seed-1",
      title: "📌 Market outlook — where are we headed?",
      body: "The Fed held rates again last week. Volatility is compressing. Good time to be selling premium? Share your read on the macro backdrop.",
      author: "BPSQuant",
      createdAt: "2026-06-20T08:00:00Z",
      pinned: true,
      color: "sticky--teal",
      replies: [
        { id: "r-1-1", author: "Alex T.", body: "IV looks cheap right now. I'm cautious about adding size before the next CPI print.", createdAt: "2026-06-20T10:12:00Z" },
        { id: "r-1-2", author: "Sam K.", body: "VIX under 14 historically favours iron condors on SPY. Happy to stay patient.", createdAt: "2026-06-21T09:45:00Z" },
      ],
    },
    {
      id: "seed-2",
      title: "📌 Options 101 — beginners ask anything here",
      body: "New to options? Drop your questions in this thread. No silly questions — we were all beginners once. Our team monitors this thread weekly.",
      author: "BPSQuant",
      createdAt: "2026-06-18T09:00:00Z",
      pinned: true,
      color: "sticky--indigo",
      replies: [
        { id: "r-2-1", author: "Emma L.", body: "What's the difference between a put and a call? Still getting my head around it.", createdAt: "2026-06-19T14:30:00Z" },
        { id: "r-2-2", author: "BPSQuant", body: "Great question Emma! A call gives you the right to BUY a stock at a set price. A put gives you the right to SELL. When we SELL a put, we're agreeing to buy the stock if it falls — and we get paid a premium for that promise.", createdAt: "2026-06-19T16:00:00Z" },
      ],
    },
    {
      id: "seed-3",
      title: "The Wheel strategy — share your experiences",
      body: "Has anyone run The Wheel on dividend stocks? Curious if combining covered calls with dividend income is worth the extra complexity vs. pure ETF wheel.",
      author: "Kevin L.",
      createdAt: "2026-06-22T11:15:00Z",
      pinned: false,
      color: "sticky--yellow",
      replies: [
        { id: "r-3-1", author: "Marcus D.", body: "I do this on O (Realty Income). The premium is decent and the dividend acts as a buffer if you get assigned and have to wait for the stock to recover.", createdAt: "2026-06-22T14:20:00Z" },
      ],
    },
    {
      id: "seed-4",
      title: "Iron condors vs. straddles in low-vol environments",
      body: "When VIX is sub-15, I find straddles aren't worth it. Iron condors still seem to produce decent risk/reward in this environment. Anyone else comparing these two strategies right now?",
      author: "Priya M.",
      createdAt: "2026-06-23T08:45:00Z",
      pinned: false,
      color: "sticky--green",
      replies: [],
    },
    {
      id: "seed-5",
      title: "QQQ or SPY for options selling?",
      body: "QQQ tends to have higher IV than SPY but is more volatile. Which do you prefer for systematic premium selling and why?",
      author: "David W.",
      createdAt: "2026-06-24T16:00:00Z",
      pinned: false,
      color: "sticky--teal",
      replies: [
        { id: "r-5-1", author: "Kevin L.", body: "We use both. SPY for larger size (more liquid, tighter spreads), QQQ for when we want a bit more premium. The key is keeping total notional across both to a level you're comfortable with.", createdAt: "2026-06-25T09:10:00Z" },
      ],
    },
  ];

  /* ============================================================
     State & persistence
     ============================================================ */
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  }

  /* Returns true on success; false when the browser store is full
     (attachments are the usual cause, so the caller can say so). */
  function save(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); return true; }
    catch (_) { return false; }
  }

  function getData() {
    const stored = load();
    if (stored && stored.topics && stored.topics.length) return stored;
    return { topics: SEED_TOPICS.map((t) => ({ ...t, replies: [...t.replies] })) };
  }

  function saveData(data) {
    return save(data);
  }

  /* ============================================================
     Attachment rendering
     ============================================================ */
  /* Posted attachments: images inline, everything else a download chip */
  function attachmentsHtml(list) {
    const files = (list || []).filter(safeAttachment);
    if (!files.length) return "";
    return `<div class="att-grid">${files.map((a) => {
      const name = escHtml(a.name);
      if (a.type.startsWith("image/")) {
        return `<a class="att-thumb" href="${a.dataUrl}" download="${name}" title="${name}">
          <img src="${a.dataUrl}" alt="${name}" loading="lazy" />
        </a>`;
      }
      return `<a class="att-file" href="${a.dataUrl}" download="${name}">
        <span class="att-file__ext">${ALLOWED[a.type]}</span>
        <span class="att-file__meta"><b>${name}</b><span>${fmtBytes(a.size)}</span></span>
      </a>`;
    }).join("")}</div>`;
  }

  /* Picker: attach button + chips for files queued but not yet posted */
  function pickerHtml(scope) {
    return `
    <div class="attach" data-scope="${scope}">
      <div class="attach__row">
        <label class="attach__btn">
          📎 Attach files
          <input type="file" class="attach__input" multiple accept="${ACCEPT}" hidden />
        </label>
        <span class="attach__hint">Images, PDF, TXT or CSV · max ${fmtBytes(MAX_BYTES)} each · up to ${MAX_FILES}</span>
      </div>
      <div class="attach__chips"></div>
      <p class="attach__err" role="status" aria-live="polite"></p>
    </div>`;
  }

  function chipsHtml(files) {
    return files.map((f, i) => `
      <span class="attach__chip">
        ${f.type.startsWith("image/") ? `<img src="${f.dataUrl}" alt="" />` : `<span class="attach__chip__ext">${ALLOWED[f.type]}</span>`}
        <span class="attach__chip__name">${escHtml(f.name)}</span>
        <span class="attach__chip__size">${fmtBytes(f.size)}</span>
        <button type="button" class="attach__chip__x" data-i="${i}" aria-label="Remove ${escHtml(f.name)}">×</button>
      </span>`).join("");
  }

  /* Wire one picker to its pending-file array. getList/setList let the
     same code serve the modal (one array) and each reply form. */
  function bindPicker(root, getList, setList) {
    if (!root || root.dataset.bound) return;
    root.dataset.bound = "1";
    const input = root.querySelector(".attach__input");
    const chips = root.querySelector(".attach__chips");
    const err = root.querySelector(".attach__err");

    const paint = () => {
      const list = getList();
      chips.innerHTML = chipsHtml(list);
      chips.querySelectorAll(".attach__chip__x").forEach((b) =>
        b.addEventListener("click", () => {
          const next = getList().slice();
          next.splice(+b.dataset.i, 1);
          setList(next);
          paint();
        })
      );
    };

    input.addEventListener("change", () => {
      err.textContent = "";
      readFiles(input.files, getList()).then(({ files, errors }) => {
        if (files.length) setList(getList().concat(files));
        err.textContent = errors.join(" ");
        input.value = "";
        paint();
      });
    });

    paint();
  }

  /* ============================================================
     Rendering
     ============================================================ */
  let openId = null;

  function render() {
    const data = getData();
    const grid = document.getElementById("boardGrid");
    const count = document.getElementById("boardCount");
    if (!grid) return;

    // Pinned first, then by date desc
    const sorted = [...data.topics].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    if (count) count.textContent = `${sorted.length} topic${sorted.length !== 1 ? "s" : ""}`;

    grid.innerHTML = sorted.map((t) => stickyHtml(t)).join("");

    sorted.forEach((t) => {
      const card = document.getElementById("sticky-" + t.id);
      if (!card) return;
      card.querySelector(".sticky__header").addEventListener("click", (e) => {
        // let attachment links work without collapsing the card
        if (e.target.closest("a")) return;
        toggleOpen(t.id);
      });
      const form = card.querySelector(".thread__submit");
      if (form) form.addEventListener("click", () => submitReply(t.id, card));
      bindPicker(
        card.querySelector(".attach"),
        () => pendingReply[t.id] || [],
        (list) => { pendingReply[t.id] = list; }
      );
    });
  }

  function stickyHtml(t) {
    const isOpen = openId === t.id;
    const pinHtml = t.pinned ? `<div class="sticky__pin" aria-hidden="true"></div>` : "";
    const ago = relTime(t.createdAt);
    const repliesHtml = t.replies.length
      ? t.replies.map((r) => replyHtml(r)).join("")
      : `<p class="pos__note" style="padding:8px 0">No replies yet — be the first.</p>`;

    return `
    <div class="sticky ${t.color || "sticky--teal"}${isOpen ? " is-open" : ""}" id="sticky-${t.id}" role="article">
      ${pinHtml}
      <div class="sticky__header" style="cursor:pointer" role="button" tabindex="0" aria-expanded="${isOpen}"
           onkeydown="if(event.key==='Enter'||event.key===' ')this.click()">
        <div class="sticky__title">${escHtml(t.title)}</div>
        <div class="sticky__body">${escHtml(t.body)}</div>
        ${attachmentsHtml(t.files)}
        <div class="sticky__meta">
          <span>${escHtml(t.author || "Anonymous")} · ${ago}</span>
          <span class="sticky__replies">${t.replies.length} repl${t.replies.length !== 1 ? "ies" : "y"} <span class="sticky__caret">▼</span></span>
        </div>
      </div>
      <div class="thread">
        <div class="thread__list">${repliesHtml}</div>
        <div class="thread__form">
          <div class="thread__form__row">
            <input class="thread__author-input" type="text" placeholder="Your name (optional)" maxlength="40" />
          </div>
          <textarea class="thread__reply-input" placeholder="Add to the conversation…" maxlength="600" rows="3"></textarea>
          ${pickerHtml("reply")}
          <div style="display:flex;justify-content:flex-end;align-items:center;gap:12px">
            <span class="cta__note thread__err" role="status" aria-live="polite"></span>
            <button class="btn btn--primary btn--sm thread__submit" type="button">Reply</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function replyHtml(r) {
    return `
    <div class="thread__reply">
      <div class="thread__reply__meta">
        <span class="thread__reply__author">${escHtml(r.author || "Anonymous")}</span>
        <span class="thread__reply__time">${relTime(r.createdAt)}</span>
      </div>
      <div class="thread__reply__body">${escHtml(r.body)}</div>
      ${attachmentsHtml(r.files)}
    </div>`;
  }

  function toggleOpen(id) {
    openId = openId === id ? null : id;
    render();
    if (openId) {
      setTimeout(() => {
        const el = document.getElementById("sticky-" + openId);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 50);
    }
  }

  function submitReply(topicId, card) {
    const authorEl = card.querySelector(".thread__author-input");
    const bodyEl = card.querySelector(".thread__reply-input");
    const errEl = card.querySelector(".thread__err");
    const body = bodyEl ? bodyEl.value.trim() : "";
    const author = authorEl ? authorEl.value.trim() || "Anonymous" : "Anonymous";
    const files = pendingReply[topicId] || [];
    if (errEl) errEl.textContent = "";
    if (!body && !files.length) { bodyEl && bodyEl.focus(); return; }

    const data = getData();
    const topic = data.topics.find((t) => t.id === topicId);
    if (!topic) return;
    topic.replies.push({
      id: "r-" + Date.now(),
      author,
      body,
      files,
      createdAt: new Date().toISOString(),
    });
    if (!saveData(data)) {
      if (errEl) errEl.textContent = "Not enough browser storage — try smaller attachments.";
      return;
    }
    delete pendingReply[topicId];
    render();
  }

  /* ============================================================
     New topic modal
     ============================================================ */
  function bindModal() {
    const overlay = document.getElementById("modalOverlay");
    const btn = document.getElementById("newTopicBtn");
    const cancel = document.getElementById("modalCancel");
    const submit = document.getElementById("modalSubmit");
    const err = document.getElementById("modalErr");

    if (btn) btn.addEventListener("click", () => {
      if (overlay) overlay.classList.remove("is-hidden");
      bindPicker(
        document.querySelector("#modalOverlay .attach"),
        () => pendingTopic,
        (list) => { pendingTopic = list; }
      );
    });
    if (cancel) cancel.addEventListener("click", closeModal);
    if (overlay) overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

    if (submit) {
      submit.addEventListener("click", () => {
        const title = document.getElementById("newTitle").value.trim();
        const body = document.getElementById("newBody").value.trim();
        const author = document.getElementById("newAuthor").value.trim() || "Anonymous";
        if (err) err.textContent = "";
        if (!title) { if (err) err.textContent = "Please enter a topic title."; document.getElementById("newTitle").focus(); return; }
        if (!body) { if (err) err.textContent = "Please add some content to your topic."; document.getElementById("newBody").focus(); return; }

        const data = getData();
        const colorIdx = data.topics.length % COLORS.length;
        data.topics.push({
          id: "topic-" + Date.now(),
          title,
          body,
          author,
          files: pendingTopic,
          createdAt: new Date().toISOString(),
          pinned: false,
          color: COLORS[colorIdx],
          replies: [],
        });
        if (!saveData(data)) {
          if (err) err.textContent = "Not enough browser storage — try smaller attachments.";
          return;
        }
        closeModal();
        render();
      });
    }
  }

  function closeModal() {
    const overlay = document.getElementById("modalOverlay");
    if (overlay) overlay.classList.add("is-hidden");
    ["newTitle", "newBody", "newAuthor"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    const err = document.getElementById("modalErr");
    if (err) err.textContent = "";
    pendingTopic = [];
    const picker = document.querySelector("#modalOverlay .attach");
    if (picker) {
      picker.querySelector(".attach__chips").innerHTML = "";
      picker.querySelector(".attach__err").textContent = "";
      picker.querySelector(".attach__input").value = "";
    }
  }

  /* ============================================================
     Utilities
     ============================================================ */
  function escHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function relTime(iso) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    return Math.floor(diff / 86400) + "d ago";
  }

  /* ============================================================
     Boot
     ============================================================ */
  document.addEventListener("DOMContentLoaded", () => {
    bindModal();
    render();
  });
})();
