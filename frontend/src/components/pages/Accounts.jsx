import React, { useState } from 'react';
import { useYNAB, usePrivacy } from '../../contexts/YNABDataContext';
import { getAccountBalance, normalizeYNABAccountType } from '../../utils/ynabHelpers';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ManualAccountModal from '../ui/ManualAccountModal';
import EditManualAccountModal from '../ui/EditManualAccountModal';
import { AccountsSkeleton } from '../ui/Skeleton';
import PageTransition from '../ui/PageTransition';
import {
  BanknotesIcon,
  CreditCardIcon,
  BuildingLibraryIcon,
  ChartBarIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

// Account Row component for table display
const AccountRow = ({ account, isManual, isClosed, onEdit, onDelete, deleteConfirm, isPrivacyMode }) => {
  const getAccountTypeIcon = (type) => {
    const normalizedType = normalizeYNABAccountType(type);
    switch (normalizedType) {
      case 'credit':
      case 'creditCard':
        return <CreditCardIcon className="h-3.5 w-3.5" />; // Slightly larger for table clarity
      case 'loan':
      case 'mortgage':
        return <BuildingLibraryIcon className="h-3.5 w-3.5" />;
      case 'investment':
      case 'otherAsset':
        return <ChartBarIcon className="h-3.5 w-3.5" />;
      default:
        return <BanknotesIcon className="h-3.5 w-3.5" />;
    }
  };

  const getAccountTypeColor = (type) => {
    const normalizedType = normalizeYNABAccountType(type);
    switch (normalizedType) {
      case 'credit':
      case 'creditCard':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20';
      case 'loan':
      case 'mortgage':
        return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/20';
      case 'investment':
      case 'otherAsset':
        return 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/20';
      default:
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20';
    }
  };

  const getDisplayAccountType = (type) => {
    const normalizedType = normalizeYNABAccountType(type);
    switch (normalizedType) {
      case 'investment': return 'Investment';
      case 'credit': return 'Credit Card';
      case 'checking': return 'Checking';
      case 'savings': return 'Savings';
      case 'loan': return 'Loan';
      case 'mortgage': return 'Mortgage';
      default: return type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Other';
    }
  };

  const extractInstitution = (accountName) => {
    if (!accountName) return 'Unknown';
    const patterns = [
      /^(\w+)\s+/,
      /^(.+?)\s+(Checking|Savings|Credit|Card|Account)/i,
    ];
    
    for (const pattern of patterns) {
      const match = accountName.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    const firstWord = accountName.split(' ')[0];
    return firstWord.length > 2 ? firstWord : accountName;
  };

  const formatCurrency = (amount) => {
    return `${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <tr className={`border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 ${isClosed ? 'opacity-60' : ''}`}>
      <td className="px-2 py-2 whitespace-nowrap"> {/* Increased py slightly for table row height */}
        <div className={`p-1 rounded ${getAccountTypeColor(account.type)} ${isClosed ? 'opacity-50' : ''} inline-flex items-center justify-center`}>
          {React.cloneElement(getAccountTypeIcon(account.type), { className: 'h-3 w-3' })}
        </div>
      </td>
      <td className="px-2 py-2 whitespace-nowrap"> {/* min-w/max-w removed, width controlled by colgroup */}
        <div className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate leading-tight">{account.name}</div>
        {/* <div className="text-2xs text-gray-500 dark:text-gray-400 truncate leading-tight">{extractInstitution(account.name)}</div> Removed institution name */}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-gray-800 dark:text-gray-100 leading-tight">{getDisplayAccountType(account.type)}</td>
      <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-gray-800 dark:text-gray-100 leading-tight">
        {account.source || (account.account_id ? 'YNAB' : 'Manual')} {/* Fallback if source is missing */}
        {isClosed && <span className="ml-1">(Closed)</span>} {/* Keep (Closed) text small */}
      </td>
      <td className={`px-2 py-2 whitespace-nowrap text-xs font-medium text-gray-800 dark:text-gray-100 text-right leading-tight ${isPrivacyMode ? 'filter blur-sm' : ''}`}>
        ${formatCurrency(getAccountBalance(account))}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-right">
        {isManual && !isClosed && ( // isManual prop should be correctly set based on account.source
          <div className="flex gap-1 justify-end">
            <button
              onClick={() => onEdit(account)}
              className="p-1 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-md transition-colors"
              title="Edit account"
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(account.id)}
              className={`p-1 rounded-md transition-colors ${
                deleteConfirm === account.id
                  ? 'text-white bg-red-600 hover:bg-red-700'
                  : 'text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30'
              }`}
              title={deleteConfirm === account.id ? 'Tap again to confirm' : 'Delete account'}
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
};

const AccountGroup = ({ title, accounts, onEdit, onDelete, deleteConfirm, isPrivacyMode }) => {
  if (!accounts || accounts.length === 0) return null;

  return (
    <Card className="p-0 sm:p-0"> {/* Reduced padding for Card containing table */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700"> {/* Header for group */}
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
          {title}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
          {accounts[0]?.source && ` from ${accounts[0].source}`}
        </p> {/* Removed extra closing p tag */}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed">{/* NO WHITESPACE */}
          <colgroup>{/* NO WHITESPACE */}
            <col className="w-10 sm:w-12" />{/* Icon */}
            <col className="w-2/5 sm:w-1/3" />{/* Name */}
            <col className="w-1/5 sm:w-24" />{/* Type */}
            <col className="w-1/5 sm:w-20" />{/* Source */}
            <col className="w-1/4 sm:w-28" />{/* Balance */}
            <col className="w-16 sm:w-20" />{/* Actions */}
          </colgroup>{/* NO WHITESPACE */}
          <tbody className="bg-white dark:bg-gray-800">
            {accounts.map((account) => (
              <AccountRow
                key={account.id || account.account_id} // Use YNAB's id if present, else manual id
                account={account}
                isManual={account.source === 'Manual'} // Determine if manual based on the source prop
                isClosed={!!account.closed}
                onEdit={onEdit}
                onDelete={onDelete}
                deleteConfirm={deleteConfirm}
                isPrivacyMode={isPrivacyMode}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};


export default function Accounts() {
  const {
    user,
    accounts: ynabAccounts,
    manualAccounts,
    isLoading,
    error,
    deleteManualAccount,
    ynabToken,
    refetch
  } = useYNAB();
  const { isPrivacyMode } = usePrivacy();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  // const [showAllYnab, setShowAllYnab] = useState(false); // Not used with table view per group
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('type'); // Default sort by type
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  // const [isMobile, setIsMobile] = useState(window.innerWidth < 768); // Not strictly needed for table logic
  
  // React.useEffect(() => {
  //   const handleResize = () => setIsMobile(window.innerWidth < 768);
  //   window.addEventListener('resize', handleResize);
  //   return () => window.removeEventListener('resize', handleResize);
  // }, []);
  
  const ynabConnected = !!ynabToken;
  const allAccounts = [...(ynabAccounts || []), ...(manualAccounts || [])];
  const isError = !!error;

  const handleEditAccount = (account) => {
    setEditingAccount(account);
    setShowEditModal(true);
  };

  const handleDeleteAccount = async (accountId) => {
    if (deleteConfirm === accountId) {
      try {
        await deleteManualAccount(accountId);
        setDeleteConfirm(null);
      } catch (err) { // Changed error variable name
        console.error('Failed to delete account:', err);
      }
    } else {
      setDeleteConfirm(accountId);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const normalizeAccountType = (type) => {
    return normalizeYNABAccountType(type);
  };

  const getDisplayAccountType = (type) => {
    const normalizedType = normalizeAccountType(type);
    switch (normalizedType) {
      case 'investment': return 'Investment';
      case 'credit': return 'Credit Card';
      case 'checking': return 'Checking';
      case 'savings': return 'Savings';
      case 'loan': return 'Loan';
      case 'mortgage': return 'Mortgage';
      default: return type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Other';
    }
  };

  const extractInstitution = (accountName) => {
    if (!accountName) return 'Unknown';
    const patterns = [
      /^(\w+)\s+/,
      /^(.+?)\s+(Checking|Savings|Credit|Card|Account)/i,
    ];
    
    for (const pattern of patterns) {
      const match = accountName.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    const firstWord = accountName.split(' ')[0];
    return firstWord.length > 2 ? firstWord : accountName;
  };

  const getAccountTypeSortOrder = (type) => {
    const normalizedType = normalizeAccountType(type);
    switch (normalizedType) {
      case 'checking': case 'savings': return 1; // Cash
      case 'investment': case 'otherAsset': return 2; // Investments
      case 'credit': case 'creditCard': return 3; // Credit
      case 'loan': case 'mortgage': return 4; // Loans/Mortgages
      default: return 5; // Other
    }
  };

  const sortAccounts = (accounts, currentSortBy, currentSearchTerm = '') => {
    let filtered = [...accounts]; // Create a copy to avoid mutating original
    
    if (currentSearchTerm) {
      const term = currentSearchTerm.toLowerCase();
      filtered = filtered.filter(account => 
        account.name?.toLowerCase().includes(term) ||
        getDisplayAccountType(account.type).toLowerCase().includes(term) ||
        extractInstitution(account.name).toLowerCase().includes(term)
      );
    }
    
    return filtered.sort((a, b) => {
      switch (currentSortBy) {
        case 'institution':
          const instA = extractInstitution(a.name);
          const instB = extractInstitution(b.name);
          if (instA.localeCompare(instB) !== 0) {
            return instA.localeCompare(instB);
          }
          return (a.name || '').localeCompare(b.name || '');
        case 'balance':
          return getAccountBalance(b) - getAccountBalance(a);
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'type':
          const orderA = getAccountTypeSortOrder(a.type);
          const orderB = getAccountTypeSortOrder(b.type);
          if (orderA !== orderB) return orderA - orderB;
          return (a.name || '').localeCompare(b.name || '');
        default:
          return 0;
      }
    });
  };

  const filterAccountsByType = (accounts, currentFilterType) => {
    if (currentFilterType === 'all') return accounts; // Return original array if 'all'
    return accounts.filter(account => {
      const normalizedType = normalizeAccountType(account.type);
      return normalizedType === currentFilterType;
    });
  };
  
  if (isLoading) {
    return <PageTransition><AccountsSkeleton /></PageTransition>;
  }

  const processedAccountGroups = () => {
    const groups = {
      cash: { title: 'Cash', accounts: [], order: 1 },
      investments: { title: 'Investments', accounts: [], order: 2 },
      credit: { title: 'Credit Cards', accounts: [], order: 3 },
      loans: { title: 'Loans & Mortgages', accounts: [], order: 4 },
      other: { title: 'Other Accounts', accounts: [], order: 5 },
      closed: { title: 'Closed Accounts', accounts: [], order: 6 }, // Separate group for closed
    };

    const activeYnabAccounts = ynabAccounts?.filter(acc => !acc.closed) || [];
    const closedYnabAccounts = ynabAccounts?.filter(acc => acc.closed) || [];
    // Assuming manual accounts cannot be 'closed' in the same way, or handle if they can.

    const assignToGroup = (account, source) => {
      if (account.closed) {
        groups.closed.accounts.push({ ...account, source: account.id && !account.transaction_ids ? 'Manual' : 'YNAB' }); // YNAB accounts have transaction_ids, manual ones don't. Or rely on original source.
                                                                                              // More robust: YNAB accounts have `account_id` (or `id` from API) and `transfer_source_id` etc.
                                                                                              // Manual accounts have `id` from Firebase.
                                                                                              // The `source` should be set when fetching/creating.
                                                                                              // For now, let's assume `source` is already on the account object.
                                                                                              // If YNAB API uses `id`, then `account.id` is YNAB's id.
                                                                                              // If manual, `account.id` is Firebase's id.
                                                                                              // The `source` property added earlier is key.
        return;
      }
      const normalizedType = normalizeAccountType(account.type);
      let groupKey;
      switch (normalizedType) {
        case 'checking': case 'savings': groupKey = 'cash'; break;
        case 'investment': case 'otherAsset': groupKey = 'investments'; break;
        case 'credit': case 'creditCard': groupKey = 'credit'; break;
        case 'loan': case 'mortgage': groupKey = 'loans'; break;
        default: groupKey = 'other';
      }
      groups[groupKey].accounts.push({ ...account, source });
    };

    activeYnabAccounts.forEach(acc => assignToGroup(acc, 'YNAB'));
    (manualAccounts || []).forEach(acc => assignToGroup(acc, 'Manual')); // Assuming manual accounts are always active
    closedYnabAccounts.forEach(acc => assignToGroup(acc, 'YNAB')); // Assign closed YNAB to closed group

    // Sort accounts within each group
    for (const key in groups) {
      groups[key].accounts = sortAccounts(groups[key].accounts, sortBy, searchTerm);
    }
    
    // Filter by type if not 'all' AFTER grouping and initial sort
    // This is tricky because filterType might remove all accounts from a group.
    // It's better to filter before sorting and grouping if filterType is not 'all'.
    // The current `sortAccounts` already filters by search term.
    // `filterAccountsByType` should be applied before `sortAccounts` if `filterType` is active.

    // Re-pipeline:
    // 1. Combine active YNAB and Manual accounts.
    // 2. Filter this combined list by `filterType` (if not 'all').
    // 3. Filter by `searchTerm`.
    // 4. Then distribute to groups and sort within groups.

    let allActiveAccounts = [
      ...(ynabAccounts?.filter(acc => !acc.closed).map(acc => ({ ...acc, source: 'YNAB' })) || []),
      ...(manualAccounts?.map(acc => ({ ...acc, source: 'Manual' })) || [])
    ];

    let filteredActiveAccounts = filterAccountsByType(allActiveAccounts, filterType);
    // `sortAccounts` also handles search term, so pass it the already type-filtered list.
    // No, `sortAccounts` should get the full list for its own search, then we distribute.

    // Revised pipeline for active accounts:
    const activeGroups = {
      cash: { title: 'Cash', accounts: [], order: 1 },
      investments: { title: 'Investments', accounts: [], order: 2 },
      credit: { title: 'Credit Cards', accounts: [], order: 3 },
      loans: { title: 'Loans & Mortgages', accounts: [], order: 4 },
      other: { title: 'Other Accounts', accounts: [], order: 5 },
    };
    
    const accountsToProcessForGrouping = sortAccounts(filterAccountsByType(allActiveAccounts, filterType), sortBy, searchTerm);

    accountsToProcessForGrouping.forEach(account => {
      const normalizedType = normalizeAccountType(account.type);
      let groupKey;
      switch (normalizedType) {
        case 'checking': case 'savings': groupKey = 'cash'; break;
        case 'investment': case 'otherAsset': groupKey = 'investments'; break;
        case 'credit': case 'creditCard': groupKey = 'credit'; break;
        case 'loan': case 'mortgage': groupKey = 'loans'; break;
        default: groupKey = 'other';
      }
      if (activeGroups[groupKey]) { // Ensure groupKey is valid
          activeGroups[groupKey].accounts.push(account); // `source` is already on account
      }
    });
    
    // Handle closed accounts separately
    const closedGroup = { title: 'Closed Accounts', accounts: [], order: 6 };
    const allClosedSourceAccounts = ynabAccounts?.filter(acc => acc.closed).map(acc => ({ ...acc, source: 'YNAB' })) || [];
    // Add manual closed accounts if they exist and have a 'closed' flag
    // const manualClosedAccounts = manualAccounts?.filter(acc => acc.closed).map(acc => ({ ...acc, source: 'Manual' })) || [];
    // allClosedSourceAccounts.push(...manualClosedAccounts);

    closedGroup.accounts = sortAccounts(filterAccountsByType(allClosedSourceAccounts, filterType), sortBy, searchTerm);

    return Object.values(activeGroups)
      .concat(closedGroup.accounts.length > 0 ? [closedGroup] : [])
      .sort((a, b) => a.order - b.order)
      .filter(group => group.accounts.length > 0); // Only return groups with accounts
  };


  return (
    <PageTransition>
      <div className="w-full max-w-none space-y-4 pb-4">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <CreditCardIcon className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Accounts</h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Manage all your connected accounts</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2" size="sm">
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Add Manual Account</span>
              <span className="sm:hidden">Add Account</span>
            </Button>
          </div>
        </div>

        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 rounded-lg ${showFilters ? 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' : 'text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700'} transition-colors`}
            aria-label="Toggle filters"
          >
            <FunnelIcon className="h-5 w-5" />
          </button>
        </div>

        {showFilters && (
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm">
                  <option value="all">All Types</option>
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="investment">Investment</option>
                  <option value="credit">Credit Card</option>
                  <option value="loan">Loan</option>
                  <option value="mortgage">Mortgage</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Sort By</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm">
                  <option value="type">Type (Default)</option>
                  <option value="institution">Institution</option>
                  <option value="balance">Balance</option>
                  <option value="name">Name</option>
                </select>
              </div>
            </div>
          </Card>
        )}

        {processedAccountGroups().map(group => (
          <AccountGroup
            key={group.title}
            title={group.title}
            accounts={group.accounts}
            onEdit={handleEditAccount}
            onDelete={handleDeleteAccount}
            deleteConfirm={deleteConfirm}
            isPrivacyMode={isPrivacyMode}
          />
        ))}
        
        {isError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 rounded-lg">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-4 w-4 mr-2 flex-shrink-0" />
              <p className="text-sm">{error?.message || 'Unknown error occurred'}</p>
            </div>
          </div>
        )}

        {!isLoading && !isError && processedAccountGroups().length === 0 && (
            <Card className="p-4">
              <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                <BanknotesIcon className="mx-auto h-10 w-10 mb-3" />
                <p className="text-sm">No accounts match your filters.</p>
                { (filterType !== 'all' || searchTerm) &&
                  <p className="text-xs mt-1">Try adjusting your search or filter criteria.</p>
                }
                { filterType === 'all' && !searchTerm && allAccounts.length === 0 &&
                   <p className="text-xs mt-1">Connect to YNAB or add manual accounts to get started.</p>
                }
              </div>
            </Card>
          )
        }
        
        <ManualAccountModal user={user} show={showAddModal} onClose={() => setShowAddModal(false)} onAccountAdded={() => { setShowAddModal(false); refetch(); }} />
        {editingAccount && <EditManualAccountModal user={user} account={editingAccount} show={showEditModal} onClose={() => { setShowEditModal(false); setEditingAccount(null); }} onAccountUpdated={() => { setShowEditModal(false); setEditingAccount(null); refetch(); }} />}
      </div>
    </PageTransition>
  );
}
