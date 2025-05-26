import React, { createContext, useContext, useState, useEffect } from 'react';

const PrivacyContext = createContext();

export const usePrivacy = () => {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error('usePrivacy must be used within a PrivacyProvider');
  }
  return context;
};

export const PrivacyProvider = ({ children }) => {
  const [privacyMode, setPrivacyMode] = useState(false);

  useEffect(() => {
    // Check for saved privacy mode preference
    const savedMode = localStorage.getItem('privacyMode');
    if (savedMode !== null) {
      setPrivacyMode(JSON.parse(savedMode));
    }
  }, []);

  useEffect(() => {
    // Save preference
    localStorage.setItem('privacyMode', JSON.stringify(privacyMode));
  }, [privacyMode]);

  return (
    <PrivacyContext.Provider value={{ privacyMode, setPrivacyMode }}>
      {children}
    </PrivacyContext.Provider>
  );
};
