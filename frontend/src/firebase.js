import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDpmDpdKkhTenjb3v2w2UjWKphwo-k3rG4",
  authDomain: "healthy-wealth-9d3c3.firebaseapp.com",
  projectId: "healthy-wealth-9d3c3",
  storageBucket: "healthy-wealth-9d3c3.firebasestorage.app",
  messagingSenderId: "485974811360",
  appId: "1:485974811360:web:53947cf79bf762c3802685",
  measurementId: "G-KSB47RZH72"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };