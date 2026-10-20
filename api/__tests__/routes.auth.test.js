const test = require('node:test');
const assert = require('node:assert/strict');
const { installStubs, loadRoute, call } = require('./helpers');

const { db, axiosCalls } = installStubs();

const ALICE = 'Bearer valid:alice';
const CSV = [
  'Ticker,Description,Account,Held,Price,Quantity,Amount',
  'VTI,Vanguard Total,1234,50%,$200.00,10,"$2,000.00"',
].join('\n');

// Every Firestore-backed user route, by method. Bodies are otherwise valid so
// that only authentication decides the outcome.
const ROUTES = [
  { name: 'GET /api/ynab/token', path: 'ynab/token.js', method: 'GET' },
  { name: 'POST /api/ynab/token', path: 'ynab/token.js', method: 'POST', body: { code: 'oauth-code' } },
  { name: 'POST /api/ynab/save_token', path: 'ynab/save_token.js', method: 'POST', body: { access_token: 'a', refresh_token: 'r' } },
  { name: 'POST /api/ynab/refresh_token', path: 'ynab/refresh_token.js', method: 'POST', body: { refresh_token: 'r' } },
  { name: 'DELETE /api/ynab/disconnect', path: 'ynab/disconnect.js', method: 'DELETE', body: {} },
  { name: 'GET /api/manual_accounts', path: 'manual_accounts/index.js', method: 'GET' },
  { name: 'POST /api/manual_accounts', path: 'manual_accounts/index.js', method: 'POST', body: { account: { name: 'Cash' } } },
  { name: 'PUT /api/manual_accounts/:id', path: 'manual_accounts/[accountId].js', method: 'PUT', query: { accountId: 'acct-1' }, body: { account: { name: 'X' } } },
  { name: 'DELETE /api/manual_accounts/:id', path: 'manual_accounts/[accountId].js', method: 'DELETE', query: { accountId: 'acct-1' } },
  { name: 'GET /api/manual_holdings', path: 'manual_holdings/index.js', method: 'GET' },
  { name: 'POST /api/manual_holdings', path: 'manual_holdings/index.js', method: 'POST', body: { holding: { ticker: 'VTI' } } },
  { name: 'PUT /api/manual_holdings/:id', path: 'manual_holdings/[holdingId].js', method: 'PUT', query: { holdingId: 'hold-1' }, body: { holding: { quantity: 1 } } },
  { name: 'DELETE /api/manual_holdings/:id', path: 'manual_holdings/[holdingId].js', method: 'DELETE', query: { holdingId: 'hold-1' } },
  { name: 'POST /api/import-altruist-holdings', path: 'import-altruist-holdings.js', method: 'POST', body: { csvData: CSV } },
];

// Routes that historically took user_id from the client.
const USER_ID_ROUTES = ROUTES.filter((r) => !r.path.includes('['));

function seedVictimData() {
  db.reset();
  axiosCalls.length = 0;
  db.seed('ynab_tokens', 'bob', { access_token: 'bob-access', refresh_token: 'bob-refresh' });
  db.seed('manual_accounts', 'acct-1', { userId: 'bob', name: 'Bob checking' });
  db.seed('user_holdings', 'hold-1', { userId: 'bob', ticker: 'BND', source: 'manual' });
  db.seed('user_holdings', 'hold-alt', { userId: 'bob', ticker: 'VTI', source: 'AltruistCSV' });
}

function snapshot() {
  return JSON.stringify({
    tokens: db.all('ynab_tokens'),
    accounts: db.all('manual_accounts'),
    holdings: db.all('user_holdings'),
  });
}

function withUserId(route, uid) {
  if (route.method === 'GET') return { ...route, query: { ...route.query, user_id: uid } };
  return { ...route, body: { ...route.body, user_id: uid } };
}

for (const route of ROUTES) {
  test(`${route.name} returns 401 without a token and touches nothing`, async () => {
    seedVictimData();
    const before = snapshot();
    const res = await call(loadRoute(route.path), withUserId(route, 'bob'));
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.code, 'UNAUTHENTICATED');
    assert.equal(snapshot(), before);
    assert.equal(axiosCalls.length, 0);
  });

  test(`${route.name} returns 401 with an invalid token`, async () => {
    seedVictimData();
    const before = snapshot();
    const res = await call(loadRoute(route.path), { ...withUserId(route, 'bob'), token: 'Bearer forged' });
    assert.equal(res.statusCode, 401);
    assert.equal(snapshot(), before);
  });

  test(`${route.name} still answers CORS preflight without a token`, async () => {
    const res = await call(loadRoute(route.path), { method: 'OPTIONS' });
    assert.equal(res.statusCode, 200);
  });
}

for (const route of USER_ID_ROUTES) {
  test(`${route.name} returns 403 when user_id names another user, and touches nothing`, async () => {
    seedVictimData();
    const before = snapshot();
    const res = await call(loadRoute(route.path), { ...withUserId(route, 'bob'), token: ALICE });
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.access_token, undefined);
    assert.equal(snapshot(), before);
    assert.equal(axiosCalls.length, 0);
  });
}

// Ownership checks on the per-document routes.
for (const route of ROUTES.filter((r) => r.path.includes('['))) {
  test(`${route.name} returns 403 for a document owned by another user`, async () => {
    seedVictimData();
    const before = snapshot();
    const res = await call(loadRoute(route.path), { ...route, token: ALICE });
    assert.equal(res.statusCode, 403);
    assert.equal(snapshot(), before);
  });

  test(`${route.name} returns 404 for a missing document`, async () => {
    seedVictimData();
    const idKey = Object.keys(route.query)[0];
    const res = await call(loadRoute(route.path), { ...route, query: { [idKey]: 'nope' }, token: ALICE });
    assert.equal(res.statusCode, 404);
  });
}

