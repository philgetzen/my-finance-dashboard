import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { useYNABData } from '../hooks/useYNABData';
import { ErrorBoundary } from 'react-error-boundary';
import { 
  mockUser, 
  mockAccounts, 
  mockManualAccounts, 
  mockTransactions, 
  mockAccountSummary, 
  mockYNABData 
} from '../lib/mockData';

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
  const [ynabRefreshToken, setYnabRefreshToken] = useState(null);
  const [manualAccounts, setManualAccounts] = useState([]);
  const [showYNABErrorModal, setShowYNABErrorModal] = useState(false);
  const [ynabError, setYnabError] = useState(null);
  const [isAutoConnectingYNAB, setIsAutoConnectingYNAB] = useState(false);
  const [autoConnectMessage, setAutoConnectMessage] = useState(null);
  const [hasAutoConnected, setHasAutoConnected] = useState(false);
  
  // Demo mode state
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoData, setDemoData] = useState({
    accounts: [],
    manualAccounts: [],
    transactions: [],
    accountSummary: null,
    ynabData: null
  });
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

  // Demo mode cleanup on page unload/navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isDemoMode) {
        try {
          sessionStorage.removeItem('demoModeActive');
          sessionStorage.removeItem('demoStartTime');
        } catch (error) {
          console.warn('Failed to clear demo session on unload:', error);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && isDemoMode) {
        // Page is being hidden, potentially closing
        try {
          sessionStorage.setItem('demoModeHidden', Date.now().toString());
        } catch (error) {
          console.warn('Failed to track demo visibility change:', error);
        }
      }
    };

    // Check for existing demo session on mount
    const checkExistingDemoSession = () => {
      try {
        const demoActive = sessionStorage.getItem('demoModeActive') === 'true';
        const demoStartTime = sessionStorage.getItem('demoStartTime');
        
        if (demoActive && demoStartTime) {
          const sessionAge = Date.now() - parseInt(demoStartTime);
          const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours
          
          if (sessionAge < maxSessionAge) {
            // Resume demo session
            initializeDemoMode();
          } else {
            // Session expired, clear storage
            sessionStorage.removeItem('demoModeActive');
            sessionStorage.removeItem('demoStartTime');
          }
        }
      } catch (error) {
        console.warn('Failed to check existing demo session:', error);
      }
    };

    // Only check for existing session if not already in demo mode
    if (!isDemoMode && !user) {
      checkExistingDemoSession();
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isDemoMode, user]);

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

  // Demo mode management functions (defined early to avoid circular dependencies)
  const initializeDemoMode = useCallback(() => {
    setIsDemoMode(true);
    setUser(mockUser);
    setDemoData({
      accounts: mockAccounts,
      manualAccounts: mockManualAccounts,
      transactions: mockTransactions,
      accountSummary: mockAccountSummary,
      ynabData: mockYNABData
    });
    setLoading(false);
    
    // Track demo session in sessionStorage
    try {
      sessionStorage.setItem('demoModeActive', 'true');
      sessionStorage.setItem('demoStartTime', Date.now().toString());
    } catch (error) {
      console.warn('Failed to set demo session storage:', error);
    }
  }, []);

  const exitDemoMode = useCallback(() => {
    setIsDemoMode(false);
    // Don't set user to null - let Firebase auth handle authentication state
    setDemoData({
      accounts: [],
      manualAccounts: [],
      transactions: [],
      accountSummary: null,
      ynabData: null
    });
    // Don't clear real user's YNAB token and manual accounts
    // setYnabToken(null);
    // setManualAccounts([]);
    setLoading(true);
    
    // Clear any demo-related session storage
    try {
      sessionStorage.removeItem('demoModeActive');
      sessionStorage.removeItem('demoStartTime');
    } catch (error) {
      console.warn('Failed to clear demo session storage:', error);
    }
  }, []);

  // Auth state management
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        setUser(currentUser);
        if (currentUser) {
          // Fetch YNAB token and manual accounts in parallel for faster load
          setIsAutoConnectingYNAB(true);

          const [tokenResult, accountsResult] = await Promise.allSettled([
            fetch(`${import.meta.env.VITE_API_BASE_URL}/api/ynab/token?user_id=${currentUser.uid}`),
            fetch(`${import.meta.env.VITE_API_BASE_URL}/api/manual_accounts?user_id=${currentUser.uid}`)
          ]);

          // Handle YNAB token response
          if (tokenResult.status === 'fulfilled' && tokenResult.value.ok) {
            try {
              const tokenData = await tokenResult.value.json();
              if (tokenData.access_token) {
                setAutoConnectMessage('Found existing YNAB connection!');
                console.log('Auto-connecting with existing YNAB token');
                setYnabToken(tokenData.access_token);
                setYnabRefreshToken(tokenData.refresh_token || null);
                setHasAutoConnected(true);
              } else {
                setAutoConnectMessage(null);
                setHasAutoConnected(false);
              }
            } catch (error) {
              console.error('Error parsing YNAB token response:', error);
              setAutoConnectMessage(null);
              setHasAutoConnected(false);
            }
          } else {
            if (tokenResult.status === 'rejected') {
              console.error('Error fetching YNAB token:', tokenResult.reason);
            }
            setAutoConnectMessage(null);
            setHasAutoConnected(false);
          }
          setIsAutoConnectingYNAB(false);

          // Handle manual accounts response
          if (accountsResult.status === 'fulfilled' && accountsResult.value.ok) {
            try {
              const accountsData = await accountsResult.value.json();
              setManualAccounts(accountsData.accounts || []);
            } catch (error) {
              console.error('Error parsing manual accounts response:', error);
            }
          } else if (accountsResult.status === 'rejected') {
            console.error('Error fetching manual accounts:', accountsResult.reason);
          }
        } else {
          // Clear data on logout
          setYnabToken(null);
          setYnabRefreshToken(null);
          setManualAccounts([]);
          setAutoConnectMessage(null);
          setIsAutoConnectingYNAB(false);
          setHasAutoConnected(false);
        }
      } catch (error) {
        console.error('Error in authentication state change:', error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Initialize YNAB data with refresh token support
  const ynabData = useYNABData('last-used', !!ynabToken && !loading, ynabToken, ynabRefreshToken, user?.uid);

  // Listen for token refresh events from the YNAB service
  useEffect(() => {
    const handleTokenRefreshed = (event) => {
      const { accessToken, refreshToken } = event.detail;
      console.log('YNAB tokens refreshed by service');
      setYnabToken(accessToken);
      setYnabRefreshToken(refreshToken);
    };

    window.addEventListener('ynab-token-refreshed', handleTokenRefreshed);
    return () => window.removeEventListener('ynab-token-refreshed', handleTokenRefreshed);
  }, []);

  // Handle YNAB errors
  useEffect(() => {
    if (ynabData.isError && ynabData.error && ynabToken) {
      const errorMessage = ynabData.error?.message || '';
      const errorStatus = ynabData.error?.response?.status;
      
      if (errorStatus === 401 || errorStatus === 403 || 
          errorMessage.toLowerCase().includes('unauthorized') || 
          errorMessage.toLowerCase().includes('authentication failed')) {
        
        console.log('YNAB access token cleared due to 401 error');
        setYnabToken(null);
        
        // Clear auto-connect message when token becomes invalid
        setAutoConnectMessage(null);
        setIsAutoConnectingYNAB(false);
        setHasAutoConnected(false);
        
        // Only show error modal if this wasn't during initial token validation
        // We check if user has been loaded and app is not in initial loading state
        if (!loading && user) {
          setYnabError(ynabData.error);
          setShowYNABErrorModal(true);
        }
      }
    }
  }, [ynabData.isError, ynabData.error, ynabToken, loading, user]);

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
        setYnabRefreshToken(refreshToken || null);
        console.log('YNAB token saved successfully (with refresh token)');
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
        setYnabRefreshToken(null);
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

  // Get current data based on demo mode
  const getCurrentAccounts = useCallback(() => {
    return isDemoMode ? demoData.accounts : [];
  }, [isDemoMode, demoData.accounts]);

  const getCurrentManualAccounts = useCallback(() => {
    return isDemoMode ? demoData.manualAccounts : manualAccounts;
  }, [isDemoMode, demoData.manualAccounts, manualAccounts]);

  const getCurrentTransactions = useCallback(() => {
    return isDemoMode ? demoData.transactions : [];
  }, [isDemoMode, demoData.transactions]);

  const getCurrentYNABData = useCallback(() => {
    return isDemoMode ? demoData.ynabData : ynabData;
  }, [isDemoMode, demoData.ynabData, ynabData]);

  const getCurrentAccountSummary = useCallback(() => {
    return isDemoMode ? demoData.accountSummary : null;
  }, [isDemoMode, demoData.accountSummary]);

  // Logout function
  const logout = useCallback(async () => {
    try {
      // Exit demo mode if active
      if (isDemoMode) {
        exitDemoMode();
      }
      
      // Disconnect YNAB first (if connected)
      if (ynabToken && !isDemoMode) {
        await disconnectYNAB();
      }
      
      // Sign out from Google/Firebase auth
      await auth.signOut();

      // Clear any remaining state
      setYnabToken(null);
      setYnabRefreshToken(null);
      setManualAccounts([]);
      setYnabError(null);
      setShowYNABErrorModal(false);
      setIsAutoConnectingYNAB(false);
      setAutoConnectMessage(null);
      setHasAutoConnected(false);
      
      console.log('Successfully logged out');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }, [ynabToken, isDemoMode, disconnectYNAB, exitDemoMode]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    // Auth
    user,
    loading,
    logout,
    
    // Demo mode
    isDemoMode,
    initializeDemoMode,
    exitDemoMode,
    
    // Data getters (context-aware)
    accounts: getCurrentAccounts(),
    manualAccounts: getCurrentManualAccounts(),
    transactions: getCurrentTransactions(),
    accountSummary: getCurrentAccountSummary(),
    
    // YNAB (in demo mode, uses mock data)
    ynabToken: isDemoMode ? null : ynabToken,
    ...(isDemoMode ? demoData.ynabData : ynabData),
    saveYNABToken: isDemoMode ? 
      () => { console.log('YNAB operations disabled in demo mode'); return Promise.resolve(); } : 
      saveYNABToken,
    disconnectYNAB: isDemoMode ? 
      () => { console.log('YNAB operations disabled in demo mode'); return Promise.resolve(); } : 
      disconnectYNAB,
    showYNABErrorModal,
    setShowYNABErrorModal,
    ynabError,
    
    // Auto-connect state
    isAutoConnectingYNAB,
    autoConnectMessage,
    hasAutoConnected,
    
    // Manual accounts (disabled in demo mode)
    createManualAccount: isDemoMode ? 
      () => { console.log('Account creation disabled in demo mode'); return Promise.resolve(); } : 
      createManualAccount,
    updateManualAccount: isDemoMode ? 
      () => { console.log('Account editing disabled in demo mode'); return Promise.resolve(); } : 
      updateManualAccount,
    deleteManualAccount: isDemoMode ? 
      () => { console.log('Account deletion disabled in demo mode'); return Promise.resolve(); } : 
      deleteManualAccount,
    
    // UI settings
    darkMode,
    toggleDarkMode
  }), [
    user,
    loading,
    logout,
    isDemoMode,
    initializeDemoMode,
    exitDemoMode,
    getCurrentAccounts,
    getCurrentManualAccounts,
    getCurrentTransactions,
    getCurrentAccountSummary,
    demoData,
    ynabToken,
    ynabData,
    saveYNABToken,
    disconnectYNAB,
    showYNABErrorModal,
    ynabError,
    isAutoConnectingYNAB,
    autoConnectMessage,
    hasAutoConnected,
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
