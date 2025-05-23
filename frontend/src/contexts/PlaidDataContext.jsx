import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePlaidData } from '../hooks/usePlaidData.jsx';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { ErrorBoundary } from 'react-error-boundary';

const PlaidDataContext = createContext();

export const PlaidDataProvider = (props) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const plaidData = usePlaidData(user);

  const saveAccessToken = async (userId, accessToken) => {
    try {
      const userTokensRef = doc(db, 'user_tokens', userId);
      await setDoc(
        userTokensRef,
        { tokens: arrayUnion(accessToken) },
        { merge: true }
      );
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