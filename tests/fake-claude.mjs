// In-memory stand-in for the Artifact runtime: claude.use('db') and claude.use('user').
export function installFakeClaude(window, { uid = 'u_me', canWrite = true, names = {}, seed = {}, failAudit = 0, holdFirstSnapshot = false, refuseAnswerWrites = false } = {}) {
  const store = new Map(Object.entries(seed).map(([k, v]) => [k, structuredClone(v)]));
  const writes = [];
  const subs = [];
  let auditFailures = failAudit;
  const meta = { fromCache: false, hasPendingWrites: false };
  const deepFreeze = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };
  const snapDoc = (path) => ({ id: path.split('/').pop(), exists: store.has(path), data: () => (store.has(path) ? deepFreeze(structuredClone(store.get(path))) : undefined), metadata: meta });
  const emit = (only) => {
    for (const s of subs) {
      if (only && s.coll !== only) continue;
      if (holdFirstSnapshot && !s.released) continue;
      const docs = [...store.keys()]
        .filter((k) => k.split('/').length === 2 && k.startsWith(s.coll + '/'))
        .sort()
        .map(snapDoc);
      s.fn({ docs, size: docs.length, empty: docs.length === 0, docChanges: () => [], metadata: meta });
    }
  };
  const db = {
    doc(path) {
      return {
        id: path.split('/').pop(),
        path,
        async get() { return snapDoc(path); },
        async set(data) {
          if (refuseAnswerWrites && path.startsWith('answers/')) {
            throw Object.assign(new Error('invalid_argument'), { code: 'invalid_argument' });
          }
          if (path.startsWith('audit/') && auditFailures > 0) {
            auditFailures--;
            throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
          }
          const body = structuredClone(data);
          store.set(path, body);
          writes.push({ path, data: body });
          emit();
        },
      };
    },
    collection(coll) {
      return {
        path: coll,
        onSnapshot(fn) { const s = { coll, fn, released: !holdFirstSnapshot }; subs.push(s); if (!holdFirstSnapshot) queueMicrotask(() => emit()); return () => {}; },
      };
    },
  };
  const user = {
    id: async () => uid,
    can: async () => canWrite,
    profiles: async (ids) => Object.fromEntries(ids.map((i) => [i, { name: names[i] || '' }])),
  };
  window.claude = { use: async (name) => (name === 'db' ? db : name === 'user' ? user : null) };
  return {
    store,
    writes,
    // With holdFirstSnapshot: emit the first snapshot for one collection, or for all when none is named.
    release(coll) { for (const s of subs) if (!coll || s.coll === coll) s.released = true; emit(coll); },
    // A teammate's write that bypasses this page. silent: the page gets no snapshot.
    external(path, data, { silent = false } = {}) {
      store.set(path, structuredClone(data));
      if (!silent) emit();
    },
  };
}
