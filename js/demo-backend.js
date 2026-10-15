/**
 * demo-backend.js
 * -------------------------------------------------------
 * "Servidor" da demonstração. Imita a parte do Firebase que o
 * cardápio e o painel usam (Firestore, Auth, Storage e Functions),
 * mas guarda tudo SÓ no navegador de quem está usando
 * (localStorage, um espaço por nicho).
 *
 * Por quê: a amostra fica pública no GitHub Pages. Assim o painel
 * funciona de verdade na apresentação, sem banco na nuvem, sem
 * custo e sem nada que um visitante possa estragar para outro.
 * A versão de cada cliente real usa o Firebase de verdade, com as
 * mesmas regras de segurança da açaiteria.
 *
 * Abas abertas no mesmo navegador conversam entre si
 * (BroadcastChannel): o pedido feito no cardápio aparece na hora
 * no painel aberto em outra aba.
 * -------------------------------------------------------
 */

const DEMO_KEY = `ponto-expresso-demo:v1:${NICHO_ID}`;
const DEMO_LIMITE_BYTES = 4_000_000; // fica abaixo da cota típica de 5 MB do localStorage

/* ---------------- Valores especiais (datas e incrementos) ---------------- */

class DemoTimestamp {
  constructor(ms) { this.ms = ms; }
  toDate() { return new Date(this.ms); }
  toMillis() { return this.ms; }
}
const SERVER_TS = { __sentinel: "serverTimestamp" };
const incrementBy = n => ({ __sentinel: "increment", n: Number(n) || 0 });

/** Converte para o formato guardado: datas viram { __ts: ms }. */
function encodeValue(v, previous) {
  if (v === SERVER_TS) return { __ts: Date.now() };
  if (v && v.__sentinel === "increment") return (Number(previous) || 0) + v.n;
  if (v instanceof Date) return { __ts: v.getTime() };
  if (v instanceof DemoTimestamp) return { __ts: v.ms };
  if (Array.isArray(v)) return v.map(x => encodeValue(x));
  if (v && typeof v === "object") {
    const out = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = encodeValue(x, previous?.[k]);
    return out;
  }
  return v;
}

/** Converte de volta: { __ts } vira um objeto com toDate()/toMillis(), como no Firestore. */
function decodeValue(v) {
  if (Array.isArray(v)) return v.map(decodeValue);
  if (v && typeof v === "object") {
    if (typeof v.__ts === "number") return new DemoTimestamp(v.__ts);
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = decodeValue(x);
    return out;
  }
  return v;
}

/** Valor comparável (datas viram milissegundos). */
function comparable(v) {
  if (v instanceof Date) return v.getTime();
  if (v instanceof DemoTimestamp) return v.ms;
  if (v && typeof v === "object" && typeof v.__ts === "number") return v.__ts;
  return v;
}

const newId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return [...bytes].map(b => chars[b % chars.length]).join("");
};

/* ---------------- Armazenamento ---------------- */

const DemoStore = (() => {
  let memoryOnly = false; // navegador sem localStorage (ex.: aba anônima restrita): funciona, mas não guarda
  let state = null;
  const listeners = new Set();

  function read() {
    try {
      const raw = localStorage.getItem(DEMO_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.cols) return parsed;
      }
    } catch { memoryOnly = true; }
    return null;
  }

  function write() {
    if (memoryOnly) return;
    const raw = JSON.stringify(state);
    if (raw.length > DEMO_LIMITE_BYTES) {
      throw new Error("O espaço da demonstração neste navegador acabou. Apague fotos ou use “Restaurar amostra”.");
    }
    try { localStorage.setItem(DEMO_KEY, raw); }
    catch { throw new Error("O navegador recusou salvar a demonstração (espaço cheio ou modo privado)."); }
  }

  function init() {
    state = read();
    if (!state) {
      state = demoSeed();
      try { write(); } catch (err) { console.warn(err.message); }
    }
  }

  let channel = null;
  try { channel = new BroadcastChannel(DEMO_KEY); } catch {}
  const reloadFromOtherTab = () => { const fresh = read(); if (fresh) { state = fresh; notify(); } };
  if (channel) channel.onmessage = reloadFromOtherTab;
  else window.addEventListener("storage", e => { if (e.key === DEMO_KEY) reloadFromOtherTab(); });

  function notify() { listeners.forEach(fn => { try { fn(); } catch (err) { console.error(err); } }); }

  return {
    get state() { if (!state) init(); return state; },
    /** Aplica mudanças e avisa todo mundo. Se não couber, desfaz. */
    commit(mutator) {
      if (!state) init();
      const backup = JSON.stringify(state);
      mutator(state);
      try { write(); }
      catch (err) { state = JSON.parse(backup); throw err; }
      notify();
      channel?.postMessage("changed");
    },
    reset() {
      state = demoSeed();
      write();
      notify();
      channel?.postMessage("changed");
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get memoryOnly() { return memoryOnly; },
  };
})();

