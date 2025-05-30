import React, { useState, useMemo } from 'react';
import { useYNAB, usePrivacy } from '../../contexts/YNABDataContext';
import { formatCurrency, mapAccountType, getDisplayAccountType, getAccountIcon, isLiability, sortAccountsByInstitution, groupAccountsByType } from '../../utils/formatters';
import { getAccountBalance } from '../../utils/ynabHelpers';
import Button from '../ui/Button';
import ManualAccountModal from '../ui/ManualAccountModal';
import PageTransition from '../ui/PageTransition';
import {
  CreditCardIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

export default function Accounts() {
  const { 
    user,
    accounts: ynabAccounts,
    manualAccounts,
    ynabToken,
    isLoading,
    createManualAccount,
    updateManualAccount,
    deleteManualAccount
  } = useYNAB();
  const { isPrivacyMode } = usePrivacy();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('institution');
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);

  // Combine all accounts and add source identifier
  const allAccounts = useMemo(() => {
    const ynabAccountsWithSource = (ynabAccounts || []).map(acc => ({ ...acc, source: 'YNAB' }));
    const manualAccountsWithSource = (manualAccounts || []).map(acc => ({ ...acc, source: 'Manual' }));
    return [...ynabAccountsWithSource, ...manualAccountsWithSource];
  }, [ynabAccounts, manualAccounts]);

  // Filter and sort accounts
  const filteredAccounts = useMemo(() => {
    let filtered = allAccounts.filter(account => {
      const matchesSearch = account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (account.institution || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                           getDisplayAccountType(account.type).toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = typeFilter === 'all' || mapAccountType(account.type) === typeFilter;
      
      return matchesSearch && matchesType;
    });

    // Sort accounts
    if (sortBy === 'institution') {
      filtered = sortAccountsByInstitution(filtered);
    } else if (sortBy === 'balance') {
      filtered.sort((a, b) => Math.abs(getAccountBalance(b)) - Math.abs(getAccountBalance(a)));
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'type') {
      filtered.sort((a, b) => getDisplayAccountType(a.type).localeCompare(getDisplayAccountType(b.type)));
    }

    return filtered;
  }, [allAccounts, searchTerm, typeFilter, sortBy]);

  // Group accounts by status and type
  const groupedAccounts = useMemo(() => {
    const active = filteredAccounts.filter(acc => !acc.closed);
    const closed = filteredAccounts.filter(acc => acc.closed);
    
    // Group active accounts by type and source
    const activeByType = groupAccountsByType(active, true);

    return { activeByType, closed };
  }, [filteredAccounts]);

  // Get unique account types for filter
  const accountTypes = [...new Set(allAccounts.map(acc => mapAccountType(acc.type)))];

  const AccountCard = ({ account }) => {
    const Icon = getAccountIcon(account.type);
    const isNegative = getAccountBalance(account) < 0 || isLiability(account);
    
    return (
      <div className="glass-card p-4 hover:scale-[1.02] transition-all duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 glass-card-${isNegative ? 'red' : 'emerald'} rounded-lg flex items-center justify-center`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{account.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {account.institution || account.source} • {getDisplayAccountType(account.type)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-lg font-bold ${isNegative ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'} ${isPrivacyMode ? 'privacy-blur' : ''}`}>
              {isNegative && getAccountBalance(account) !== 0 ? '-' : ''}${formatCurrency(getAccountBalance(account))}
            </p>
            {account.closed && (
              <span className="inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full mt-1">
                Closed
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <PageTransition>
        <div className="w-full max-w-none space-y-6 pb-4">
          <div className="glass-hero p-6 rounded-2xl animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card p-6 animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(j => (
                  <div key={j} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="w-full max-w-none space-y-6 pb-4">
        {/* Header */}
        <div className="glass-hero p-6 rounded-2xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 glass-card-blue rounded-xl flex items-center justify-center glow-blue">
              <CreditCardIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                Account Management
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1">
                Organize and track all your financial accounts
              </p>
            </div>
          </div>
          
          {/* Add Account Button */}
          <Button
            onClick={() => setShowAddAccountModal(true)}
            className="glass-card-emerald px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium text-white hover:scale-105 transition-transform"
          >
            <PlusIcon className="h-4 w-4" />
            Add Account
          </Button>
        </div>

        {/* Smart Filters */}
        <div className="glass-card p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="glass-input w-full pl-10 pr-4 py-2 text-sm rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>

            {/* Type Filter */}
            <div className="relative">
              <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="glass-input w-full pl-10 pr-4 py-2 text-sm rounded-lg text-gray-900 dark:text-white appearance-none"
              >
                <option value="all">All Types</option>
                {accountTypes.map(type => (
                  <option key={type} value={type}>
                    {getDisplayAccountType(type)}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="glass-input px-4 py-2 text-sm rounded-lg text-gray-900 dark:text-white"
            >
              <option value="institution">By Institution</option>
              <option value="balance">By Balance</option>
              <option value="name">By Name</option>
              <option value="type">By Type</option>
            </select>

            {/* Clear Filters */}
            {(searchTerm || typeFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setTypeFilter('all');
                }}
                className="glass-button px-4 py-2 text-sm rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-2"
              >
                <XCircleIcon className="h-4 w-4" />
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Account Results Summary */}
        <div className="glass-card p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredAccounts.length} of {allAccounts.length} accounts
            {searchTerm && ` matching "${searchTerm}"`}
            {typeFilter !== 'all' && ` of type "${getDisplayAccountType(typeFilter)}"`}
          </p>
        </div>

        {/* Active Accounts by Type */}
        {Object.entries(groupedAccounts.activeByType)
          .sort(([a], [b]) => {
            // Sort YNAB before Manual, then by type
            const [typeA, sourceA] = a.split('-');
            const [typeB, sourceB] = b.split('-');
            if (sourceA !== sourceB) {
              return sourceA === 'YNAB' ? -1 : 1;
            }
            return typeA.localeCompare(typeB);
          })
          .map(([key, group]) => (
            <div key={key} className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {group.displayName}
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400 glass-chart px-3 py-1 rounded-full">
                  {group.accounts.length} accounts
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.accounts.map(account => (
                  <AccountCard key={account.id} account={account} />
                ))}
              </div>
            </div>
          ))}

        {/* Closed Accounts */}
        {groupedAccounts.closed.length > 0 && (
          <div className="glass-card p-6 opacity-75">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Closed Accounts
              </h2>
              <span className="text-sm text-gray-500 dark:text-gray-400 glass-chart px-3 py-1 rounded-full">
                {groupedAccounts.closed.length} accounts
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedAccounts.closed.map(account => (
                <AccountCard key={account.id} account={account} />
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {filteredAccounts.length === 0 && (
          <div className="glass-card p-12 text-center">
            <CreditCardIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No accounts found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Try adjusting your search or filter criteria
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setTypeFilter('all');
              }}
              className="glass-button px-4 py-2 text-sm rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* Add Account Modal */}
        <ManualAccountModal 
          user={user} 
          show={showAddAccountModal} 
          onClose={() => setShowAddAccountModal(false)} 
          onAccountAdded={() => {
            setShowAddAccountModal(false);
          }} 
        />
      </div>
    </PageTransition>
  );
}