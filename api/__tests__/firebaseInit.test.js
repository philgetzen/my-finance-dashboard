// Loads the real api/_lib/firebase.js against the installed firebase-admin,
// unlike the route tests, which stub that module out. Guards the Admin SDK
// version Vercel installs from the root package.json: credential parsing,
// app init and service construction. Offline: no token is verified.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

// Vercel stores the key with escaped newlines; firebase.js unescapes them.
process.env.FIREBASE_PROJECT_ID = 'healthywealth-test';
process.env.FIREBASE_PRIVATE_KEY_ID = 'test-key-id';
process.env.FIREBASE_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n');
process.env.FIREBASE_CLIENT_EMAIL = 'test@healthywealth-test.iam.gserviceaccount.com';
process.env.FIREBASE_CLIENT_ID = '1234567890';

const { getFirebaseAdmin, getFirestore } = require('../_lib/firebase');

test('the Admin SDK initializes from the service-account env vars', () => {
  const admin = getFirebaseAdmin();
  assert.equal(admin.app().options.credential.projectId, 'healthywealth-test');
  assert.equal(typeof admin.auth().verifyIdToken, 'function');
});

test('getFirestore returns one configured instance', () => {
  const db = getFirestore();
  assert.equal(typeof db.collection, 'function');
  assert.equal(getFirestore(), db);
});
