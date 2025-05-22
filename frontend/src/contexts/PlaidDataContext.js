import React, { createContext, useContext, useState, useEffect } from 'react';
import usePlaidData from '../hooks/usePlaidData';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

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

  return (
    <PlaidDataContext.Provider value={plaidData}>
      {props.children}
    </PlaidDataContext.Provider>
  );
};

export const usePlaid = () => {
  const context = useContext(PlaidDataContext);
  if (context === undefined) {
    throw new Error('usePlaid must be used within a PlaidDataProvider');
  }
  return context;
};
