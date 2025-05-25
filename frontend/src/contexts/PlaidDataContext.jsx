import React, { createContext, useContext, useState, useEffect } from 'react';
import usePlaidData from '../hooks/usePlaidData.jsx';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { ErrorBoundary } from 'react-error-boundary';

const PlaidDataContext = createContext();

export const PlaidDataProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      try {
        setUser(currentUser);
      } catch (error) {
        console.error('Error in authentication state change:', error);
      }
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
    <ErrorBoundary fallback={<div className="p-4 text-red-600">Something went wrong with the app. Please refresh the page.</div>}>
      <PlaidDataContext.Provider value={{ ...plaidData, user, saveAccessToken }}>
        {children}
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