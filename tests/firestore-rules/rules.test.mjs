// firestore.rules governs direct client-SDK access to these collections.
// The API routes trust a document's owner fields, so the rules must stop a
// client from writing a document that claims someone else as owner.
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-healthywealth',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'manual_accounts', 'mallory-acct'), { user_id: 'mallory', name: 'Mine' });
    await setDoc(doc(db, 'user_holdings', 'mallory-hold'), { user_id: 'mallory', ticker: 'VTI' });
    await setDoc(doc(db, 'manual_accounts', 'alice-acct'), { user_id: 'alice', userId: 'alice', name: 'Alice' });
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();

for (const collection of ['manual_accounts', 'user_holdings']) {
  const own = collection === 'manual_accounts' ? 'mallory-acct' : 'mallory-hold';

  test(`${collection}: a user can create and update their own document`, async () => {
    const db = as('mallory');
    await assertSucceeds(setDoc(doc(db, collection, 'new'), { user_id: 'mallory', name: 'ok' }));
    await assertSucceeds(setDoc(doc(db, collection, 'new2'), { user_id: 'mallory', userId: 'mallory' }));
    await assertSucceeds(updateDoc(doc(db, collection, own), { name: 'renamed' }));
    await assertSucceeds(deleteDoc(doc(db, collection, own)));
  });

  test(`${collection}: create cannot name another user in userId`, async () => {
    await assertFails(setDoc(doc(as('mallory'), collection, 'plant'), { user_id: 'mallory', userId: 'alice' }));
  });

  test(`${collection}: update cannot hand the document to another user via user_id`, async () => {
    await assertFails(updateDoc(doc(as('mallory'), collection, own), { user_id: 'alice' }));
  });

  test(`${collection}: update cannot set userId to another user`, async () => {
    await assertFails(updateDoc(doc(as('mallory'), collection, own), { userId: 'alice' }));
  });
}

test('a user cannot read or delete another user\'s account', async () => {
  await assertFails(getDoc(doc(as('mallory'), 'manual_accounts', 'alice-acct')));
  await assertFails(deleteDoc(doc(as('mallory'), 'manual_accounts', 'alice-acct')));
});
