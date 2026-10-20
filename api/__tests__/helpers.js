// Test seams for the Vercel API routes. Every route reaches Firebase through
// api/_lib/firebase.js, so tests replace that module in the require cache with
// an in-memory Firestore and a fake verifyIdToken before loading any route.
// The `__tests__` directory starts with an underscore, so Vercel never deploys
// these files as functions.

const path = require('node:path');

const API_DIR = path.join(__dirname, '..');

// Tokens shaped "valid:<uid>" verify as that uid; anything else is rejected.
function fakeVerifyIdToken(token) {
  if (typeof token === 'string' && token.startsWith('valid:')) {
    return Promise.resolve({ uid: token.slice('valid:'.length) });
  }
  return Promise.reject(Object.assign(new Error('Decoding Firebase ID token failed'), {
    code: 'auth/argument-error',
  }));
}

function createFakeDb() {
  const store = new Map();
  let autoId = 0;
  const col = (name) => {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name);
  };

  function docRef(name, id) {
    return {
      id,
      async get() {
        const data = col(name).get(id);
        return { id, exists: data !== undefined, data: () => (data ? { ...data } : undefined), ref: docRef(name, id) };
      },
      async set(data, opts) {
        const prev = col(name).get(id);
        col(name).set(id, opts && opts.merge ? { ...prev, ...data } : { ...data });
      },
      async update(data) {
        if (!col(name).has(id)) throw new Error(`NOT_FOUND: ${name}/${id}`);
        col(name).set(id, { ...col(name).get(id), ...data });
      },
      async delete() {
        col(name).delete(id);
      },
    };
  }

  function query(name, filters) {
    return {
      where(field, _op, value) {
        return query(name, [...filters, [field, value]]);
      },
      async get() {
        const docs = [...col(name).entries()]
          .filter(([, d]) => filters.every(([f, v]) => d[f] === v))
          .map(([id, d]) => ({ id, data: () => ({ ...d }), ref: docRef(name, id) }));
        return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn) };
      },
    };
  }

  return {
    collection(name) {
      return {
        ...query(name, []),
        doc: (id) => docRef(name, id ?? `auto-${++autoId}`),
        async add(data) {
          const id = `auto-${++autoId}`;
          col(name).set(id, { ...data });
          return docRef(name, id);
        },
      };
    },
    batch() {
      const ops = [];
      return {
        set(ref, data) { ops.push(() => ref.set(data)); },
        delete(ref) { ops.push(() => ref.delete()); },
        async commit() { for (const op of ops) await op(); },
      };
    },
    // Test-only accessors
    seed(name, id, data) { col(name).set(id, { ...data }); },
    read(name, id) { return col(name).get(id); },
    all(name) { return [...col(name).entries()].map(([id, d]) => ({ id, ...d })); },
    reset() { store.clear(); autoId = 0; },
  };
}

function stubModule(resolvedPath, exports) {
  require.cache[resolvedPath] = { id: resolvedPath, filename: resolvedPath, loaded: true, exports, children: [] };
}

// Installs the Firebase stub (and an axios stub) and returns handles to them.
function installStubs() {
  const db = createFakeDb();
  const verifyIdToken = fakeVerifyIdToken;
  const admin = { auth: () => ({ verifyIdToken }) };
  stubModule(path.join(API_DIR, '_lib', 'firebase.js'), {
    getFirebaseAdmin: () => admin,
    getFirestore: () => db,
  });

  const axiosCalls = [];
  const axios = {
    async post(url, payload) {
      axiosCalls.push({ url, payload });
      return { data: { access_token: 'new-access', refresh_token: 'new-refresh' } };
    },
    async get() {
      throw new Error('axios.get not stubbed');
    },
  };
  stubModule(require.resolve('axios', { paths: [API_DIR] }), axios);

  return { db, axiosCalls };
}

function loadRoute(relPath) {
  return require(path.join(API_DIR, relPath));
}

function createRes() {
  const res = { statusCode: 200, headers: {}, body: undefined, ended: false };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; res.ended = true; return res; };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.end = () => { res.ended = true; return res; };
  return res;
}

function makeReq({ method = 'GET', query = {}, body, token, headers = {} } = {}) {
  const h = { ...headers };
  if (token !== undefined) h.authorization = token;
  return { method, query, body, headers: h };
}

async function call(handler, reqOpts) {
  const res = createRes();
  await handler(makeReq(reqOpts), res);
  return res;
}

module.exports = { installStubs, loadRoute, call, createRes, makeReq };
