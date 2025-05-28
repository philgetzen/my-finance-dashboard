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

// Compact account card component
const AccountCard = ({ account, isManual, isClosed, onEdit, onDelete, deleteConfirm, isPrivacyMode }) => {
  const getAccountTypeIcon = (type) => {
    const normalizedType = normalizeYNABAccountType(type);
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
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:shadow-md transition-shadow ${isClosed ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`p-1.5 rounded-lg ${getAccountTypeColor(account.type)} ${isClosed ? 'opacity-50' : ''} flex-shrink-0`}>
            {React.cloneElement(getAccountTypeIcon(account.type), { className: 'h-4 w-4' })}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate">{account.name}</h4>
              <span className="text-xs text-gray-500 dark:text-gray-500 flex-shrink-0">
                {extractInstitution(account.name)}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {getDisplayAccountType(account.type)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-500">
                • {account.account_id ? 'YNAB' : 'Manual'} {isClosed && '• Closed'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 ml-3">
          <p className={`font-semibold text-sm text-gray-900 dark:text-white ${isPrivacyMode ? 'filter blur' : ''}`}>
            ${formatCurrency(getAccountBalance(account))}
          </p>
          {isManual && !isClosed && (
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => onEdit(account)}
                className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded transition-colors"
                title="Edit account"
              >
                <PencilIcon className="h-3.5 w-3.5" />
              </button>
              
              <button
                onClick={() => onDelete(account.id)}
                className={`p-1 rounded transition-colors ${
                  deleteConfirm === account.id
                    ? 'text-white bg-red-600 hover:bg-red-700'
                    : 'text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20'
                }`}
                title={deleteConfirm === account.id ? 'Tap again to confirm' : 'Delete account'}
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
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
  const [showAllYnab, setShowAllYnab] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('institution');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Detect mobile screen
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
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
      } catch (error) {
        console.error('Failed to delete account:', error);
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
      case 'checking':
      case 'savings':
        return 1;
      case 'credit':
        return 2;
      case 'investment':
        return 3;
      case 'loan':
      case 'mortgage':
        return 4;
      default:
        return 5;
    }
  };

  const sortAccounts = (accounts, sortBy, searchTerm = '') => {
    let filtered = accounts;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = accounts.filter(account => 
        account.name?.toLowerCase().includes(term) ||
        getDisplayAccountType(account.type).toLowerCase().includes(term) ||
        extractInstitution(account.name).toLowerCase().includes(term)
      );
    }
    
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
          return getAccountBalance(b) - getAccountBalance(a);
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

  const filterAccountsByType = (accounts, filterType) => {
    if (filterType === 'all') return [...accounts];
    return accounts.filter(account => {
      const normalizedType = normalizeAccountType(account.type);
      return normalizedType === filterType;
    });
  };

  const formatCurrency = (amount) => {
    return `${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Calculate net worth
  const liabilityTypes = ['credit', 'loan', 'mortgage', 'credit_card', 'creditCard'];
  
  const isLiability = (account) => {
    const type = account.type?.toLowerCase();
    const subtype = account.subtype?.toLowerCase();
    const name = account.name?.toLowerCase();
    
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
    const bal = getAccountBalance(acc);
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
      <div className="w-full max-w-none space-y-4 pb-4">
        {/* Header - Mobile Optimized */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <CreditCardIcon className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Accounts</h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                Manage all your connected accounts
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2"
              size="sm"
            >
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Add Manual Account</span>
              <span className="sm:hidden">Add Account</span>
            </Button>
          </div>
        </div>

        {/* Mobile Search Bar */}
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
            className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 ${showFilters ? 'text-blue-600' : 'text-gray-400'}`}
          >
            <FunnelIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Filters - Collapsible on Mobile */}
        {showFilters && (
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
              
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="institution">Institution</option>
                  <option value="balance">Balance</option>
                  <option value="name">Name</option>
                  <option value="type">Type</option>
                </select>
              </div>
            </div>
          </Card>
        )}

        {/* YNAB Accounts - Active */}
        {(() => {
          const activeAccounts = ynabAccounts?.filter(acc => !acc.closed) || [];
          const filteredAccounts = sortAccounts(
            filterAccountsByType(activeAccounts, filterType),
            sortBy,
            searchTerm
          );
          
          return ynabConnected && filteredAccounts.length > 0 ? (
            <Card className="p-4">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  YNAB Accounts
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {filteredAccounts.length} active {filteredAccounts.length === 1 ? 'account' : 'accounts'}
                </p>
              </div>
              
              <div className="space-y-3">
                {filteredAccounts.slice(0, showAllYnab ? filteredAccounts.length : 5).map((account) => (
                  <AccountCard
                    key={account.account_id}
                    account={account}
                    isManual={false}
                    isClosed={false}
                    isPrivacyMode={isPrivacyMode}
                  />
                ))}
                
                {filteredAccounts.length > 5 && (
                  <div className="text-center pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowAllYnab(!showAllYnab)}
                      size="sm"
                    >
                      {showAllYnab 
                        ? 'Show Less' 
                        : `Show All ${filteredAccounts.length} Accounts`
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
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 rounded-lg">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-4 w-4 mr-2 flex-shrink-0" />
              <p className="text-sm">{error?.message || 'Unknown error occurred'}</p>
            </div>
          </div>
        )}

        {/* Manual Accounts */}
        {(() => {
          const filteredAccounts = sortAccounts(
            filterAccountsByType(manualAccounts || [], filterType),
            sortBy,
            searchTerm
          );
          
          return filteredAccounts.length > 0 ? (
            <Card className="p-4">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Manual Accounts
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {filteredAccounts.length} {filteredAccounts.length === 1 ? 'account' : 'accounts'} - editable
                </p>
              </div>
              
              <div className="space-y-3">
                {filteredAccounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    isManual={true}
                    isClosed={false}
                    onEdit={handleEditAccount}
                    onDelete={handleDeleteAccount}
                    deleteConfirm={deleteConfirm}
                    isPrivacyMode={isPrivacyMode}
                  />
                ))}
              </div>
            </Card>
          ) : (manualAccounts || []).length === 0 && (filterType === 'all' || !searchTerm) ? (
            <Card className="p-4">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Manual Accounts</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Add accounts manually
                </p>
              </div>
              <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                <BanknotesIcon className="mx-auto h-10 w-10 mb-3" />
                <p className="text-sm">No manual accounts added yet</p>
                <p className="text-xs mt-1">Click "Add Account" to get started</p>
              </div>
            </Card>
          ) : null;
        })()}

        {/* Closed Accounts */}
        {(() => {
          const closedYnabAccounts = ynabAccounts?.filter(acc => acc.closed) || [];
          const closedManualAccounts = [];
          const allClosedAccounts = [...closedYnabAccounts, ...closedManualAccounts];
          
          const filteredAccounts = sortAccounts(
            filterAccountsByType(allClosedAccounts, filterType),
            sortBy,
            searchTerm
          );
          
          return filteredAccounts.length > 0 ? (
            <Card className="p-4">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Closed Accounts
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {filteredAccounts.length} closed {filteredAccounts.length === 1 ? 'account' : 'accounts'}
                </p>
              </div>
              
              <div className="space-y-3">
                {filteredAccounts.map((account) => (
                  <AccountCard
                    key={account.account_id || account.id}
                    account={account}
                    isManual={!account.account_id}
                    isClosed={true}
                    isPrivacyMode={isPrivacyMode}
                  />
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