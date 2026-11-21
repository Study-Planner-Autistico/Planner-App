(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const uid = () =>
    crypto.randomUUID ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
        });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const COLORS = ["#e16259", "#d9730d", "#cb912f", "#448361", "#337ea9", "#9065b0", "#c14c8a", "#4d6461"];
  const colorFor = (name) => {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return COLORS[h % COLORS.length];
  };
  const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

  // ---------- Identità ----------
  const storedName = (() => { try { return localStorage.getItem("planner.name") || ""; } catch { return ""; } })();
  const me = { id: uid(), name: storedName || "Ospite", color: colorFor(storedName || "Ospite") };

  const store = window.createStore(me);
  const tasks = new Map();
  let openId = null;
  let people = [me];

  // ---------- Bacheca ----------
  const columns = Object.fromEntries($$(".column").map((c) => [c.dataset.status, c]));

  function sorted(status) {
    return [...tasks.values()].filter((t) => t.status === status).sort((a, b) => a.position - b.position);
  }

  function cardHTML(t) {
    const today = new Date().toISOString().slice(0, 10);
    const meta = [];
    if (t.assignee) meta.push(`<span class="chip">${esc(t.assignee)}</span>`);
    if (t.due) {
      const late = t.due < today && t.status !== "done";
      const d = new Date(t.due + "T00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" });
      meta.push(`<span class="chip${late ? " late" : ""}">${late ? "Scaduta · " : ""}${esc(d)}</span>`);
    }
    return `
      <div class="card-title${t.title ? "" : " empty"}">${t.title ? esc(t.title) : "Senza titolo"}</div>
      ${meta.length ? `<div class="card-meta">${meta.join("")}</div>` : ""}`;
  }

  function render() {
    for (const [status, col] of Object.entries(columns)) {
      const list = sorted(status);
      $(".count", col).textContent = list.length || "";
      const box = $(".cards", col);
      box.innerHTML = "";
      for (const t of list) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "card" + (t.id === openId ? " active" : "");
        el.dataset.id = t.id;
        el.draggable = true;
        el.innerHTML = cardHTML(t);
        box.appendChild(el);
      }
    }
    renderNames();
  }

  function renderCard(id) {
    const t = tasks.get(id);
    const el = $(`.card[data-id="${id}"]`);
    if (!t || !el || el.closest(".column").dataset.status !== t.status) return render();
    el.innerHTML = cardHTML(t);
  }

  function renderNames() {
    const names = new Set([...people.map((p) => p.name), ...[...tasks.values()].map((t) => t.assignee)].filter(Boolean));
    $("#team-names").innerHTML = [...names].map((n) => `<option value="${esc(n)}"></option>`).join("");
  }

  // ---------- Salvataggio ----------
  const timers = new Map();
  const savedEl = $("#saved");

  function scheduleSave(id, delay = 500) {
    clearTimeout(timers.get(id));
    savedEl.textContent = "Salvataggio…";
    timers.set(id, setTimeout(() => saveNow(id), delay));
  }
  async function saveNow(id) {
    timers.delete(id);
    const t = tasks.get(id);
    if (!t) return;
    try {
      await store.save(t);
      if (!timers.size) savedEl.textContent = "Salvato";
    } catch {
      savedEl.textContent = "Errore di salvataggio — riprova";
    }
  }

  // ---------- Creazione ----------
  async function createTask(status) {
    const last = sorted(status).at(-1);
    const t = {
      id: uid(), title: "", notes: "", status, assignee: "", due: null,
      position: last ? last.position + 1 : 1,
    };
    tasks.set(t.id, t);
    render();
    openPanel(t.id);
    $("#f-title").focus();
    await saveNow(t.id);
  }

  $$(".add").forEach((btn) => btn.addEventListener("click", () => createTask(btn.closest(".column").dataset.status)));

  // ---------- Pannello ----------
  const panel = $("#panel");
  const fields = {
    title: $("#f-title"), notes: $("#f-notes"), status: $("#f-status"),
    assignee: $("#f-assignee"), due: $("#f-due"),
  };

  function fillPanel(t, skipFocused = true) {
    for (const [key, el] of Object.entries(fields)) {
      if (skipFocused && document.activeElement === el) continue;
      el.value = t[key] ?? "";
    }
  }
  function openPanel(id) {
    const t = tasks.get(id);
    if (!t) return;
    openId = id;
    fillPanel(t, false);
    savedEl.textContent = "";
    $("#typing-title").innerHTML = $("#typing-notes").innerHTML = "";
    panel.hidden = false;
    $$(".card").forEach((c) => c.classList.toggle("active", c.dataset.id === id));
  }
  function closePanel() {
    if (openId && timers.has(openId)) saveNow(openId);
    openId = null;
    panel.hidden = true;
    $$(".card.active").forEach((c) => c.classList.remove("active"));
  }

  $("#board").addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (card) openPanel(card.dataset.id);
  });
  $("#close").addEventListener("click", closePanel);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden && !$("#name-dialog").open) closePanel();
  });
  $("#delete").addEventListener("click", async () => {
    const t = tasks.get(openId);
    if (!t || !confirm(`Eliminare "${t.title || "Senza titolo"}"?`)) return;
    const id = openId;
    clearTimeout(timers.get(id));
    timers.delete(id);
    tasks.delete(id);
    closePanel();
    render();
    await store.remove(id);
  });

  for (const [key, el] of Object.entries(fields)) {
    const evt = key === "status" || key === "due" ? "change" : "input";
    el.addEventListener(evt, () => {
      const t = tasks.get(openId);
      if (!t) return;
      t[key] = key === "due" ? el.value || null : el.value;
      if (key === "status") {
        const last = sorted(el.value).filter((x) => x.id !== t.id).at(-1);
        t.position = last ? last.position + 1 : 1;
        render();
      } else {
        renderCard(t.id);
      }
      // Trasmette subito ciò che si sta scrivendo, il salvataggio arriva poco dopo.
      store.sendTyping({ id: t.id, field: key, value: t[key], position: t.position, user: me });
      scheduleSave(t.id, evt === "change" ? 0 : 500);
    });
  }

  // ---------- Trascina e rilascia ----------
  let dragId = null;
  $("#board").addEventListener("dragstart", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    dragId = card.dataset.id;
    card.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragId);
  });
  $("#board").addEventListener("dragend", () => {
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
      t.status = col.dataset.status;
      t.position = (before + after) / 2;
      render();
      if (openId === t.id) fields.status.value = t.status;
      store.sendTyping({ id: t.id, field: "status", value: t.status, position: t.position, user: me });
      saveNow(t.id);
    });
  }

  // ---------- Modifiche degli altri, in tempo reale ----------
  const typingTimers = {};
  function showTyping(id, field, user) {
    const label = `<span style="color:${esc(user.color)}">✎ ${esc(user.name)} sta scrivendo…</span>`;
    const card = $(`.card[data-id="${id}"]`);
    if (card) {
      let tag = $(".card-typing", card);
      if (!tag) { tag = document.createElement("span"); tag.className = "card-typing"; card.appendChild(tag); }
      tag.textContent = `${user.name} ✎`;
      tag.style.background = user.color;
    }
    const slot = openId === id && (field === "title" || field === "notes") ? $(`#typing-${field}`) : null;
    if (slot) slot.innerHTML = label;
    clearTimeout(typingTimers[id]);
    typingTimers[id] = setTimeout(() => {
      $(`.card[data-id="${id}"] .card-typing`)?.remove();
      $("#typing-title").innerHTML = $("#typing-notes").innerHTML = "";
    }, 1500);
  }

  store.onTyping(({ id, field, value, position, user }) => {
    const t = tasks.get(id);
    if (!t) return;
    const statusChanged = field === "status" && t.status !== value;
    t[field] = value;
    if (position != null) t.position = position;
    statusChanged ? render() : renderCard(id);
    if (openId === id && document.activeElement !== fields[field]) fields[field].value = value ?? "";
    if (field === "title" || field === "notes") showTyping(id, field, user);
  });

  store.onTask(({ type, task }) => {
    if (type === "delete") {
      tasks.delete(task.id);
      if (openId === task.id) closePanel();
      return render();
    }
    if (timers.has(task.id)) return; // abbiamo modifiche locali non ancora salvate
    tasks.set(task.id, { ...tasks.get(task.id), ...task });
    render();
    if (openId === task.id) fillPanel(tasks.get(task.id));
  });

  store.onPeople((list) => {
    people = list.filter(Boolean);
    $("#people").innerHTML = people
      .map((p) => `<span class="avatar" style="background:${esc(p.color)}" title="${esc(p.name)}${p.id === me.id ? " (tu)" : ""}">${esc(initials(p.name))}</span>`)
      .join("");
    renderNames();
  });

  // ---------- Nome ----------
  const dialog = $("#name-dialog");
  function askName() {
    $("#name-input").value = storedName ? me.name : "";
    dialog.showModal();
  }
  dialog.addEventListener("close", () => {
    const name = $("#name-input").value.trim();
    if (!name || name === storedName) return;
    me.name = name;
    me.color = colorFor(name);
    try { localStorage.setItem("planner.name", name); } catch {}
    location.reload(); // riannuncia la presenza con il nuovo nome
  });
  $("#me").textContent = me.name;
  $("#me").addEventListener("click", askName);

  // ---------- Avvio ----------
  const modeEl = $("#mode");
  if (store.mode === "live") {
    modeEl.textContent = "Live";
    modeEl.classList.add("live");
    modeEl.title = "Sincronizzato in tempo reale con il team";
  } else {
    modeEl.textContent = "Locale";
    modeEl.title = "Dati solo su questo computer. Configura Supabase in config.js per lavorare in team.";
  }

  store.list()
    .then((list) => { list.forEach((t) => tasks.set(t.id, t)); render(); })
    .catch(() => { modeEl.textContent = "Errore di connessione"; });

  if (!storedName) askName();
})();
