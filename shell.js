// Struttura dell'app: navigazione tra Attività e Pagine, intestazione, persone online, nome.
(function () {
  const { $, $$, esc, avatar, me, store, storedName } = P;

  const views = { tasks: $("#view-tasks"), page: $("#view-page"), missing: $("#view-missing") };
  const sidebar = $("#sidebar");
  const scrim = $("#scrim");

  P.setHeader = (title, sub) => {
    $("#view-title").textContent = title;
    $("#view-sub").textContent = sub;
    document.title = `${title} · Planner App`;
  };

  // ---------- Navigazione (#/attivita, #/pagina/<id>) ----------
  let loaded = false;
  function showView(name) {
    for (const [k, el] of Object.entries(views)) el.hidden = k !== name;
    $("#task-tabs").hidden = name !== "tasks";
    $$('.nav-item[data-route="tasks"]').forEach((a) => a.classList.toggle("active", name === "tasks"));
  }

  P.route = function route() {
    const m = location.hash.match(/^#\/pagina\/([\w-]+)/);
    closeMenu();
    if (m) {
      P.board.close();
      if (P.pages.show(m[1])) showView("page");
      else if (!loaded) { showView(null); P.setHeader("Caricamento…", ""); }
      else { showView("missing"); P.setHeader("Pagina non trovata", ""); }
      return;
    }
    P.pages.leave();
    showView("tasks");
    P.setHeader("Attività", "Bacheca del team");
  };
  window.addEventListener("hashchange", P.route);

  // ---------- Menu su telefono ----------
  function openMenu() { sidebar.classList.add("open"); scrim.hidden = false; }
  function closeMenu() { sidebar.classList.remove("open"); scrim.hidden = true; }
  $("#menu").addEventListener("click", openMenu);
  scrim.addEventListener("click", closeMenu);

  // ---------- Persone online ----------
  store.onPeople((list) => {
    P.people = list.filter(Boolean);
    const others = P.people.filter((p) => p.id !== me.id);
    const shown = others.slice(0, 4).map((p) => avatar(p.name)).join("");
    const extra = others.length > 4 ? `<span class="avatar more">+${others.length - 4}</span>` : "";
    $("#people").innerHTML = shown + extra;
    $("#people").title = others.length ? `Online: ${others.map((p) => p.name).join(", ")}` : "";
    P.board.renderNames();
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
    P.local.set("planner.name", name);
    location.reload(); // riannuncia la presenza con il nuovo nome
  });
  $("#me").innerHTML = `${avatar(me.name)}<span class="me-text"><b>${esc(me.name)}</b><small>Cambia nome</small></span>`;
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

  P.route();
  Promise.allSettled([P.board.load(), P.pages.load()]).then(([tasks, pages]) => {
    loaded = true;
    if (tasks.status === "rejected" || pages.status === "rejected") {
      modeEl.textContent = "Errore di connessione";
      modeEl.classList.remove("live");
      if (pages.status === "rejected") $("#page-list").innerHTML = `<p class="nav-empty">Pagine non disponibili: esegui supabase.sql</p>`;
    }
    P.route();
  });

  if (!storedName) askName();
})();
