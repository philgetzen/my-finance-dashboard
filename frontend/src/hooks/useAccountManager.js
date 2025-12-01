import { useMemo, useCallback } from 'react';
import { getAccountBalance, normalizeYNABAccountType } from '../utils/ynabHelpers';
import { getDisplayAccountType, isEffectivelyZero } from '../utils/formatters';

/**
 * Custom hook for managing account data with filtering and sorting
 */
export function useAccountManager(ynabAccounts = [], manualAccounts = []) {
  // Normalize and combine accounts
  const allAccounts = useMemo(() => {
    const normalizedYnab = ynabAccounts.map(account => {
      const balance = getAccountBalance(account);
      const displayType = getDisplayAccountType(account.type);

      // Check if account is explicitly closed (YNAB uses 'closed' boolean)
      const isExplicitlyClosed = account.closed === true || !!account.closed_on;

      // Auto-detect closed liability accounts with zero balance
      const isLiabilityType = ['Credit Card', 'Loan', 'Mortgage'].includes(displayType);
      const isZeroBalance = isEffectivelyZero(balance);
      const isLikelyClosedDebt = isLiabilityType && isZeroBalance && !isExplicitlyClosed;

      return {
        ...account,
        source: 'ynab',
        displayType,
        normalizedType: normalizeYNABAccountType(account.type),
        balance: isZeroBalance ? 0 : balance, // Normalize zero balances
        institutionName: account.note?.match(/Institution: (.+?)(?:\n|$)/)?.[1] ||
                         account.name.split(' ')[0] ||
                         'Unknown Institution',
        // Mark as closed if explicitly closed or likely closed debt
        closed_on: isExplicitlyClosed ? (account.closed_on || 'closed') : (isLikelyClosedDebt ? 'auto-detected' : null)
      };
    });

    const normalizedManual = manualAccounts.map(account => {
      const balance = getAccountBalance(account);
      const displayType = getDisplayAccountType(account.type);

      // Check if account is explicitly closed
      const isExplicitlyClosed = account.closed === true || !!account.closed_on;

      // Auto-detect closed liability accounts with zero balance
      const isLiabilityType = ['Credit Card', 'Loan', 'Mortgage'].includes(displayType);
      const isZeroBalance = isEffectivelyZero(balance);
      const isLikelyClosedDebt = isLiabilityType && isZeroBalance && !isExplicitlyClosed;

      return {
        ...account,
        source: 'manual',
        displayType,
        normalizedType: normalizeYNABAccountType(account.type),
        balance: isZeroBalance ? 0 : balance, // Normalize zero balances
        institutionName: account.institution ||
                         account.name.split(' ')[0] ||
                         'Manual Account',
        // Mark as closed if explicitly closed or likely closed debt
        closed_on: isExplicitlyClosed ? (account.closed_on || 'closed') : (isLikelyClosedDebt ? 'auto-detected' : null)
      };
    });

    return [...normalizedYnab, ...normalizedManual];
  }, [ynabAccounts, manualAccounts]);

  // Group accounts by type
  const accountsByType = useMemo(() => {
    const grouped = {};
    
    allAccounts.forEach(account => {
      const type = account.displayType;
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(account);
    });

    // Sort accounts within each type by institution then name
    Object.keys(grouped).forEach(type => {
      grouped[type].sort((a, b) => {
        const instCompare = a.institutionName.localeCompare(b.institutionName);
        if (instCompare !== 0) return instCompare;
        return a.name.localeCompare(b.name);
      });
    });

    return grouped;
  }, [allAccounts]);

  // Filter accounts
  const filterAccounts = useCallback((accounts, filters) => {
    return accounts.filter(account => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          account.name.toLowerCase().includes(searchLower) ||
          account.displayType.toLowerCase().includes(searchLower) ||
          account.institutionName.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Type filter
      if (filters.type && filters.type !== 'all') {
        if (account.displayType !== filters.type) return false;
      }

      // Active/closed filter
      if (filters.showActiveOnly && account.closed_on) return false;

      // Balance filter
      if (filters.hideZeroBalance && isEffectivelyZero(account.balance)) return false;

      return true;
    });
  }, []);

  // Sort accounts
  const sortAccounts = useCallback((accounts, sortBy) => {
    const sorted = [...accounts];
    
    switch (sortBy) {
      case 'institution':
        sorted.sort((a, b) => {
          const instCompare = a.institutionName.localeCompare(b.institutionName);
          if (instCompare !== 0) return instCompare;
          return a.name.localeCompare(b.name);
        });
        break;
      case 'balance':
        sorted.sort((a, b) => b.balance - a.balance);
        break;
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'type':
        sorted.sort((a, b) => {
          const typeCompare = a.displayType.localeCompare(b.displayType);
          if (typeCompare !== 0) return typeCompare;
          return a.name.localeCompare(b.name);
        });
        break;
      default:
        break;
    }
    
    return sorted;
  }, []);

  // Calculate totals
  const totals = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    let netWorth = 0;

    allAccounts.forEach(account => {
      if (account.closed_on) return;
      
      const balance = account.balance;
      if (['Credit Card', 'Loan', 'Mortgage'].includes(account.displayType)) {
        liabilities += Math.abs(balance);
      } else {
        assets += balance;
      }
    });

    netWorth = assets - liabilities;

    return { assets, liabilities, netWorth };
  }, [allAccounts]);

  return {
    allAccounts,
    accountsByType,
    filterAccounts,
    sortAccounts,
    totals
  };
}
