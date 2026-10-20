const test = require('node:test');
const assert = require('node:assert/strict');
const { installStubs, loadRoute, call, makeReq } = require('./helpers');

installStubs();
const { requireUser, withUser, AuthError } = loadRoute('_lib/auth.js');

test('requireUser rejects a request with no Authorization header', async () => {
  await assert.rejects(requireUser(makeReq()), (err) => err instanceof AuthError && err.status === 401);
});

test('requireUser rejects a non-Bearer Authorization header', async () => {
  await assert.rejects(
    requireUser(makeReq({ token: 'Basic dXNlcjpwYXNz' })),
    (err) => err instanceof AuthError && err.status === 401,
  );
});

test('requireUser rejects an empty Bearer token', async () => {
  await assert.rejects(
    requireUser(makeReq({ token: 'Bearer ' })),
    (err) => err instanceof AuthError && err.status === 401,
  );
});

test('requireUser rejects a token that fails verification', async () => {
  await assert.rejects(
    requireUser(makeReq({ token: 'Bearer forged' })),
    (err) => err instanceof AuthError && err.status === 401,
  );
});

test('requireUser returns the uid from a verified token', async () => {
  assert.equal(await requireUser(makeReq({ token: 'Bearer valid:alice' })), 'alice');
});

test('withUser answers 401 with code UNAUTHENTICATED, distinct from YNAB REAUTH_REQUIRED', async () => {
  let ran = false;
  const handler = withUser(async () => { ran = true; });
  const res = await call(handler, {});
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'UNAUTHENTICATED');
  assert.equal(ran, false);
});

test('withUser answers 403 when a client-supplied user_id disagrees with the token', async () => {
  let ran = false;
  const handler = withUser(async () => { ran = true; });
  const fromQuery = await call(handler, { token: 'Bearer valid:alice', query: { user_id: 'bob' } });
  const fromBody = await call(handler, { method: 'POST', token: 'Bearer valid:alice', body: { user_id: 'bob' } });
  assert.equal(fromQuery.statusCode, 403);
  assert.equal(fromBody.statusCode, 403);
  assert.equal(ran, false);
});

test('withUser passes the verified uid to the handler', async () => {
  let seen;
  const handler = withUser(async (_req, res, uid) => { seen = uid; res.json({ ok: true }); });
  const res = await call(handler, { token: 'Bearer valid:alice', query: { user_id: 'alice' } });
  assert.equal(res.statusCode, 200);
  assert.equal(seen, 'alice');
});