/* ---------------- Firestore (subconjunto usado pelo projeto) ---------------- */

function demoDocSnap(col, id) {
  const raw = DemoStore.state.cols[col]?.[id];
  return {
    id,
    exists: raw !== undefined,
    ref: new DemoDocRef(col, id),
    data: () => (raw === undefined ? undefined : decodeValue(JSON.parse(JSON.stringify(raw)))),
  };
}

class DemoDocRef {
  constructor(col, id) { this.col = col; this.id = id; }
  async get() { await demoLatency(); return demoDocSnap(this.col, this.id); }
  async set(data, opts = {}) { await demoLatency(); DemoStore.commit(s => demoApplySet(s, this.col, this.id, data, opts)); }
  async update(data) {
    await demoLatency();
    if (!DemoStore.state.cols[this.col]?.[this.id]) throw new Error("Documento não encontrado.");
    DemoStore.commit(s => demoApplySet(s, this.col, this.id, data, { merge: true }));
  }
  async delete() { await demoLatency(); DemoStore.commit(s => { delete s.cols[this.col]?.[this.id]; }); }
  onSnapshot(cb, onError) {
    let last = null;
    const run = () => {
      try {
        const snap = demoDocSnap(this.col, this.id);
        const sig = JSON.stringify(DemoStore.state.cols[this.col]?.[this.id] ?? null);
        if (sig !== last) { last = sig; cb(snap); }
      } catch (err) { onError?.(err); }
    };
    queueMicrotask(run);
    return DemoStore.subscribe(run);
  }
}

function demoApplySet(s, col, id, data, { merge } = {}) {
  s.cols[col] = s.cols[col] || {};
  const prev = s.cols[col][id];
  const encoded = encodeValue(data, merge ? prev : undefined);
  s.cols[col][id] = merge && prev ? { ...prev, ...encoded } : encoded;
}

class DemoQuery {
  constructor(col, filters = [], order = null, max = null) {
    this.col = col; this.filters = filters; this.order = order; this.max = max;
  }
  where(field, op, value) { return new DemoQuery(this.col, [...this.filters, { field, op, value }], this.order, this.max); }
  orderBy(field, dir = "asc") { return new DemoQuery(this.col, this.filters, { field, dir }, this.max); }
  limit(n) { return new DemoQuery(this.col, this.filters, this.order, n); }

  run() {
    const rows = Object.entries(DemoStore.state.cols[this.col] || {});
    let ids = rows.filter(([, doc]) => this.filters.every(({ field, op, value }) => {
      const a = comparable(doc[field]);
      const b = Array.isArray(value) ? value.map(comparable) : comparable(value);
      switch (op) {
        case "==": return a === b;
        case ">=": return a !== undefined && a >= b;
        case ">": return a !== undefined && a > b;
        case "<=": return a !== undefined && a <= b;
        case "<": return a !== undefined && a < b;
        case "in": return b.includes(a);
        default: throw new Error(`Operador não suportado na demonstração: ${op}`);
      }
    }));
    if (this.order) {
      const { field, dir } = this.order;
      ids = ids.filter(([, d]) => d[field] !== undefined); // como no Firestore: sem o campo, fica de fora
      ids.sort(([, x], [, y]) => {
        const a = comparable(x[field]), b = comparable(y[field]);
        return (a > b ? 1 : a < b ? -1 : 0) * (dir === "desc" ? -1 : 1);
      });
    }
    if (this.max) ids = ids.slice(0, this.max);
    const docs = ids.map(([id]) => demoDocSnap(this.col, id));
    return { docs, empty: docs.length === 0, size: docs.length, forEach: fn => docs.forEach(fn) };
  }

