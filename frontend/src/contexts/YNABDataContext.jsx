import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { useYNABData } from '../hooks/useYNABData';
import { ErrorBoundary } from 'react-error-boundary';

const YNABDataContext = createContext();

// Privacy context for global privacy mode
export const PrivacyContext = createContext();

export const PrivacyProvider = ({ children }) => {
  const [isPrivacyMode, setIsPrivacyMode] = useState(() => {
    // Initialize from localStorage
    const stored = localStorage.getItem('privacyMode');
    return stored === 'true';
  });

  const togglePrivacyMode = () => {
    setIsPrivacyMode(prev => {
      const newValue = !prev;
      localStorage.setItem('privacyMode', newValue);
      return newValue;
    });
  };

  return (
    <PrivacyContext.Provider value={{ isPrivacyMode, togglePrivacyMode }}>
      {children}
    </PrivacyContext.Provider>
  );
};

export const YNABDataProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ynabToken, setYnabToken] = useState(null);
  const [manualAccounts, setManualAccounts] = useState([]);
  const [showYNABErrorModal, setShowYNABErrorModal] = useState(false);
  const [ynabError, setYnabError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        setUser(currentUser);
        if (currentUser) {
          // Fetch YNAB token
          const tokenResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/ynab/token?user_id=${currentUser.uid}`);
          
          if (!tokenResponse.ok) {
            console.error('Token fetch failed:', tokenResponse.status, tokenResponse.statusText);
            console.error('Response URL:', tokenResponse.url);
            const errorText = await tokenResponse.text();
            console.error('Error response body:', errorText);
            
            // If it's a 404, the backend might not have the YNAB endpoints yet
            if (tokenResponse.status === 404) {
              console.warn('YNAB endpoints not found on backend. Backend may need to be updated and redeployed.');
            }
            return;
          }
          
          const tokenData = await tokenResponse.json();
          if (tokenData.access_token) {
            setYnabToken(tokenData.access_token);
          }
          
          // Fetch manual accounts
          const accountsResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/manual_accounts?user_id=${currentUser.uid}`);
          const accountsData = await accountsResponse.json();
          setManualAccounts(accountsData.accounts || []);
        }
      } catch (error) {
        console.error('Error in authentication state change:', error);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Initialize YNAB data - only when we have a token
  const ynabData = useYNABData('last-used', !!ynabToken && !loading, ynabToken);
  
  // Handle YNAB errors
  useEffect(() => {
    const handleAuthFailure = () => {
      console.warn('Authentication failure detected in YNABDataContext. Clearing YNAB token.');
      setYnabToken(null);
      // Optionally, you might want to set an error message here too if not already handled
      // setYnabError(new Error('YNAB authentication failed. Please reconnect.'));
      // setShowYNABErrorModal(true);
    };

    if (ynabData.isError && ynabData.error && ynabToken) {
      const errorMessage = ynabData.error?.message || '';
      // Attempt to get status from a potential error object structure if ynabData.error is not a direct response
      const errorStatus = ynabData.error?.response?.status || (ynabData.error?.name === 'Error' && errorMessage.includes('authentication failed') ? 401 : null);
      
      // Check for authentication errors or expired tokens
      if (errorStatus === 401 || errorStatus === 403 || 
          errorMessage.toLowerCase().includes('unauthorized') || 
          errorMessage.toLowerCase().includes('authentication failed')) {
        setYnabError(ynabData.error);
        setShowYNABErrorModal(true);
        handleAuthFailure(); // Clear token on detected error
      }
    }

    // Listen for global auth failure events
    window.addEventListener('ynab-auth-failure', handleAuthFailure);

    return () => {
      window.removeEventListener('ynab-auth-failure', handleAuthFailure);
    };
  }, [ynabData.isError, ynabData.error, ynabToken]);

  // Helper function to save YNAB token
  const saveYNABToken = async (accessToken, refreshToken) => {
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
        
        // Force a small delay to ensure the token state is updated
        setTimeout(() => {
          console.log('Triggering data refresh after token save');
        }, 100);
      }
    } catch (error) {
      console.error('Error saving YNAB token:', error);
    }
  };

  // Helper function to disconnect YNAB
  const disconnectYNAB = async () => {
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
  };

  // Manual account functions
  const createManualAccount = async (account) => {
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
  };

  const updateManualAccount = async (accountId, account) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/manual_accounts/${accountId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account })
      });
      
      if (response.ok) {
        const updatedAccount = await response.json();
        setManualAccounts(prev => prev.map(acc => acc.id === accountId ? updatedAccount : acc));
        return updatedAccount;
      }
    } catch (error) {
      console.error('Error updating manual account:', error);
    }
  };

  const deleteManualAccount = async (accountId) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/manual_accounts/${accountId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setManualAccounts(prev => prev.filter(acc => acc.id !== accountId));
      }
    } catch (error) {
      console.error('Error deleting manual account:', error);
    }
  };

  return (
    <ErrorBoundary fallback={<div className="p-4 text-red-600">Something went wrong with the app. Please refresh the page.</div>}>
      <YNABDataContext.Provider value={{
        user,
        loading,
        ynabToken,
        ...ynabData,
        manualAccounts,
        saveYNABToken,
        disconnectYNAB,
        createManualAccount,
        updateManualAccount,
        deleteManualAccount,
        showYNABErrorModal,
        setShowYNABErrorModal,
        ynabError
      }}>
        {children}
      </YNABDataContext.Provider>
    </ErrorBoundary>
  );
};

export const useYNAB = () => {
  const context = useContext(YNABDataContext);
  if (context === undefined) {
    throw new Error('useYNAB must be used within a YNABDataProvider');
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