test('GET /api/ynab/token never returns another user\'s tokens', async () => {
  seedVictimData();
  const handler = loadRoute('ynab/token.js');
  const asked = await call(handler, { token: ALICE, query: { user_id: 'bob' } });
  assert.equal(asked.statusCode, 403);
  assert.ok(!JSON.stringify(asked.body).includes('bob-'));

  const own = await call(handler, { token: ALICE });
  assert.equal(own.statusCode, 200);
  assert.deepEqual(own.body, { access_token: null, refresh_token: null });

  const bob = await call(handler, { token: 'Bearer valid:bob' });
  assert.deepEqual(bob.body, { access_token: 'bob-access', refresh_token: 'bob-refresh' });
});

test('POST /api/ynab/save_token writes only to the caller\'s document', async () => {
  seedVictimData();
  const res = await call(loadRoute('ynab/save_token.js'), {
    method: 'POST', token: ALICE, body: { access_token: 'alice-a', refresh_token: 'alice-r' },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(db.read('ynab_tokens', 'alice').access_token, 'alice-a');
  assert.equal(db.read('ynab_tokens', 'bob').access_token, 'bob-access');
});

test('POST /api/ynab/refresh_token stores the refreshed tokens under the caller', async () => {
  seedVictimData();
  const res = await call(loadRoute('ynab/refresh_token.js'), {
    method: 'POST', token: ALICE, body: { refresh_token: 'alice-r' },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(db.read('ynab_tokens', 'alice').access_token, 'new-access');
  assert.equal(db.read('ynab_tokens', 'bob').access_token, 'bob-access');
});

test('DELETE /api/ynab/disconnect removes only the caller\'s tokens', async () => {
  seedVictimData();
  db.seed('ynab_tokens', 'alice', { access_token: 'alice-a' });
  const res = await call(loadRoute('ynab/disconnect.js'), { method: 'DELETE', token: ALICE, body: {} });
  assert.equal(res.statusCode, 200);
  assert.equal(db.read('ynab_tokens', 'alice'), undefined);
  assert.equal(db.read('ynab_tokens', 'bob').access_token, 'bob-access');
});

test('GET /api/manual_accounts lists only the caller\'s accounts', async () => {
  seedVictimData();
  db.seed('manual_accounts', 'acct-a', { userId: 'alice', name: 'Alice savings' });
  const res = await call(loadRoute('manual_accounts/index.js'), { token: ALICE });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.accounts.map((a) => a.id), ['acct-a']);
});

test('POST /api/manual_accounts stamps the caller as owner even if the payload claims otherwise', async () => {
  seedVictimData();
  const res = await call(loadRoute('manual_accounts/index.js'), {
    method: 'POST', token: ALICE, body: { account: { name: 'Sneaky', userId: 'bob' } },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(db.read('manual_accounts', res.body.id).userId, 'alice');
});

test('PUT /api/manual_accounts/:id updates the caller\'s own account and cannot reassign it', async () => {
  seedVictimData();
  db.seed('manual_accounts', 'acct-a', { userId: 'alice', name: 'Alice savings' });
  const res = await call(loadRoute('manual_accounts/[accountId].js'), {
    method: 'PUT', token: ALICE, query: { accountId: 'acct-a' }, body: { account: { name: 'Renamed', userId: 'bob' } },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(db.read('manual_accounts', 'acct-a').name, 'Renamed');
  assert.equal(db.read('manual_accounts', 'acct-a').userId, 'alice');
});

test('ownership also honours the legacy user_id field', async () => {
  seedVictimData();
  db.seed('manual_accounts', 'acct-legacy', { user_id: 'alice', name: 'Legacy' });
  const res = await call(loadRoute('manual_accounts/[accountId].js'), {
    method: 'DELETE', token: ALICE, query: { accountId: 'acct-legacy' },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(db.read('manual_accounts', 'acct-legacy'), undefined);
});

test('DELETE /api/manual_holdings/:id deletes the caller\'s own holding', async () => {
  seedVictimData();
  db.seed('user_holdings', 'hold-a', { userId: 'alice', ticker: 'VXUS' });
  const res = await call(loadRoute('manual_holdings/[holdingId].js'), {
    method: 'DELETE', token: ALICE, query: { holdingId: 'hold-a' },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(db.read('user_holdings', 'hold-a'), undefined);
  assert.ok(db.read('user_holdings', 'hold-1'));
});

test('GET /api/manual_holdings lists only the caller\'s holdings', async () => {
  seedVictimData();
  db.seed('user_holdings', 'hold-a', { userId: 'alice', ticker: 'VXUS' });
  const res = await call(loadRoute('manual_holdings/index.js'), { token: ALICE });
  assert.deepEqual(res.body.holdings.map((h) => h.id), ['hold-a']);
});

test('POST /api/import-altruist-holdings replaces only the caller\'s Altruist holdings', async () => {
  seedVictimData();
  const res = await call(loadRoute('import-altruist-holdings.js'), {
    method: 'POST', token: ALICE, body: { csvData: CSV },
  });
  assert.equal(res.statusCode, 200);
  assert.ok(db.read('user_holdings', 'hold-alt'), "bob's Altruist holding must survive");
  const aliceHoldings = db.all('user_holdings').filter((h) => h.userId === 'alice');
  assert.equal(aliceHoldings.length, 1);
  assert.equal(aliceHoldings[0].ticker, 'VTI');
});
