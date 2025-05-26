import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDpmDpdKkhTenjb3v2w2UjWKphwo-k3rG4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "healthy-wealth-9d3c3.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "healthy-wealth-9d3c3",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "healthy-wealth-9d3c3.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "485974811360",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:485974811360:web:53947cf79bf762c3802685",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-KSB47RZH72"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };