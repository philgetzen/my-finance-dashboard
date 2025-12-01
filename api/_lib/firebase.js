const admin = require('firebase-admin');

let firebaseApp = null;
let firestoreDb = null;

function getFirebaseAdmin() {
  if (!firebaseApp) {
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
    };

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    console.log('Firebase Admin initialized successfully');
  }
  return admin;
}

function getFirestore() {
  if (!firestoreDb) {
    const adminInstance = getFirebaseAdmin();
    firestoreDb = adminInstance.firestore();
    firestoreDb.settings({ ignoreUndefinedProperties: true });
  }
  return firestoreDb;
}

module.exports = { getFirebaseAdmin, getFirestore };
