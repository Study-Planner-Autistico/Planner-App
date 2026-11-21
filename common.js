// Strumenti condivisi da bacheca, pagine e struttura dell'app.
window.P = (function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const uid = () =>
    crypto.randomUUID ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
        });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hash = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

  const COLORS = ["#e16259", "#d9730d", "#b8860b", "#448361", "#337ea9", "#9065b0", "#c14c8a", "#4d6461"];
  const colorFor = (name) => COLORS[hash(name) % COLORS.length];
  const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  const avatar = (name, cls = "") =>
    `<span class="avatar ${cls}" style="background:${colorFor(name)}" title="${esc(name)}">${esc(initials(name))}</span>`;

  const local = {
    get(k, d = "") { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  // Identità: un id diverso per ogni scheda aperta, il nome resta nel browser.
  const storedName = local.get("planner.name");
  const me = { id: uid(), name: storedName || "Ospite", color: colorFor(storedName || "Ospite") };
  const store = window.createStore(me);

  // Salvataggi ritardati: chi scrive vede tutto subito, il database riceve una scrittura ogni mezzo secondo.
  const timers = new Map();
  const statusEls = new Set();
  const setStatus = (text) => statusEls.forEach((el) => (el.textContent = text));

  function scheduleSave(table, row, delay = 500) {
    const key = `${table}:${row.id}`;
    clearTimeout(timers.get(key));
    setStatus("Salvataggio…");
    timers.set(key, setTimeout(() => saveNow(table, row), delay));
  }
  async function saveNow(table, row) {
    const key = `${table}:${row.id}`;
    clearTimeout(timers.get(key));
    timers.delete(key);
    try {
      await store.save(table, row);
      if (!timers.size) setStatus("Salvato");
    } catch (err) {
      setStatus(err && err.message === "Spazio del browser esaurito" ? err.message : "Errore di salvataggio — riprova");
    }
  }
  const isPending = (table, id) => timers.has(`${table}:${id}`);
  function cancelSave(table, id) {
    clearTimeout(timers.get(`${table}:${id}`));
    timers.delete(`${table}:${id}`);
  }

  // Modifica locale: aggiorna, trasmette subito agli altri, salva poco dopo.
  function change(table, row, field, value, delay = 500, extra = {}) {
    row[field] = value;
    store.sendTyping({ table, id: row.id, field, value, ...extra, user: me });
    scheduleSave(table, row, delay);
  }

  // Etichetta "Nome sta scrivendo…" che sparisce da sola.
  const typingTimers = {};
  function flash(key, show, hide, ms = 1500) {
    show();
    clearTimeout(typingTimers[key]);
    typingTimers[key] = setTimeout(hide, ms);
  }
  const typingLabel = (user) =>
    `<span style="color:${esc(user.color)}">✎ ${esc(user.name)} sta scrivendo…</span>`;

  return {
    $, $$, uid, esc, hash, colorFor, initials, avatar, local,
    me, storedName, store,
    statusEls, scheduleSave, saveNow, isPending, cancelSave, change,
    flash, typingLabel,
    people: [me],
  };
})();
