import React, { useState } from 'react';
import { usePlaid } from '../../contexts/PlaidDataContext';
import { usePrivacy } from '../../contexts/PrivacyContext';
import { useCombinedFinanceData } from '../../hooks/useCombinedFinanceData';
import { useDeleteManualAccount } from '../../hooks/useFinanceData';
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
} from '@heroicons/react/24/outline';

export default function Accounts() {
  const { user } = usePlaid();
  const { 
    manualAccounts, 
    ynabAccounts, 
    accounts: allAccounts,
    isLoading, 
    isError, 
    error,
    ynabConnected,
    refetch
  } = useCombinedFinanceData(user?.uid);
  
  const deleteManualAccount = useDeleteManualAccount();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showAllYnab, setShowAllYnab] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('institution');
  const [searchTerm, setSearchTerm] = useState('');

  // Use global privacy context
  const { privacyMode } = usePrivacy();


  const handleEditAccount = (account) => {
    setEditingAccount(account);
    setShowEditModal(true);
  };


  const handleDeleteAccount = async (accountId) => {
    if (deleteConfirm === accountId) {
      try {
        await deleteManualAccount.mutateAsync({ accountId, userId: user.uid });
        setDeleteConfirm(null);
      } catch (error) {
        console.error('Failed to delete account:', error);
        // Error is handled by the mutation
      }
    } else {
      setDeleteConfirm(accountId);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const getAccountTypeIcon = (type) => {
    const normalizedType = normalizeAccountType(type);
    switch (normalizedType) {
      case 'credit':
      case 'creditCard':
        return <CreditCardIcon className="h-5 w-5" />;
      case 'loan':
      case 'mortgage':
        return <BuildingLibraryIcon className="h-5 w-5" />;
      case 'investment':
      case 'otherAsset':
        return <ChartBarIcon className="h-5 w-5" />;
      default:
        return <BanknotesIcon className="h-5 w-5" />;
    }
  };

  const getAccountTypeColor = (type) => {
    const normalizedType = normalizeAccountType(type);
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

  // Helper functions for account processing
  const normalizeAccountType = (type) => {
    if (!type) return 'other';
    const lowerType = type.toLowerCase();
    if (lowerType === 'otherasset') return 'investment';
    if (lowerType === 'creditcard') return 'credit';
    if (lowerType === 'otherliability') return 'loan';
    return lowerType;
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
    // Common patterns for institution extraction
    const patterns = [
      /^(\w+)\s+/,  // First word
      /^(.+?)\s+(Checking|Savings|Credit|Card|Account)/i,  // Before account type
    ];
    
    for (const pattern of patterns) {
      const match = accountName.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    // Fallback: use first word or full name if short
    const firstWord = accountName.split(' ')[0];
    return firstWord.length > 2 ? firstWord : accountName;
  };

  const getAccountTypeSortOrder = (type) => {
    const normalizedType = normalizeAccountType(type);
    switch (normalizedType) {
      case 'checking':
      case 'savings':
        return 1; // Cash accounts first
      case 'credit':
        return 2; // Credit cards second
      case 'investment':
        return 3; // Investments third
      case 'loan':
      case 'mortgage':
        return 4; // Loans/Mortgages last
      default:
        return 5; // Other accounts at the end
    }
  };

  const sortAccounts = (accounts, sortBy, searchTerm = '') => {
    let filtered = accounts;
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = accounts.filter(account => 
        account.name?.toLowerCase().includes(term) ||
        getDisplayAccountType(account.type).toLowerCase().includes(term) ||
        extractInstitution(account.name).toLowerCase().includes(term)
      );
    }
    
    // Apply sorting
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'institution':
          const instA = extractInstitution(a.name);
          const instB = extractInstitution(b.name);
          if (instA !== instB) {
            return instA.localeCompare(instB);
          }
          return a.name.localeCompare(b.name);
        case 'balance':
          return (b.balance || 0) - (a.balance || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'type':
          const orderA = getAccountTypeSortOrder(a.type);
          const orderB = getAccountTypeSortOrder(b.type);
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  };

  const groupAccountsByType = (accounts) => {
    const groups = {};
    accounts.forEach(account => {
      const type = getDisplayAccountType(account.type);
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(account);
    });
    return groups;
  };

  const filterAccountsByType = (accounts, filterType) => {
    if (filterType === 'all') return accounts;
    const filtered = accounts.filter(account => {
      const normalizedType = normalizeAccountType(account.type);
      return normalizedType === filterType;
    });
    return filtered;
  };

  const formatCurrency = (amount) => {
    return `${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Calculate net worth
  const liabilityTypes = ['credit', 'loan', 'mortgage', 'credit_card', 'creditCard'];
  
  // Helper function to check if an account is a liability
  const isLiability = (account) => {
    const type = account.type?.toLowerCase();
    const subtype = account.subtype?.toLowerCase();
    const name = account.name?.toLowerCase();
    
    // Check for credit card indicators in various fields
    return (
      liabilityTypes.some(liability => type?.includes(liability)) ||
      liabilityTypes.some(liability => subtype?.includes(liability)) ||
      name?.includes('credit') ||
      name?.includes('card') ||
      type === 'credit' ||
      subtype === 'credit_card'
    );
  };
  
  const netWorth = allAccounts.reduce((sum, acc) => {
    const bal = acc.balances?.current ?? acc.balance ?? 0;
    return isLiability(acc) ? sum - Math.abs(bal) : sum + bal;
  }, 0);

  if (isLoading) {
    return (
      <PageTransition>
        <AccountsSkeleton />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="w-full max-w-none space-y-4 sm:space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <CreditCardIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white text-left">Accounts</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 text-left">
            Manage all your connected accounts
            </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              Add Manual Account
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search accounts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              {/* Type Filter */}
              <div className="w-full sm:w-48">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="investment">Investment</option>
                  <option value="credit">Credit Card</option>
                  <option value="loan">Loan</option>
                  <option value="mortgage">Mortgage</option>
                </select>
              </div>
              
              {/* Sort */}
              <div className="w-full sm:w-48">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="institution">By Institution</option>
                  <option value="balance">By Balance</option>
                  <option value="name">By Name</option>
                  <option value="type">By Type</option>
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* YNAB Accounts - Active */}
        {(() => {
          const activeAccounts = ynabAccounts.filter(acc => !acc.closed);
          const filteredAccounts = sortAccounts(
            filterAccountsByType(activeAccounts, filterType),
            sortBy,
            searchTerm
          );
          
          return ynabConnected && filteredAccounts.length > 0 ? (
            <Card>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 text-left">
                  YNAB Accounts
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-left">
                  {filteredAccounts.length} active {filteredAccounts.length === 1 ? 'account' : 'accounts'} from YNAB
                </p>
              </div>
              
              <div className="space-y-3">
                {filteredAccounts.slice(0, showAllYnab ? filteredAccounts.length : 5).map((account) => (
                  <div
                    key={account.account_id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-[1.01] animate-in fade-in-0 slide-in-from-left-4"
                  >
                    <div className="flex items-center">
                      <div className={`p-2 rounded-lg mr-3 ${getAccountTypeColor(account.type)}`}>
                        {getAccountTypeIcon(account.type)}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white text-left">{account.name}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 capitalize text-left">
                          {extractInstitution(account.name)} • {getDisplayAccountType(account.type)} • YNAB • Active
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-right mr-3">
                        <p className={`font-semibold text-gray-900 dark:text-white ${privacyMode ? 'filter blur' : ''}`}>
                          {formatCurrency(account.balance)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">Read-only</p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredAccounts.length > 5 && (
                  <div className="text-center py-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowAllYnab(!showAllYnab)}
                      className="text-sm"
                    >
                      {showAllYnab 
                        ? 'Show Less' 
                        : `Show All ${filteredAccounts.length} YNAB Accounts (${filteredAccounts.length - 5} more)`
                      }
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ) : null;
        })()}

        {/* Error Display */}
        {isError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-lg">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
              <p>{error?.message || 'Unknown error occurred'}</p>
            </div>
          </div>
        )}




        {/* Manual Accounts */}
        {(() => {
          const filteredAccounts = sortAccounts(
            filterAccountsByType(manualAccounts, filterType),
            sortBy,
            searchTerm
          );
          const groupedAccounts = groupAccountsByType(filteredAccounts);
          
          return Object.keys(groupedAccounts).length > 0 ? (
            Object.entries(groupedAccounts).map(([type, accounts]) => (
              <Card key={`manual-${type}`}>
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 text-left">
                    {type} Accounts (Manual)
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 text-left">
                    {accounts.length} {type.toLowerCase()} {accounts.length === 1 ? 'account' : 'accounts'} - editable and removable
                  </p>
                </div>
                
                <div className="space-y-3">
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-[1.01] animate-in fade-in-0 slide-in-from-left-4"
                    >
                      <div className="flex items-center">
                        <div className={`p-2 rounded-lg mr-3 ${getAccountTypeColor(account.type)}`}>
                          {getAccountTypeIcon(account.type)}
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">{account.name}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                            {extractInstitution(account.name)} • {getDisplayAccountType(account.type)} • Manual
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-right mr-3">
                          <p className={`font-semibold text-gray-900 dark:text-white ${privacyMode ? 'filter blur' : ''}`}>
                            {formatCurrency(account.balance)}
                          </p>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditAccount(account)}
                            className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Edit account"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteAccount(account.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              deleteConfirm === account.id
                                ? 'text-white bg-red-600 hover:bg-red-700'
                                : 'text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20'
                            }`}
                            title={deleteConfirm === account.id ? 'Click again to confirm' : 'Delete account'}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))
          ) : manualAccounts.length === 0 && (filterType === 'all' || !searchTerm) ? (
            <Card>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 text-left">Manual Accounts</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-left">
                  Accounts you've added manually - editable and removable
                </p>
              </div>
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <BanknotesIcon className="mx-auto h-12 w-12 mb-4" />
                <p>No manual accounts added yet</p>
                <p className="text-sm mt-1">Click "Add Manual Account" to get started</p>
              </div>
            </Card>
          ) : null;
        })()}



        {/* Closed Accounts (Combined) */}
        {(() => {
          const closedYnabAccounts = ynabAccounts.filter(acc => acc.closed);
          const closedManualAccounts = []; // Manual accounts don't have closed status currently
          const allClosedAccounts = [...closedYnabAccounts, ...closedManualAccounts];
          
          const filteredAccounts = sortAccounts(
            filterAccountsByType(allClosedAccounts, filterType),
            sortBy,
            searchTerm
          );
          
          return filteredAccounts.length > 0 ? (
            <Card>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 text-left">
                  Closed Accounts
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-left">
                  {filteredAccounts.length} closed {filteredAccounts.length === 1 ? 'account' : 'accounts'} from YNAB and manual entries
                </p>
              </div>
              
              <div className="space-y-3">
                {filteredAccounts.map((account) => (
                  <div
                    key={account.account_id || account.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg opacity-60 transition-all duration-300 ease-in-out"
                  >
                    <div className="flex items-center">
                      <div className={`p-2 rounded-lg mr-3 ${getAccountTypeColor(account.type)} opacity-50`}>
                        {getAccountTypeIcon(account.type)}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white text-left">{account.name}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 capitalize text-left">
                          {extractInstitution(account.name)} • {getDisplayAccountType(account.type)} • {account.source === 'ynab' ? 'YNAB' : 'Manual'} • Closed
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-right mr-3">
                        <p className={`font-semibold ${account.balance > 0 ? 'text-green-600 dark:text-green-400' : account.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'} ${privacyMode ? 'filter blur' : ''}`}>
                          ${(account.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">Read-only</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null;
        })()}

        {/* Modals */}
        <ManualAccountModal
          user={user}
          show={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAccountAdded={() => {
            setShowAddModal(false);
            refetch();
          }}
        />

        {editingAccount && (
          <EditManualAccountModal
            user={user}
            account={editingAccount}
            show={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setEditingAccount(null);
            }}
            onAccountUpdated={() => {
              setShowEditModal(false);
              setEditingAccount(null);
              refetch();
            }}
          />
        )}

      </div>
    </PageTransition>
  );
}