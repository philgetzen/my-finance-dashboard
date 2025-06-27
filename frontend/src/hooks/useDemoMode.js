import { useCallback } from 'react';
import { useFinanceData } from '../contexts/ConsolidatedDataContext';

/**
 * Custom hook for demo mode functionality
 * Provides a clean API for components to interact with demo mode
 */
export const useDemoMode = () => {
  const { 
    isDemoMode, 
    initializeDemoMode, 
    exitDemoMode,
    user,
    accounts,
    manualAccounts,
    transactions,
    accountSummary
  } = useFinanceData();

  // Check if a feature is available in demo mode
  const isFeatureEnabled = useCallback((featureName) => {
    const disabledFeatures = [
      'create_account',
      'edit_account', 
      'delete_account',
      'ynab_connect',
      'ynab_disconnect',
      'data_export',
      'settings_save'
    ];
    
    if (!isDemoMode) return true;
    return !disabledFeatures.includes(featureName);
  }, [isDemoMode]);

  // Get disabled feature message
  const getDisabledMessage = useCallback((featureName) => {
    const messages = {
      'create_account': 'Account creation is disabled in demo mode. Sign up to create your own accounts.',
      'edit_account': 'Account editing is disabled in demo mode. Sign up to manage your accounts.',
      'delete_account': 'Account deletion is disabled in demo mode. Sign up to manage your accounts.',
      'ynab_connect': 'YNAB connection is disabled in demo mode. Sign up to connect your real budget.',
      'ynab_disconnect': 'YNAB disconnection is disabled in demo mode.',
      'data_export': 'Data export is disabled in demo mode. Sign up to export your financial data.',
      'settings_save': 'Settings cannot be saved in demo mode. Sign up to customize your preferences.'
    };
    
    return messages[featureName] || 'This feature is disabled in demo mode. Sign up to access all features.';
  }, []);

  // Activate demo mode
  const startDemo = useCallback(() => {
    initializeDemoMode();
  }, [initializeDemoMode]);

  // Exit demo mode and return to auth page
  const endDemo = useCallback(() => {
    exitDemoMode();
  }, [exitDemoMode]);

  // Get demo data summary
  const getDemoSummary = useCallback(() => {
    if (!isDemoMode) return null;
    
    return {
      totalAccounts: accounts.length + manualAccounts.length,
      totalTransactions: transactions.length,
      netWorth: accountSummary?.netWorth || 0,
      totalAssets: accountSummary?.totalAssets || 0,
      totalLiabilities: accountSummary?.totalLiabilities || 0
    };
  }, [isDemoMode, accounts, manualAccounts, transactions, accountSummary]);

  // Check if user is demo user
  const isDemoUser = useCallback(() => {
    return isDemoMode && user?.isDemoMode === true;
  }, [isDemoMode, user]);

  // Get demo mode status info
  const getDemoStatus = useCallback(() => {
    return {
      isActive: isDemoMode,
      isDemoUser: isDemoUser(),
      hasRealData: !isDemoMode && !!user,
      canUpgrade: isDemoMode
    };
  }, [isDemoMode, isDemoUser, user]);

  return {
    // State
    isDemoMode,
    isDemoUser: isDemoUser(),
    
    // Controls
    startDemo,
    endDemo,
    
    // Feature checks
    isFeatureEnabled,
    getDisabledMessage,
    
    // Data
    getDemoSummary,
    getDemoStatus,
    
    // Convenience getters
    accounts,
    manualAccounts,
    transactions,
    accountSummary
  };
};

export default useDemoMode;