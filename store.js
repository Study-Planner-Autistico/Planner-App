// Livello dati: stessa interfaccia per la modalità locale e per Supabase.
//
//   store.mode                         "live" | "local"
//   store.list(table)                  -> Promise<Row[]>      table: "tasks" | "pages"
//   store.save(table, row)             salva (insert o update)
//   store.remove(table, id)
//   store.upload(folder, file)         -> Promise<{name,size,type,path,url}>
//   store.removeFile(path)
//   store.onRow(cb)                    cb({table, type:"upsert"|"delete", row})  modifiche di altri
//   store.sendTyping(payload)          trasmette ciò che si sta scrivendo, lettera per lettera
//   store.onTyping(cb)
//   store.onPeople(cb)                 cb([{id,name,color}])  chi è online

(function () {
  const cfg = window.PLANNER_CONFIG || {};
  const MAX_LOCAL_FILE = 1024 * 1024; // in modalità locale i file finiscono nel browser: massimo 1 MB

  const safeName = (name) =>
    name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_").slice(-80) || "file";
  const rand = () => Math.random().toString(36).slice(2, 10);

  function createLocalStore(me) {
    const key = (table) => `planner.${table}`;
    const bc = "BroadcastChannel" in window ? new BroadcastChannel("planner-app") : null;
    const listeners = { row: [], typing: [], people: [] };
    const peers = new Map();

    const read = (table) => {
      try { return JSON.parse(localStorage.getItem(key(table)) || "[]"); } catch { return []; }
    };
    const write = (table, rows) => {
      try { localStorage.setItem(key(table), JSON.stringify(rows)); return true; } catch { return false; }
    };
    const emit = (kind, data) => listeners[kind].forEach((cb) => cb(data));
    const post = (msg) => bc && bc.postMessage(msg);

    const emitPeople = () => {
      const now = Date.now();
      for (const [id, p] of peers) if (now - p.seen > 6000) peers.delete(id);
      emit("people", [me, ...peers.values()]);
    };

    if (bc) {
      bc.onmessage = ({ data }) => {
        if (data.kind === "row") emit("row", data.payload);
        if (data.kind === "typing") emit("typing", data.payload);
        if (data.kind === "hello") {
          const known = peers.has(data.payload.id);
          peers.set(data.payload.id, { ...data.payload, seen: Date.now() });
          if (!known) post({ kind: "hello", payload: me });
          emitPeople();
        }
        if (data.kind === "bye") { peers.delete(data.payload.id); emitPeople(); }
      };
      post({ kind: "hello", payload: me });
      setInterval(() => { post({ kind: "hello", payload: me }); emitPeople(); }, 2500);
      window.addEventListener("beforeunload", () => post({ kind: "bye", payload: me }));
    }
    setTimeout(emitPeople, 0);

    return {
      mode: "local",
      async list(table) { return read(table); },
      async save(table, row) {
        const rows = read(table);
        const i = rows.findIndex((r) => r.id === row.id);
        if (i >= 0) rows[i] = row; else rows.push(row);
        if (!write(table, rows)) throw new Error("Spazio del browser esaurito");
        post({ kind: "row", payload: { table, type: "upsert", row } });
      },
      async remove(table, id) {
        write(table, read(table).filter((r) => r.id !== id));
        post({ kind: "row", payload: { table, type: "delete", row: { id } } });
      },
      async upload(folder, file) {
        if (file.size > MAX_LOCAL_FILE) throw new Error("In modalità locale i file possono pesare al massimo 1 MB");
        const url = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        return { name: file.name, size: file.size, type: file.type, path: `${folder}/${rand()}-${safeName(file.name)}`, url };
      },
      async removeFile() {},
      sendTyping(payload) { post({ kind: "typing", payload }); },
      onRow(cb) { listeners.row.push(cb); },
      onTyping(cb) { listeners.typing.push(cb); },
      onPeople(cb) { listeners.people.push(cb); },
    };
  }

  function createSupabaseStore(me) {
    const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    const bucket = db.storage.from("attachments");
    const listeners = { row: [], typing: [], people: [] };
    const emit = (kind, data) => listeners[kind].forEach((cb) => cb(data));

    const channel = db.channel("planner-app", {
      config: { broadcast: { self: false }, presence: { key: me.id } },
    });

    channel
      .on("postgres_changes", { event: "*", schema: "public" }, (p) => {
        if (p.table !== "tasks" && p.table !== "pages") return;
        if (p.eventType === "DELETE") return emit("row", { table: p.table, type: "delete", row: p.old });
        if (p.new.updated_by === me.id) return; // è il nostro salvataggio che torna indietro
        emit("row", { table: p.table, type: "upsert", row: p.new });
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => emit("typing", payload))
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        emit("people", Object.values(state).map((list) => list[0]));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") channel.track(me);
      });

    const check = ({ error, data }) => {
      if (error) { console.error(error); throw error; }
      return data;
    };

    return {
      mode: "live",
      async list(table) {
        return check(await db.from(table).select("*").order("position"));
      },
      async save(table, row) {
        check(await db.from(table).upsert({ ...row, updated_by: me.id, updated_at: new Date().toISOString() }));
      },
      async remove(table, id) { check(await db.from(table).delete().eq("id", id)); },
      async upload(folder, file) {
        const path = `${folder}/${rand()}-${safeName(file.name)}`;
        check(await bucket.upload(path, file, { contentType: file.type || undefined, upsert: false }));
        const url = bucket.getPublicUrl(path).data.publicUrl;
        return { name: file.name, size: file.size, type: file.type, path, url };
      },
      async removeFile(path) { check(await bucket.remove([path])); },
      sendTyping(payload) { channel.send({ type: "broadcast", event: "typing", payload }); },
      onRow(cb) { listeners.row.push(cb); },
      onTyping(cb) { listeners.typing.push(cb); },
      onPeople(cb) { listeners.people.push(cb); },
    };
  }

  window.createStore = function (me) {
    // Aggiungi ?local all'indirizzo per provare l'app senza toccare i dati del team.
    const forceLocal = new URLSearchParams(location.search).has("local");
    const live = !forceLocal && cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase;
    return live ? createSupabaseStore(me) : createLocalStore(me);
  };
})();