  async get() { await demoLatency(); return this.run(); }

  onSnapshot(cb, onError) {
    let last = null;
    const run = () => {
      try {
        const snap = this.run();
        const sig = JSON.stringify(snap.docs.map(d => [d.id, DemoStore.state.cols[this.col][d.id]]));
        if (sig !== last) { last = sig; cb(snap); }
      } catch (err) { onError?.(err); }
    };
    queueMicrotask(run);
    return DemoStore.subscribe(run);
  }
}

class DemoCollection extends DemoQuery {
  constructor(col) { super(col); }
  doc(id) { return new DemoDocRef(this.col, id || newId()); }
  async add(data) { const ref = this.doc(); await ref.set(data); return ref; }
}

const db = {
  collection: name => new DemoCollection(name),
  batch() {
    const ops = [];
    return {
      set(ref, data, opts) { ops.push(s => demoApplySet(s, ref.col, ref.id, data, opts)); },
      update(ref, data) { ops.push(s => demoApplySet(s, ref.col, ref.id, data, { merge: true })); },
      delete(ref) { ops.push(s => { delete s.cols[ref.col]?.[ref.id]; }); },
      async commit() { await demoLatency(); DemoStore.commit(s => ops.forEach(op => op(s))); }, // tudo ou nada
    };
  },
};

/** Pequena espera para a demonstração "sentir" como um servidor de verdade. */
const demoLatency = (ms = 60) => new Promise(r => setTimeout(r, ms));

/* ---------------- Auth (login de demonstração) ---------------- */

const DEMO_SESSION = "ponto-expresso-demo:admin";
const auth = (() => {
  const callbacks = new Set();
  let user = null;
  try { if (sessionStorage.getItem(DEMO_SESSION) === "1") user = { uid: "demo", email: "demonstracao@ponto-expresso" }; } catch {}
  const emit = () => callbacks.forEach(cb => cb(user));
  return {
    get currentUser() { return user; },
    onAuthStateChanged(cb) {
      callbacks.add(cb);
      // Espera todos os scripts da página carregarem (como o Firebase, que responde depois)
      const fire = () => cb(user);
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fire, { once: true });
      else queueMicrotask(fire);
      return () => callbacks.delete(cb);
    },
    async signInDemo() {
      await demoLatency(250);
      user = { uid: "demo", email: "demonstracao@ponto-expresso" };
      try { sessionStorage.setItem(DEMO_SESSION, "1"); } catch {}
      emit();
    },
    async signOut() {
      user = null;
      try { sessionStorage.removeItem(DEMO_SESSION); } catch {}
      emit();
    },
  };
})();

/* ---------------- Storage (fotos viram data URL WebP pequenas) ---------------- */

const storage = {
  ref() {
    let url = "";
    return {
      async put(blob) {
        url = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
      },
      async getDownloadURL() { return url; },
    };
  },
  refFromURL() { return { delete: async () => {} }; }, // a foto mora dentro do produto: some junto
};

/* ---------------- Firebase (fachada usada pelo restante do código) ---------------- */

const firebase = {
  firestore: Object.assign(() => db, { FieldValue: { serverTimestamp: () => SERVER_TS, increment: incrementBy } }),
  functions: () => ({
    httpsCallable: name => async data => {
      await demoLatency(350);
      const fn = DemoServer[name];
      if (!fn) throw Object.assign(new Error("Função indisponível na demonstração."), { code: "functions/not-found" });
      return { data: fn(JSON.parse(JSON.stringify(data ?? {}))) };
    },
  }),
};
