import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePlaidData } from '../hooks/usePlaidData.jsx';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { ErrorBoundary } from 'react-error-boundary';
import { db } from '../firebase';
import firebase from 'firebase/app';

const PlaidDataContext = createContext();

export const PlaidDataProvider = (props) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe(); // Cleanup subscription on unmount
  }, []);

  const plaidData = usePlaidData(user);

  const saveAccessToken = async (userId, accessToken) => {
    try {
      await db.collection('user_tokens').doc(userId).set({
        tokens: firebase.firestore.FieldValue.arrayUnion(accessToken)
      }, { merge: true });
      console.log('Access token saved successfully');
    } catch (error) {
      console.error('Error saving access token:', error);
    }
  };

  return (
    <ErrorBoundary>
      <PlaidDataContext.Provider value={plaidData}>
        {props.children}
      </PlaidDataContext.Provider>
    </ErrorBoundary>
  );
};

export const usePlaid = () => {
  const context = useContext(PlaidDataContext);
  if (context === undefined) {
    throw new Error('usePlaid must be used within a PlaidDataProvider');
  }
  return context;
};
