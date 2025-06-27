import React, { useState, useMemo, useCallback } from 'react';
import { useFinanceData, usePrivacy } from '../../contexts/ConsolidatedDataContext';
import { useAccountManager } from '../../hooks/useAccountManager';
import { useDemoMode } from '../../hooks/useDemoMode';
import PageTransition from '../ui/PageTransition';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ManualAccountModal from '../ui/ManualAccountModal';
import EditManualAccountModal from '../ui/EditManualAccountModal';
import PrivacyCurrency from '../ui/PrivacyCurrency';
import { formatCurrency } from '../../utils/formatters';
import {
  BanknotesIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowsUpDownIcon,
} from '@heroicons/react/24/outline';

// Simple table row component
const AccountRow = React.memo(({ account, onEdit, onDelete, privacyMode }) => {
  const isLiability = ['Credit Card', 'Loan', 'Mortgage'].includes(account.displayType);
  const balance = account.balance;
  const isClosed = !!account.closed_on;

  return (
    <tr className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
      isClosed ? 'opacity-60' : ''
    }`}>
      <td className="px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-white">
            {account.name}
          </span>
          {isClosed && (
            <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-400">
              Closed
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        {account.displayType}
      </td>
      <td className={`px-4 py-3 text-sm font-medium text-right ${
        isLiability ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
      }`}>
        <PrivacyCurrency
          amount={balance}
          isPrivacyMode={privacyMode}
          prefix={isLiability ? '-$' : '$'}
        />
      </td>
      <td className="px-4 py-3 text-sm text-center">
        <span className={`text-xs ${
          account.source === 'ynab' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400'
        }`}>
          {account.source === 'ynab' ? 'YNAB' : 'Manual'}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        {account.source === 'manual' && !isClosed && (
          <div className="flex gap-1 justify-end pr-1">
            <button
              onClick={() => onEdit(account)}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(account)}
              className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
});

AccountRow.displayName = 'AccountRow';

export default function Accounts() {
  const { 
    accounts: ynabAccounts, 
    manualAccounts,
    updateManualAccount,
    deleteManualAccount,
    isLoading 
  } = useFinanceData();
  const { privacyMode } = usePrivacy();
  const { isFeatureEnabled } = useDemoMode();

  // State
  const [showManualModal, setShowManualModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    type: 'all',
    showActiveOnly: true,
    hideZeroBalance: false
  });
  const [sortBy, setSortBy] = useState('institution');

  // Use account manager hook
  const { 
    allAccounts, 
    accountsByType, 
    filterAccounts, 
    sortAccounts,
    totals 
  } = useAccountManager(ynabAccounts, manualAccounts);

  // Get filtered and sorted accounts
  const displayAccounts = useMemo(() => {
    // First filter
    const filtered = filterAccounts(allAccounts, filters);
    // Then sort
    const sorted = sortAccounts(filtered, sortBy);
    // Group by active/closed status
    const active = sorted.filter(acc => !acc.closed_on);
    const closed = sorted.filter(acc => acc.closed_on);
    
    return { active, closed };
  }, [allAccounts, filterAccounts, sortAccounts, filters, sortBy]);

  // Split active accounts by source
  const { ynabActive, manualActive } = useMemo(() => {
    const ynab = displayAccounts.active.filter(acc => acc.source === 'ynab');
    const manual = displayAccounts.active.filter(acc => acc.source === 'manual');
    return { ynabActive: ynab, manualActive: manual };
  }, [displayAccounts.active]);

  // Account actions
  const handleEditAccount = useCallback((account) => {
    setEditingAccount(account);
  }, []);

  const handleDeleteAccount = useCallback(async (account) => {
    if (window.confirm(`Are you sure you want to delete "${account.name}"?`)) {
      await deleteManualAccount(account.id);
    }
  }, [deleteManualAccount]);

  const handleUpdateAccount = useCallback(async (accountId, updates) => {
    await updateManualAccount(accountId, updates);
    setEditingAccount(null);
  }, [updateManualAccount]);

  // Get account types for filter
  const accountTypes = useMemo(() => {
    const types = new Set();
    allAccounts.forEach(acc => types.add(acc.displayType));
    return Array.from(types).sort();
  }, [allAccounts]);

  if (isLoading) {
    return (
      <PageTransition>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="w-full max-w-none space-y-6 pb-4">
        {/* Header */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-left">Accounts</h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400 text-left">
                Manage your financial accounts
              </p>
            </div>
            <Button
              onClick={() => setShowManualModal(true)}
              className="flex items-center gap-2"
              disabled={!isFeatureEnabled('create_account')}
              title={!isFeatureEnabled('create_account') ? 'Account creation disabled in demo mode' : 'Add a new manual account'}
            >
              <PlusIcon className="h-4 w-4" />
              Add Account
            </Button>
          </div>

          {/* Summary metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Assets</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                <PrivacyCurrency
                  amount={totals.assets}
                  isPrivacyMode={privacyMode}
                />
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Liabilities</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                <PrivacyCurrency
                  amount={totals.liabilities}
                  isPrivacyMode={privacyMode}
                />
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Net Worth</p>
              <p className={`text-2xl font-bold ${
                totals.netWorth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                <PrivacyCurrency
                  amount={totals.netWorth}
                  isPrivacyMode={privacyMode}
                />
              </p>
            </div>
          </div>
        </Card>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search accounts..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Type filter */}
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-500" />
              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                {accountTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <ArrowsUpDownIcon className="h-5 w-5 text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="institution">By Institution</option>
                <option value="balance">By Balance</option>
                <option value="name">By Name</option>
                <option value="type">By Type</option>
              </select>
            </div>

            {/* Toggles */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showActiveOnly}
                onChange={(e) => setFilters(prev => ({ ...prev, showActiveOnly: e.target.checked }))}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Active only</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.hideZeroBalance}
                onChange={(e) => setFilters(prev => ({ ...prev, hideZeroBalance: e.target.checked }))}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Hide zero balance</span>
            </label>
          </div>
        </Card>

        {/* Account tables */}
        <div className="space-y-6">
          {/* YNAB Active Accounts */}
          {ynabActive.length > 0 && (
            <Card className="p-0">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-left">
                  YNAB Accounts
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-left">
                  Connected through YNAB
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Account Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Type
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Balance
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Source
                      </th>
                      <th className="px-4 py-3 w-28"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {ynabActive.map(account => (
                      <AccountRow
                        key={account.id || account.account_id}
                        account={account}
                        onEdit={handleEditAccount}
                        onDelete={handleDeleteAccount}
                        privacyMode={privacyMode}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Manual Active Accounts */}
          {manualActive.length > 0 && (
            <Card className="p-0">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-left">
                  Manual Accounts
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-left">
                  Manually tracked accounts
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Account Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Type
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Balance
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Source
                      </th>
                      <th className="px-4 py-3 w-28"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {manualActive.map(account => (
                      <AccountRow
                        key={account.id || account.account_id}
                        account={account}
                        onEdit={handleEditAccount}
                        onDelete={handleDeleteAccount}
                        privacyMode={privacyMode}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Closed Accounts */}
          {displayAccounts.closed.length > 0 && (
            <Card className="p-0">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-left">
                  Closed Accounts
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-left">
                  Previously active accounts
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Account Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Type
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Balance
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Source
                      </th>
                      <th className="px-4 py-3 w-28"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {displayAccounts.closed.map(account => (
                      <AccountRow
                        key={account.id || account.account_id}
                        account={account}
                        onEdit={handleEditAccount}
                        onDelete={handleDeleteAccount}
                        privacyMode={privacyMode}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          
          {(ynabActive.length === 0 && manualActive.length === 0 && displayAccounts.closed.length === 0) && (
            <Card className="p-8 text-center">
              <BanknotesIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
                No accounts found
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {filters.search || filters.type !== 'all' || !filters.showActiveOnly || filters.hideZeroBalance
                  ? "Try adjusting your filters"
                  : "Add an account to get started"}
              </p>
            </Card>
          )}
        </div>

        {/* Modals */}
        <ManualAccountModal
          show={showManualModal}
          onClose={() => setShowManualModal(false)}
          onAccountAdded={() => setShowManualModal(false)}
        />

        {editingAccount && (
          <EditManualAccountModal
            show={!!editingAccount}
            account={editingAccount}
            onClose={() => setEditingAccount(null)}
            onSave={handleUpdateAccount}
          />
        )}
      </div>
    </PageTransition>
  );
}
