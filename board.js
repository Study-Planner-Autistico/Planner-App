// Sezione Attività: bacheca con tre colonne, pannello dettagli e checklist.
(function () {
  const { $, $$, uid, esc, hash, avatar, me, store, change, saveNow, isPending, cancelSave, flash, typingLabel } = P;
  const T = "tasks";

  const tagClass = (tag) => `tag-${hash(tag.trim().toLowerCase()) % 7}`;
  const normalize = (t) => ({
    title: "", notes: "", status: "todo", assignee: "", due: null, position: 0, tag: "",
    ...t,
    checklist: Array.isArray(t.checklist) ? t.checklist : [],
  });

  const tasks = new Map();
  let openId = null;
  let filter = P.local.get("planner.filter", "all");

  const columns = Object.fromEntries($$(".column").map((c) => [c.dataset.status, c]));
  const isMine = (t) => t.assignee.trim().toLowerCase() === me.name.trim().toLowerCase();

  function sorted(status, all = false) {
    return [...tasks.values()]
      .filter((t) => t.status === status && (all || filter === "all" || isMine(t)))
      .sort((a, b) => a.position - b.position);
  }

  // ---------- Disegno ----------
  function progressHTML(list) {
    if (!list.length) return "";
    const done = list.filter((c) => c.done).length;
    return `
      <div class="progress">
        <div class="progress-head"><span>Avanzamento</span><b>${done}/${list.length}</b></div>
        <div class="bar"><span style="width:${(done / list.length) * 100}%"></span></div>
      </div>`;
  }

  function cardHTML(t) {
    const today = new Date().toISOString().slice(0, 10);
    const checks = t.checklist.slice(0, 4).map((c, i) => `
      <li><button type="button" class="check${c.done ? " done" : ""}" data-check="${i}" aria-pressed="${c.done}"
        aria-label="${c.done ? "Segna da fare" : "Segna fatto"}: ${esc(c.text)}"></button>
        <span class="check-text">${esc(c.text) || "&nbsp;"}</span></li>`).join("");
    const more = t.checklist.length > 4 ? `<li class="more">+ altri ${t.checklist.length - 4}</li>` : "";

    let due = "";
    if (t.due) {
      const late = t.due < today && t.status !== "done";
      const d = new Date(t.due + "T00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" });
      due = `<span class="due${late ? " late" : ""}" title="Scadenza">${late ? "Scaduta · " : ""}${esc(d)}</span>`;
    }
    const foot = [
      t.tag ? `<span class="tag ${tagClass(t.tag)}">${esc(t.tag)}</span>` : "",
      (due || t.assignee) ? `<span class="spacer"></span>${due}${t.assignee ? avatar(t.assignee, "sm") : ""}` : "",
    ].join("");

    return `
      <h3 class="card-title${t.title ? "" : " empty"}">${t.title ? esc(t.title) : "Senza titolo"}</h3>
      ${t.notes ? `<p class="card-desc">${esc(t.notes)}</p>` : ""}
      ${checks ? `<ul class="card-checks">${checks}${more}</ul>` : ""}
      ${progressHTML(t.checklist)}
      ${foot ? `<div class="card-foot">${foot}</div>` : ""}`;
  }

  function render() {
    for (const [status, col] of Object.entries(columns)) {
      const list = sorted(status);
      $(".count", col).textContent = list.length || "";
      const box = $(".cards", col);
      box.innerHTML = "";
      for (const t of list) {
        const el = document.createElement("article");
        el.className = "card" + (t.id === openId ? " active" : "");
        el.dataset.id = t.id;
        el.tabIndex = 0;
        el.draggable = true;
        el.setAttribute("aria-label", t.title || "Senza titolo");
        el.innerHTML = cardHTML(t);
        box.appendChild(el);
      }
      if (!list.length) {
        box.innerHTML = `<button type="button" class="empty-col">${filter === "mine" ? "Nessuna attività assegnata a te" : "+ Aggiungi un'attività"}</button>`;
      }
    }
    const open = [...tasks.values()].filter((t) => t.status !== "done");
    $("#count-all").textContent = open.length || "";
    $("#count-mine").textContent = open.filter(isMine).length || "";
    $("#nav-count").textContent = open.length || "";
    renderNames();
  }

  function renderCard(id) {
    const t = tasks.get(id);
    const el = $(`.card[data-id="${id}"]`);
    if (!t || !el || el.closest(".column").dataset.status !== t.status) return render();
    const tag = $(".card-typing", el);
    el.innerHTML = cardHTML(t);
    if (tag) el.appendChild(tag);
  }

  function renderNames() {
    const all = [...tasks.values()];
    const names = new Set([...P.people.map((p) => p.name), ...all.map((t) => t.assignee)].filter(Boolean));
    $("#team-names").innerHTML = [...names].map((n) => `<option value="${esc(n)}"></option>`).join("");
    const tags = new Set(all.map((t) => t.tag).filter(Boolean));
    $("#tag-names").innerHTML = [...tags].map((n) => `<option value="${esc(n)}"></option>`).join("");
  }

  // ---------- Filtro ----------
  function setFilter(f) {
    filter = f;
    P.local.set("planner.filter", f);
    $$(".tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.filter === f);
      b.setAttribute("aria-pressed", b.dataset.filter === f);
    });
    render();
  }
  $$(".tab").forEach((b) => b.addEventListener("click", () => setFilter(b.dataset.filter)));

  // ---------- Creazione ----------
  async function createTask(status) {
    const last = sorted(status, true).at(-1);
    const t = normalize({
      id: uid(), status, position: last ? last.position + 1 : 1,
      assignee: filter === "mine" ? me.name : "",
    });
    tasks.set(t.id, t);
    render();
    openPanel(t.id);
    $("#f-title").focus();
    await saveNow(T, t);
  }
  for (const col of Object.values(columns)) {
    $(".add", col).addEventListener("click", () => createTask(col.dataset.status));
    $(".cards", col).addEventListener("click", (e) => {
      if (e.target.closest(".empty-col")) createTask(col.dataset.status);
    });
  }

  // ---------- Pannello ----------
  const panel = $("#panel");
  P.statusEls.add($("#saved"));
  const fields = {
    title: $("#f-title"), notes: $("#f-notes"), status: $("#f-status"),
    tag: $("#f-tag"), assignee: $("#f-assignee"), due: $("#f-due"),
  };
  const checklistEl = $("#checklist");

  function renderChecklist(t, force = false) {
    const p = $("#panel-progress");
    const done = t.checklist.filter((c) => c.done).length;
    $("#check-count").textContent = t.checklist.length ? `${done}/${t.checklist.length}` : "";
    p.hidden = !t.checklist.length;
    $("span", p).style.width = t.checklist.length ? `${(done / t.checklist.length) * 100}%` : "0";
    if (!force && checklistEl.contains(document.activeElement)) return; // non disturbare chi sta scrivendo
    checklistEl.innerHTML = t.checklist.map((c, i) => `
      <li class="${c.done ? "is-done" : ""}" data-i="${i}">
        <button type="button" class="check${c.done ? " done" : ""}" aria-pressed="${c.done}" aria-label="Fatto"></button>
        <input value="${esc(c.text)}" placeholder="Elemento" aria-label="Elemento ${i + 1}" />
        <button type="button" class="remove-check" aria-label="Rimuovi elemento">✕</button>
      </li>`).join("");
  }

  function fillPanel(t, skipFocused = true) {
    for (const [key, el] of Object.entries(fields)) {
      if (skipFocused && document.activeElement === el) continue;
      el.value = t[key] ?? "";
    }
    renderChecklist(t, !skipFocused);
  }
  function openPanel(id) {
    const t = tasks.get(id);
    if (!t) return;
    if (openId && openId !== id && isPending(T, openId)) saveNow(T, tasks.get(openId));
    openId = id;
    fillPanel(t, false);
    $("#saved").textContent = "";
    $("#typing-title").innerHTML = $("#typing-notes").innerHTML = "";
    panel.hidden = false;
    $$(".card").forEach((c) => c.classList.toggle("active", c.dataset.id === id));
  }
  function closePanel() {
    if (openId && isPending(T, openId)) saveNow(T, tasks.get(openId));
    openId = null;
    panel.hidden = true;
    $$(".card.active").forEach((c) => c.classList.remove("active"));
  }

  const board = $("#view-tasks");
  board.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    const t = tasks.get(card.dataset.id);
    const check = e.target.closest("[data-check]");
    if (check && t) {
      const i = +check.dataset.check;
      change(T, t, "checklist", t.checklist.map((c, j) => (j === i ? { ...c, done: !c.done } : c)), 0);
      renderCard(t.id);
      if (openId === t.id) renderChecklist(t, true);
      return;
    }
    openPanel(card.dataset.id);
  });
  board.addEventListener("keydown", (e) => {
    const card = e.target.closest(".card");
    if (card && e.target === card && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      openPanel(card.dataset.id);
    }
  });
  $("#close").addEventListener("click", closePanel);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden && !$("#name-dialog").open) closePanel();
  });
  $("#delete").addEventListener("click", async () => {
    const t = tasks.get(openId);
    if (!t || !confirm(`Eliminare "${t.title || "Senza titolo"}"?`)) return;
    const id = openId;
    cancelSave(T, id);
    tasks.delete(id);
    closePanel();
    render();
    await store.remove(T, id);
  });

  for (const [key, el] of Object.entries(fields)) {
    const evt = key === "status" || key === "due" ? "change" : "input";
    el.addEventListener(evt, () => {
      const t = tasks.get(openId);
      if (!t) return;
      if (key === "status") {
        const last = sorted(el.value, true).filter((x) => x.id !== t.id).at(-1);
        t.position = last ? last.position + 1 : 1;
      }
      change(T, t, key, key === "due" ? el.value || null : el.value, evt === "change" ? 0 : 500, { position: t.position });
      key === "status" || key === "assignee" ? render() : renderCard(t.id);
    });
  }

  // Checklist nel pannello
  function updateChecklist(t, list, delay, focusIndex) {
    change(T, t, "checklist", list, delay);
    renderChecklist(t, focusIndex != null);
    renderCard(t.id);
    if (focusIndex != null) $$("input", checklistEl)[focusIndex]?.focus();
  }
  $("#add-check").addEventListener("click", () => {
    const t = tasks.get(openId);
    if (t) updateChecklist(t, [...t.checklist, { id: uid(), text: "", done: false }], 0, t.checklist.length);
  });
  checklistEl.addEventListener("click", (e) => {
    const t = tasks.get(openId);
    const li = e.target.closest("li");
    if (!t || !li) return;
    const i = +li.dataset.i;
    if (e.target.closest(".check")) {
      updateChecklist(t, t.checklist.map((c, j) => (j === i ? { ...c, done: !c.done } : c)), 0);
      renderChecklist(t, true);
    } else if (e.target.closest(".remove-check")) {
      updateChecklist(t, t.checklist.filter((_, j) => j !== i), 0);
      renderChecklist(t, true);
    }
  });
  checklistEl.addEventListener("input", (e) => {
    const t = tasks.get(openId);
    const li = e.target.closest("li");
    if (!t || !li) return;
    const i = +li.dataset.i;
    change(T, t, "checklist", t.checklist.map((c, j) => (j === i ? { ...c, text: e.target.value } : c)));
    renderCard(t.id);
  });
  checklistEl.addEventListener("keydown", (e) => {
    const t = tasks.get(openId);
    const li = e.target.closest("li");
    if (!t || !li || e.target.tagName !== "INPUT") return;
    const i = +li.dataset.i;
    if (e.key === "Enter") {
      e.preventDefault();
      const list = [...t.checklist];
      list.splice(i + 1, 0, { id: uid(), text: "", done: false });
      updateChecklist(t, list, 0, i + 1);
    } else if (e.key === "Backspace" && e.target.value === "") {
      e.preventDefault();
      updateChecklist(t, t.checklist.filter((_, j) => j !== i), 0, Math.max(0, i - 1));
    }
  });

  // ---------- Trascina e rilascia ----------
  let dragId = null;
  board.addEventListener("dragstart", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    dragId = card.dataset.id;
    card.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragId);
  });
  board.addEventListener("dragend", () => {
    dragId = null;
    $$(".dragging, .drop").forEach((el) => el.classList.remove("dragging", "drop"));
  });
  for (const col of Object.values(columns)) {
    col.addEventListener("dragover", (e) => {
      if (!dragId) return;
      e.preventDefault();
      $$(".column.drop").forEach((c) => c !== col && c.classList.remove("drop"));
      col.classList.add("drop");
    });
    col.addEventListener("dragleave", (e) => {
      if (!col.contains(e.relatedTarget)) col.classList.remove("drop");
    });
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.classList.remove("drop");
      const t = tasks.get(dragId);
      if (!t) return;
      const others = sorted(col.dataset.status).filter((x) => x.id !== t.id);
      const els = $$(".card", col).filter((c) => c.dataset.id !== t.id);
      let index = els.findIndex((c) => e.clientY < c.getBoundingClientRect().top + c.offsetHeight / 2);
      if (index < 0) index = others.length;
      const before = others[index - 1]?.position ?? (others[0] ? others[0].position - 1 : 0);
      const after = others[index]?.position ?? before + 2;
      t.position = (before + after) / 2;
      change(T, t, "status", col.dataset.status, 0, { position: t.position });
      render();
      if (openId === t.id) fields.status.value = t.status;
    });
  }

  // ---------- Modifiche degli altri, in tempo reale ----------
  function showTyping(id, field, user) {
    flash(`task:${id}`, () => {
      const card = $(`.card[data-id="${id}"]`);
      if (card) {
        let tag = $(".card-typing", card);
        if (!tag) { tag = document.createElement("span"); tag.className = "card-typing"; card.appendChild(tag); }
        tag.textContent = `${user.name} ✎`;
        tag.style.background = user.color;
      }
      if (openId === id && (field === "title" || field === "notes")) $(`#typing-${field}`).innerHTML = typingLabel(user);
    }, () => {
      $(`.card[data-id="${id}"] .card-typing`)?.remove();
      $("#typing-title").innerHTML = $("#typing-notes").innerHTML = "";
    });
  }

  store.onTyping(({ table, id, field, value, position, user }) => {
    if (table && table !== T) return;
    const t = tasks.get(id);
    if (!t || !(field in fields || field === "checklist")) return;
    const moved = (field === "status" && t.status !== value) || field === "assignee";
    t[field] = value;
    if (position != null) t.position = position;
    moved ? render() : renderCard(id);
    if (openId === id) {
      if (field === "checklist") renderChecklist(t);
      else if (document.activeElement !== fields[field]) fields[field].value = value ?? "";
    }
    if (["title", "notes", "checklist"].includes(field)) showTyping(id, field, user);
  });

  store.onRow(({ table, type, row }) => {
    if (table !== T) return;
    if (type === "delete") {
      tasks.delete(row.id);
      if (openId === row.id) closePanel();
      return render();
    }
    if (isPending(T, row.id)) return; // abbiamo modifiche locali non ancora salvate
    tasks.set(row.id, normalize({ ...tasks.get(row.id), ...row }));
    render();
    if (openId === row.id) fillPanel(tasks.get(row.id));
  });

  P.board = {
    async load() {
      const list = await store.list(T);
      list.forEach((t) => tasks.set(t.id, normalize(t)));
      setFilter(filter);
    },
    render,
    renderNames,
    close: closePanel,
  };
  setFilter(filter);
})();
