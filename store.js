// Livello dati: stessa interfaccia per la modalità locale e per Supabase.
//
//   store.mode                       "live" | "local"
//   store.list()                     -> Promise<Task[]>
//   store.save(task)                 salva (insert o update)
//   store.remove(id)
//   store.onTask(cb)                 cb({type:"upsert"|"delete", task})  modifiche di altri
//   store.sendTyping(payload)        trasmette ciò che si sta scrivendo, lettera per lettera
//   store.onTyping(cb)
//   store.onPeople(cb)               cb([{id,name,color}])  chi è online

(function () {
  const cfg = window.PLANNER_CONFIG || {};

  function createLocalStore(me) {
    const KEY = "planner.tasks";
    const bc = "BroadcastChannel" in window ? new BroadcastChannel("planner-app") : null;
    const listeners = { task: [], typing: [], people: [] };
    const peers = new Map();

    const read = () => {
      try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
    };
    const write = (tasks) => {
      try { localStorage.setItem(KEY, JSON.stringify(tasks)); } catch {}
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
        if (data.kind === "task") emit("task", data.payload);
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
      async list() { return read(); },
      async save(task) {
        const tasks = read();
        const i = tasks.findIndex((t) => t.id === task.id);
        if (i >= 0) tasks[i] = task; else tasks.push(task);
        write(tasks);
        post({ kind: "task", payload: { type: "upsert", task } });
      },
      async remove(id) {
        write(read().filter((t) => t.id !== id));
        post({ kind: "task", payload: { type: "delete", task: { id } } });
      },
      sendTyping(payload) { post({ kind: "typing", payload }); },
      onTask(cb) { listeners.task.push(cb); },
      onTyping(cb) { listeners.typing.push(cb); },
      onPeople(cb) { listeners.people.push(cb); },
    };
  }

  function createSupabaseStore(me) {
    const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    const listeners = { task: [], typing: [], people: [] };
    const emit = (kind, data) => listeners[kind].forEach((cb) => cb(data));

    const channel = db.channel("planner-app", {
      config: { broadcast: { self: false }, presence: { key: me.id } },
    });

    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (p) => {
        if (p.eventType === "DELETE") return emit("task", { type: "delete", task: p.old });
        if (p.new.updated_by === me.id) return; // è il nostro salvataggio che torna indietro
        emit("task", { type: "upsert", task: p.new });
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => emit("typing", payload))
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        emit("people", Object.values(state).map((list) => list[0]));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") channel.track(me);
      });

    const check = ({ error }) => { if (error) { console.error(error); throw error; } };

    return {
      mode: "live",
      async list() {
        const res = await db.from("tasks").select("*").order("position");
        check(res);
        return res.data;
      },
      async save(task) {
        check(await db.from("tasks").upsert({ ...task, updated_by: me.id, updated_at: new Date().toISOString() }));
      },
      async remove(id) { check(await db.from("tasks").delete().eq("id", id)); },
      sendTyping(payload) { channel.send({ type: "broadcast", event: "typing", payload }); },
      onTask(cb) { listeners.task.push(cb); },
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
