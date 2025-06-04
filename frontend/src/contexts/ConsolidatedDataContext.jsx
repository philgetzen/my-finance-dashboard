import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { useYNABData } from '../hooks/useYNABData';
import { ErrorBoundary } from 'react-error-boundary';

// Single consolidated context for all finance data
const FinanceDataContext = createContext();

// Privacy context remains separate for simplicity
export const PrivacyContext = createContext();

export const PrivacyProvider = ({ children }) => {
  const [privacyMode, setPrivacyMode] = useState(() => {
    try {
      const stored = localStorage.getItem('privacyMode');
      // Check if stored value is valid
      if (stored !== null && stored !== 'undefined' && stored !== '') {
        return stored === 'true';
      }
    } catch (e) {
      // If error, clear the invalid value
      localStorage.removeItem('privacyMode');
    }
    return false; // Default to privacy mode off
  });

  const value = useMemo(() => ({
    privacyMode,
    setPrivacyMode: (value) => {
      setPrivacyMode(value);
      localStorage.setItem('privacyMode', value);
    }
  }), [privacyMode]);

  return (
    <PrivacyContext.Provider value={value}>
      {children}
    </PrivacyContext.Provider>
  );
};

// Main consolidated data provider
export const FinanceDataProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ynabToken, setYnabToken] = useState(null);
  const [manualAccounts, setManualAccounts] = useState([]);
  const [showYNABErrorModal, setShowYNABErrorModal] = useState(false);
  const [ynabError, setYnabError] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const stored = localStorage.getItem('darkMode');
      // Check if stored value is valid
      if (stored !== null && stored !== 'undefined' && stored !== '') {
        return stored === 'true';
      }
    } catch (e) {
      // If parsing fails, clear the invalid value
      localStorage.removeItem('darkMode');
    }
    // Default to system preference
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Initialize dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = useCallback(() => {
    // Add transitioning class to prevent lag
    document.body.classList.add('theme-transitioning');
    
    setDarkMode(prev => {
      const newValue = !prev;
      localStorage.setItem('darkMode', String(newValue));
      
      // Remove transitioning class after a brief delay
      setTimeout(() => {
        document.body.classList.remove('theme-transitioning');
      }, 50);
      
      return newValue;
    });
  }, []);

  // Auth state management
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        setUser(currentUser);
        if (currentUser) {
          // Fetch YNAB token
          try {
            const tokenResponse = await fetch(
              `${import.meta.env.VITE_API_BASE_URL}/api/ynab/token?user_id=${currentUser.uid}`
            );
            
            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json();
              if (tokenData.access_token) {
                setYnabToken(tokenData.access_token);
              }
            }
          } catch (error) {
            console.error('Error fetching YNAB token:', error);
          }
          
          // Fetch manual accounts
          try {
            const accountsResponse = await fetch(
              `${import.meta.env.VITE_API_BASE_URL}/api/manual_accounts?user_id=${currentUser.uid}`
            );
            if (accountsResponse.ok) {
              const accountsData = await accountsResponse.json();
              setManualAccounts(accountsData.accounts || []);
            }
          } catch (error) {
            console.error('Error fetching manual accounts:', error);
          }
        } else {
          // Clear data on logout
          setYnabToken(null);
          setManualAccounts([]);
        }
      } catch (error) {
        console.error('Error in authentication state change:', error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Initialize YNAB data
  const ynabData = useYNABData('last-used', !!ynabToken && !loading, ynabToken);

  // Handle YNAB errors
  useEffect(() => {
    if (ynabData.isError && ynabData.error && ynabToken) {
      const errorMessage = ynabData.error?.message || '';
      const errorStatus = ynabData.error?.response?.status;
      
      if (errorStatus === 401 || errorStatus === 403 || 
          errorMessage.toLowerCase().includes('unauthorized') || 
          errorMessage.toLowerCase().includes('authentication failed')) {
        setYnabError(ynabData.error);
        setShowYNABErrorModal(true);
        setYnabToken(null);
      }
    }
  }, [ynabData.isError, ynabData.error, ynabToken]);

  // YNAB token management
  const saveYNABToken = useCallback(async (accessToken, refreshToken) => {
    if (!user) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/ynab/save_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.uid,
          access_token: accessToken,
          refresh_token: refreshToken
        })
      });
      
      if (response.ok) {
        setYnabToken(accessToken);
        console.log('YNAB token saved successfully');
      }
    } catch (error) {
      console.error('Error saving YNAB token:', error);
    }
  }, [user]);

  const disconnectYNAB = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/ynab/disconnect`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.uid })
      });
      
      if (response.ok) {
        setYnabToken(null);
        console.log('YNAB disconnected successfully');
      }
    } catch (error) {
      console.error('Error disconnecting YNAB:', error);
    }
  }, [user]);

  // Manual account management
  const createManualAccount = useCallback(async (account) => {
    if (!user) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/manual_accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.uid, account })
      });
      
      if (response.ok) {
        const newAccount = await response.json();
        setManualAccounts(prev => [...prev, newAccount]);
        return newAccount;
      }
    } catch (error) {
      console.error('Error creating manual account:', error);
    }
  }, [user]);

  const updateManualAccount = useCallback(async (accountId, account) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/manual_accounts/${accountId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account })
        }
      );
      
      if (response.ok) {
        const updatedAccount = await response.json();
        setManualAccounts(prev => 
          prev.map(acc => acc.id === accountId ? updatedAccount : acc)
        );
        return updatedAccount;
      }
    } catch (error) {
      console.error('Error updating manual account:', error);
    }
  }, []);

  const deleteManualAccount = useCallback(async (accountId) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/manual_accounts/${accountId}`,
        { method: 'DELETE' }
      );
      
      if (response.ok) {
        setManualAccounts(prev => prev.filter(acc => acc.id !== accountId));
      }
    } catch (error) {
      console.error('Error deleting manual account:', error);
    }
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    // Auth
    user,
    loading,
    
    // YNAB
    ynabToken,
    ...ynabData,
    saveYNABToken,
    disconnectYNAB,
    showYNABErrorModal,
    setShowYNABErrorModal,
    ynabError,
    
    // Manual accounts
    manualAccounts,
    createManualAccount,
    updateManualAccount,
    deleteManualAccount,
    
    // UI settings
    darkMode,
    toggleDarkMode
  }), [
    user,
    loading,
    ynabToken,
    ynabData,
    saveYNABToken,
    disconnectYNAB,
    showYNABErrorModal,
    ynabError,
    manualAccounts,
    createManualAccount,
    updateManualAccount,
    deleteManualAccount,
    darkMode,
    toggleDarkMode
  ]);

  return (
    <ErrorBoundary 
      fallback={
        <div className="p-4 text-red-600">
          Something went wrong with the app. Please refresh the page.
        </div>
      }
    >
      <FinanceDataContext.Provider value={value}>
        {children}
      </FinanceDataContext.Provider>
    </ErrorBoundary>
  );
};

// Export hooks for easy usage
export const useFinanceData = () => {
  const context = useContext(FinanceDataContext);
  if (context === undefined) {
    throw new Error('useFinanceData must be used within a FinanceDataProvider');
  }
  return context;
};

export const usePrivacy = () => {
  const context = useContext(PrivacyContext);
  if (context === undefined) {
    throw new Error('usePrivacy must be used within a PrivacyProvider');
  }
  return context;
};

// Backward compatibility exports
export const YNABDataProvider = FinanceDataProvider;
export const useYNAB = useFinanceData;
