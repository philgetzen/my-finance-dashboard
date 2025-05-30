// Utility functions for account formatting and type mapping

// Account type mapping functions
export const mapAccountType = (type) => {
  const typeMap = {
    'otherAsset': 'investment',
    'creditCard': 'credit',
    'otherLiability': 'loan',
    'checking': 'checking',
    'savings': 'savings',
    'mortgage': 'mortgage',
    'cash': 'cash'
  };
  return typeMap[type] || type;
};

export const getDisplayAccountType = (type) => {
  const displayMap = {
    'investment': 'Investment',
    'credit': 'Credit Card', 
    'loan': 'Loan',
    'checking': 'Checking',
    'savings': 'Savings',
    'mortgage': 'Mortgage',
    'cash': 'Cash'
  };
  return displayMap[mapAccountType(type)] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Other');
};

// Currency formatting with privacy support
export const formatCurrency = (amount, isPrivacyMode = false) => {
  if (isPrivacyMode) return '***';
  return Math.abs(amount || 0).toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

// Percentage formatting
export const formatPercent = (value) => {
  return `${value.toFixed(1)}%`;
};

// Check if account is a liability
export const isLiability = (account) => {
  const type = mapAccountType(account.type);
  return ['credit', 'loan', 'mortgage'].includes(type);
};

// Get account icon mapping
import {
  BanknotesIcon,
  CreditCardIcon,
  BuildingLibraryIcon,
  CurrencyDollarIcon,
  HomeIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';

export const getAccountIcon = (type) => {
  const iconMap = {
    'investment': BanknotesIcon,
    'credit': CreditCardIcon,
    'loan': TruckIcon,
    'checking': BuildingLibraryIcon,
    'savings': CurrencyDollarIcon,
    'mortgage': HomeIcon,
    'cash': CurrencyDollarIcon
  };
  return iconMap[mapAccountType(type)] || CreditCardIcon;
};

// Sort accounts by institution and name
export const sortAccountsByInstitution = (accounts) => {
  return accounts.sort((a, b) => {
    if (a.institution === b.institution) {
      return a.name.localeCompare(b.name);
    }
    return a.institution.localeCompare(b.institution);
  });
};

// Group accounts by type
export const groupAccountsByType = (accounts, includeSource = false) => {
  return accounts.reduce((groups, account) => {
    const type = mapAccountType(account.type);
    let key = type;
    
    if (includeSource) {
      // Determine source - you may need to adjust this logic based on your data structure
      const source = account.source || (account.id && account.id.toString().startsWith('m') ? 'Manual' : 'YNAB');
      key = `${type}-${source}`;
      
      if (!groups[key]) {
        groups[key] = {
          type,
          source,
          displayName: `${getDisplayAccountType(account.type)} (${source})`,
          accounts: []
        };
      }
    } else {
      if (!groups[key]) {
        groups[key] = {
          type,
          displayName: getDisplayAccountType(account.type),
          accounts: []
        };
      }
    }
    
    groups[key].accounts.push(account);
    return groups;
  }, {});
};