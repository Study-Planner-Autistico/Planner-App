// Sezione Pagine: documenti liberi in cui scrivere e allegare file.
(function () {
  const { $, $$, uid, esc, me, store, change, saveNow, isPending, cancelSave, flash, typingLabel } = P;
  const T = "pages";
  const MAX_FILE = 25 * 1024 * 1024;
  const ICONS = ["📄", "📝", "📚", "📌", "💡", "📅", "🎯", "✅", "📊", "🧪", "🎓", "🗂️", "⭐", "🔥", "💬", "🧠"];

  const normalize = (p) => ({
    title: "", icon: "📄", content: "", position: 0,
    ...p,
    files: Array.isArray(p.files) ? p.files : [],
  });

  const pages = new Map();
  let currentId = null;

  const els = {
    list: $("#page-list"),
    icon: $("#page-icon"),
    picker: $("#icon-picker"),
    title: $("#page-title"),
    content: $("#page-content"),
    files: $("#file-list"),
    fileCount: $("#file-count"),
    input: $("#file-input"),
    drop: $("#dropzone"),
    status: $("#upload-status"),
  };
  P.statusEls.add($("#page-saved"));
  $("#upload-limit").textContent = store.mode === "live" ? "Massimo 25 MB per file" : "Modalità locale: massimo 1 MB per file";

  const sortedPages = () => [...pages.values()].sort((a, b) => a.position - b.position);
  const label = (p) => p.title.trim() || "Senza titolo";

  // ---------- Barra laterale ----------
  function renderList() {
    const list = sortedPages();
    els.list.innerHTML = list.length
      ? list.map((p) => `
          <a class="nav-item${p.id === currentId ? " active" : ""}" href="#/pagina/${p.id}" data-page="${p.id}">
            <span class="nav-icon" aria-hidden="true">${esc(p.icon)}</span>
            <span class="nav-label">${esc(label(p))}</span>
          </a>`).join("")
      : `<p class="nav-empty">Ancora nessuna pagina</p>`;
  }
  function renderListItem(p) {
    const a = $(`[data-page="${p.id}"]`, els.list);
    if (!a) return renderList();
    $(".nav-icon", a).textContent = p.icon;
    $(".nav-label", a).textContent = label(p);
  }

  // ---------- Editor ----------
  const autosize = () => {
    els.content.style.height = "auto";
    els.content.style.height = Math.max(els.content.scrollHeight, 240) + "px";
  };
  const fmtSize = (n) =>
    n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
  const fileKind = (f) => {
    const ext = (f.name.split(".").pop() || "").toUpperCase().slice(0, 4);
    return f.type.startsWith("image/") ? "IMG" : ext || "FILE";
  };

  // Accetta solo link a file veri (https o dati locali), mai "javascript:".
  const safeUrl = (u) => (/^(https:\/\/|data:)/i.test(u || "") ? u : "#");

  function renderFiles(p) {
    els.fileCount.textContent = p.files.length || "";
    els.files.innerHTML = p.files.map((f) => ({ ...f, url: safeUrl(f.url), type: f.type || "", size: +f.size || 0 })).map((f, i) => `
      <li class="file">
        ${f.type && f.type.startsWith("image/")
          ? `<img class="file-thumb" src="${esc(f.url)}" alt="" loading="lazy" />`
          : `<span class="file-thumb file-ext">${esc(fileKind(f))}</span>`}
        <div class="file-info">
          <a href="${esc(f.url)}" target="_blank" rel="noopener" download="${esc(f.name)}">${esc(f.name)}</a>
          <span class="muted">${fmtSize(f.size)}${f.by ? ` · ${esc(f.by)}` : ""}</span>
        </div>
        <button type="button" class="remove-check" data-file="${i}" aria-label="Rimuovi ${esc(f.name)}">✕</button>
      </li>`).join("");
  }

  function fill(p, skipFocused = true) {
    els.icon.textContent = p.icon;
    if (!(skipFocused && document.activeElement === els.title)) els.title.value = p.title;
    if (!(skipFocused && document.activeElement === els.content)) els.content.value = p.content;
    autosize();
    renderFiles(p);
  }

  function header(p) {
    P.setHeader(`${p.icon} ${label(p)}`, "Pagina condivisa con il team");
  }

  function show(id) {
    const p = pages.get(id);
    if (currentId && currentId !== id && isPending(T, currentId)) saveNow(T, pages.get(currentId));
    currentId = p ? id : null;
    renderList();
    if (!p) return false;
    fill(p, false);
    els.picker.hidden = true;
    els.status.textContent = "";
    $("#page-saved").textContent = "";
    $("#typing-page-title").innerHTML = $("#typing-page-content").innerHTML = "";
    header(p);
    return true;
  }

  async function createPage() {
    const last = sortedPages().at(-1);
    const p = normalize({ id: uid(), position: last ? last.position + 1 : 1 });
    pages.set(p.id, p);
    location.hash = `#/pagina/${p.id}`;
    await saveNow(T, p);
    setTimeout(() => els.title.focus(), 0);
  }
  $("#new-page").addEventListener("click", createPage);
  $("#new-page-2").addEventListener("click", createPage);

  els.title.addEventListener("input", () => {
    const p = pages.get(currentId);
    if (!p) return;
    change(T, p, "title", els.title.value);
    renderListItem(p);
    header(p);
  });
  els.title.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); els.content.focus(); }
  });
  els.content.addEventListener("input", () => {
    const p = pages.get(currentId);
    if (!p) return;
    change(T, p, "content", els.content.value);
    autosize();
  });

  // Icona della pagina
  els.picker.innerHTML = ICONS.map((i) => `<button type="button" data-icon="${i}" aria-label="Icona ${i}">${i}</button>`).join("");
  els.icon.addEventListener("click", () => { els.picker.hidden = !els.picker.hidden; });
  els.picker.addEventListener("click", (e) => {
    const b = e.target.closest("[data-icon]");
    const p = pages.get(currentId);
    if (!b || !p) return;
    change(T, p, "icon", b.dataset.icon, 0);
    els.icon.textContent = p.icon;
    els.picker.hidden = true;
    renderListItem(p);
    header(p);
  });
  document.addEventListener("click", (e) => {
    if (!els.picker.hidden && !e.target.closest(".doc-icon-row")) els.picker.hidden = true;
  });

  // ---------- Allegati ----------
  async function uploadFiles(fileList) {
    const p = pages.get(currentId);
    if (!p) return;
    for (const file of fileList) {
      if (file.size > MAX_FILE) { els.status.textContent = `"${file.name}" supera i 25 MB e non è stato caricato.`; continue; }
      els.status.textContent = `Caricamento di "${file.name}"…`;
      try {
        const meta = await store.upload(p.id, file);
        const target = pages.get(p.id);
        if (!target) return;
        change(T, target, "files", [...target.files, { id: uid(), ...meta, by: me.name }], 0);
        if (currentId === p.id) renderFiles(target);
        els.status.textContent = `"${file.name}" caricato.`;
      } catch (err) {
        els.status.textContent = `Non sono riuscito a caricare "${file.name}": ${err.message || "errore"}`;
      }
    }
  }
  els.input.addEventListener("change", () => {
    uploadFiles([...els.input.files]);
    els.input.value = "";
  });
  const wrap = $("#view-page");
  wrap.addEventListener("dragover", (e) => {
    if (![...e.dataTransfer.types].includes("Files")) return;
    e.preventDefault();
    els.drop.classList.add("over");
  });
  wrap.addEventListener("dragleave", (e) => {
    if (!wrap.contains(e.relatedTarget)) els.drop.classList.remove("over");
  });
  wrap.addEventListener("drop", (e) => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    els.drop.classList.remove("over");
    uploadFiles([...e.dataTransfer.files]);
  });
  els.files.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-file]");
    const p = pages.get(currentId);
    if (!b || !p) return;
    const f = p.files[+b.dataset.file];
    if (!f || !confirm(`Rimuovere "${f.name}"?`)) return;
    change(T, p, "files", p.files.filter((x) => x !== f), 0);
    renderFiles(p);
    try { await store.removeFile(f.path); } catch {}
  });

  // ---------- Eliminazione ----------
  $("#delete-page").addEventListener("click", async () => {
    const p = pages.get(currentId);
    if (!p || !confirm(`Eliminare la pagina "${label(p)}"${p.files.length ? " e i suoi allegati" : ""}?`)) return;
    cancelSave(T, p.id);
    pages.delete(p.id);
    currentId = null;
    location.hash = "#/attivita";
    renderList();
    await store.remove(T, p.id);
    for (const f of p.files) { try { await store.removeFile(f.path); } catch {} }
  });

  // ---------- Modifiche degli altri, in tempo reale ----------
  store.onTyping(({ table, id, field, value, user }) => {
    if (table !== T) return;
    const p = pages.get(id);
    if (!p || !["title", "content", "icon", "files"].includes(field)) return;
    p[field] = value;
    renderListItem(p);
    if (currentId === id) {
      fill(p);
      header(p);
    }
    if (field === "title" || field === "content") {
      flash(`page:${id}`, () => {
        $(`[data-page="${id}"]`, els.list)?.style.setProperty("--typing", user.color);
        $(`[data-page="${id}"]`, els.list)?.classList.add("is-typing");
        if (currentId === id) $(`#typing-page-${field}`).innerHTML = typingLabel(user);
      }, () => {
        $(`[data-page="${id}"]`, els.list)?.classList.remove("is-typing");
        $("#typing-page-title").innerHTML = $("#typing-page-content").innerHTML = "";
      });
    }
  });

  store.onRow(({ table, type, row }) => {
    if (table !== T) return;
    if (type === "delete") {
      pages.delete(row.id);
      if (currentId === row.id) P.route();
      return renderList();
    }
    if (isPending(T, row.id)) return;
    pages.set(row.id, normalize({ ...pages.get(row.id), ...row }));
    renderList();
    if (currentId === row.id) { fill(pages.get(row.id)); header(pages.get(row.id)); }
  });

  P.pages = {
    async load() {
      const list = await store.list(T);
      list.forEach((p) => pages.set(p.id, normalize(p)));
      renderList();
    },
    show,
    leave() {
      if (currentId && isPending(T, currentId)) saveNow(T, pages.get(currentId));
      currentId = null;
      renderList();
    },
  };
  renderList();
})();
