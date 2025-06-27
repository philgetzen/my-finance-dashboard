import React, { useState, useEffect, useMemo } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid 
} from 'recharts';
import { useFinanceData, usePrivacy } from '../../contexts/ConsolidatedDataContext';
import { useDemoMode } from '../../hooks/useDemoMode';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ManualAccountModal from '../ui/ManualAccountModal';
import YNABConnectionCard from '../ui/YNABConnectionCard';
import { DashboardSkeleton } from '../ui/Skeleton';
import PageTransition from '../ui/PageTransition';
import YNABConnectionErrorModal from '../ui/YNABConnectionErrorModal';
import PrivacyCurrency from '../ui/PrivacyCurrency';
import { getAccountBalance, normalizeYNABAccountType } from '../../utils/ynabHelpers';
import { formatCurrency, formatCurrencyForTooltip, isLiability, getDisplayAccountType } from '../../utils/formatters';
import { useTransactionProcessor, getMonthlyRangeData } from '../../hooks/useTransactionProcessor';
import {
  BanknotesIcon,
  CreditCardIcon,
  ChartBarIcon,
  PlusIcon,
  HomeIcon,
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ScaleIcon,
  ChartPieIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';

const COLORS = ['#3B82F6', '#8B5CF6', '#EF4444', '#10B981', '#F59E0B', '#06B6D4'];

// Memoized components for better performance
const MetricCard = React.memo(({ title, value, icon: Icon, trend, color, isPrivacyMode }) => (
  <Card className="p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{title}</p>
        <PrivacyCurrency
          amount={value}
          isPrivacyMode={isPrivacyMode}
          className={`text-2xl font-bold ${color}`}
        />
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
        trend === 'up' ? 'bg-green-100 dark:bg-green-900' : 
        trend === 'down' ? 'bg-red-100 dark:bg-red-900' : 
        'bg-blue-100 dark:bg-blue-900'
      }`}>
        <Icon className={`h-6 w-6 ${
          trend === 'up' ? 'text-green-600 dark:text-green-400' : 
          trend === 'down' ? 'text-red-600 dark:text-red-400' : 
          'text-blue-600 dark:text-blue-400'
        }`} />
      </div>
    </div>
  </Card>
));

MetricCard.displayName = 'MetricCard';

const TransactionRow = React.memo(({ transaction, account, isPrivacyMode }) => {
  const amount = transaction.processedAmount || 0;
  const isExpense = amount < 0;

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
        {new Date(transaction.date).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
        {transaction.payee_name || transaction.name || 'Unknown'}
        {transaction.source === 'ynab' && (
          <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">(YNAB)</span>
        )}
      </td>
      <td className={`px-4 py-3 text-sm font-medium text-right ${
        isExpense ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
      }`}>
        <PrivacyCurrency
          amount={amount}
          isPrivacyMode={isPrivacyMode}
        />
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
        {account?.name || 'Unknown Account'}
      </td>
    </tr>
  );
});

TransactionRow.displayName = 'TransactionRow';

export default function Dashboard() {
  const {
    user,
    accounts: ynabAccounts,
    transactions: ynabTransactions,
    manualAccounts,
    ynabToken,
    isLoading,
    error,
    saveYNABToken,
    refetch,
    showYNABErrorModal,
    setShowYNABErrorModal,
    ynabError,
    isDemoMode
  } = useFinanceData();
  const { privacyMode } = usePrivacy();
  const { isFeatureEnabled } = useDemoMode();

  const [showManualModal, setShowManualModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Combine accounts efficiently
  const allAccounts = useMemo(() => [
    ...(ynabAccounts || []), 
    ...(manualAccounts || [])
  ], [ynabAccounts, manualAccounts]);

  // Investment account IDs
  const investmentAccountIds = useMemo(() => new Set(
    allAccounts
      .filter(acc => normalizeYNABAccountType(acc.type) === 'investment')
      .map(acc => acc.id || acc.account_id)
      .filter(id => id)
  ), [allAccounts]);

  // Process transactions using shared hook
  const { processedTransactions, monthlyData, totals } = useTransactionProcessor(
    ynabTransactions,
    allAccounts,
    investmentAccountIds
  );

  // Calculate net worth and totals
  const { netWorth, totalAssets, totalLiabilities } = useMemo(() => {
    let assets = 0;
    let liabilities = 0;

    allAccounts.forEach(account => {
      const balance = getAccountBalance(account);
      const type = normalizeYNABAccountType(account.type);
      
      if (isLiability(account) || ['credit', 'loan', 'mortgage'].includes(type)) {
        liabilities += Math.abs(balance);
      } else {
        assets += balance;
      }
    });

    return {
      netWorth: assets - liabilities,
      totalAssets: assets,
      totalLiabilities: liabilities
    };
  }, [allAccounts]);

  // Asset allocation data
  const allocationData = useMemo(() => {
    const allocation = {};
    
    allAccounts.forEach(account => {
      const balance = getAccountBalance(account);
      if (balance > 0 && !isLiability(account)) {
        const type = getDisplayAccountType(account.type);
        allocation[type] = (allocation[type] || 0) + balance;
      }
    });

    return Object.entries(allocation)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [allAccounts]);

  // Chart data
  const chartData = useMemo(() => {
    const last6Months = getMonthlyRangeData(monthlyData, 6);
    
    return last6Months.map(month => ({
      month: month.monthName.split(' ')[0],
      income: month.income,
      expenses: month.expenses
    }));
  }, [monthlyData]);

  const handleYNABConnect = async (accessToken, refreshToken) => {
    await saveYNABToken(accessToken, refreshToken);
    setTimeout(() => refetch(), 200);
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <PageTransition>
      <div className="w-full max-w-none space-y-6 pb-4">
        {/* Header */}
        <Card className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <HomeIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Financial Dashboard
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1">
                Your complete financial overview
              </p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  // Only refresh data if YNAB is connected
                  if (ynabToken) {
                    await refetch();
                  }
                } catch (error) {
                  console.error('Error refreshing data:', error);
                }
              }}
              className="flex items-center gap-2 text-sm whitespace-nowrap"
              size="sm"
              disabled={isLoading}
            >
              <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowManualModal(true)}
              size="sm"
              className="whitespace-nowrap"
              disabled={!isFeatureEnabled('create_account')}
              title={!isFeatureEnabled('create_account') ? 'Account creation disabled in demo mode' : 'Add a new manual account'}
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Account
            </Button>
            <YNABConnectionCard
              onConnect={handleYNABConnect}
              isConnected={!!ynabToken}
              compact={true}
            />
          </div>
        </Card>

        {/* Error Messages */}
        {error && ynabToken && (
          <Card className="p-4 border-red-200 dark:border-red-800">
            <p className="text-red-700 dark:text-red-400">
              {error.message || 'Failed to load data'}
            </p>
          </Card>
        )}

        {!ynabToken && (
          <Card className="p-4 border-blue-200 dark:border-blue-800">
            <div className="flex items-center text-blue-700 dark:text-blue-400">
              <LinkIcon className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>Connect your YNAB account to see your financial data</span>
            </div>
          </Card>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            title="Net Worth"
            value={netWorth}
            icon={ScaleIcon}
            trend={netWorth >= 0 ? 'up' : 'down'}
            color={netWorth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
            isPrivacyMode={privacyMode}
          />
          <MetricCard
            title="Total Assets"
            value={totalAssets}
            icon={ArrowTrendingUpIcon}
            trend="up"
            color="text-green-600 dark:text-green-400"
            isPrivacyMode={privacyMode}
          />
          <MetricCard
            title="Total Liabilities"
            value={totalLiabilities}
            icon={ArrowTrendingDownIcon}
            trend="down"
            color="text-red-600 dark:text-red-400"
            isPrivacyMode={privacyMode}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Asset Allocation */}
          <Card className="p-6">
            <div className="flex items-center mb-6">
              <ChartPieIcon className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Asset Allocation
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Portfolio breakdown
                </p>
              </div>
            </div>

            {allocationData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocationData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius="80%"
                      label={false}
                    >
                      {allocationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [formatCurrency(value), '']}
                      contentStyle={{
                        borderRadius: '8px',
                      }}
                      wrapperClassName="chart-tooltip"
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        return (
                          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                            {payload.map((entry, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: entry.fill }}
                                />
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {entry.name}:
                                </span>
                                <span className={`text-sm font-medium text-gray-900 dark:text-white ${privacyMode ? 'privacy-blur' : ''}`}>
                                  ${formatCurrency(entry.value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center">
                <div className="text-center">
                  <ChartPieIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No allocation data available
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Account Summary */}
          <Card className="p-6">
            <div className="flex items-center mb-6">
              <BanknotesIcon className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Account Summary
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  By category
                </p>
              </div>
            </div>
            
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {Object.entries(
                allAccounts.reduce((groups, account) => {
                  const type = getDisplayAccountType(account.type);
                  const balance = getAccountBalance(account);
                  const isLiab = isLiability(account) || 
                    ['credit', 'loan', 'mortgage'].includes(normalizeYNABAccountType(account.type));
                  
                  if (!groups[type]) {
                    groups[type] = { total: 0, isLiability: isLiab };
                  }
                  groups[type].total += Math.abs(balance);
                  return groups;
                }, {})
              ).map(([type, data], typeIndex) => (
                <div
                  key={type}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center">
                    <div
                      className="w-4 h-4 rounded-full mr-3"
                      style={{ backgroundColor: COLORS[typeIndex % COLORS.length] }}
                    />
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      {type}
                    </span>
                  </div>
                  <PrivacyCurrency
                    amount={data.total}
                    isPrivacyMode={privacyMode}
                    prefix={data.isLiability ? '-$' : '$'}
                    className={`text-base font-semibold ${
                      data.isLiability ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                    }`}
                  />
                </div>
              ))}
              
              {allAccounts.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <BanknotesIcon className="mx-auto h-12 w-12 mb-4" />
                  <p className="text-sm">No accounts connected</p>
                  <p className="text-xs mt-1">Connect your accounts to see your financial summary</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Income vs Expenses - Full Width */}
        <Card className="p-6">
          <div className="flex items-center mb-6">
            <ChartBarIcon className="h-5 w-5 text-gray-400 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Income vs Expenses
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Last 6 months
              </p>
            </div>
          </div>

          {chartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(value), '']}
                    contentStyle={{
                      borderRadius: '8px',
                    }}
                    wrapperClassName="chart-tooltip"
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      return (
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">{label}</p>
                          {payload.map((entry, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: entry.fill }}
                              />
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {entry.name}:
                              </span>
                              <span className={`text-sm font-medium ${
                                entry.dataKey === 'income' 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : 'text-red-600 dark:text-red-400'
                              } ${privacyMode ? 'privacy-blur' : ''}`}>
                                ${formatCurrency(entry.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} name="Income" />
                  <Bar dataKey="expenses" fill="#EF4444" radius={[4, 4, 0, 0]} name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center">
              <div className="text-center">
                <ChartBarIcon className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No transaction data available
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Recent Transactions */}
        <Card className="p-6">
          <div className="flex items-center mb-6">
            <CreditCardIcon className="h-5 w-5 text-gray-400 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recent Transactions
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Latest financial activity
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Account
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {processedTransactions
                  .slice()
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .slice(0, 10)
                  .map((txn, index) => (
                  <TransactionRow
                    key={`${txn.id || txn.transaction_id}-${index}`}
                    transaction={txn}
                    account={allAccounts.find(acc => 
                      (acc.account_id || acc.id) === txn.account_id
                    )}
                    isPrivacyMode={privacyMode}
                  />
                ))}
              </tbody>
            </table>
            {processedTransactions.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p className="text-sm">No transactions available</p>
              </div>
            )}
          </div>
        </Card>

        {/* Modals */}
        <ManualAccountModal
          user={user}
          show={showManualModal}
          onClose={() => setShowManualModal(false)}
          onAccountAdded={() => setShowManualModal(false)}
        />

        <YNABConnectionErrorModal
          show={showYNABErrorModal}
          onClose={() => setShowYNABErrorModal(false)}
          onReconnect={handleYNABConnect}
          error={ynabError}
        />
      </div>
    </PageTransition>
  );
}
