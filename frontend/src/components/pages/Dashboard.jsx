import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { usePlaid } from '../../contexts/PlaidDataContext';
import { useAddManualAccount } from '../../hooks/useFinanceData';
import { useCombinedFinanceData } from '../../hooks/useCombinedFinanceData';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ManualAccountModal from '../ui/ManualAccountModal';
import YNABConnectionCard from '../ui/YNABConnectionCard';
import { DashboardSkeleton } from '../ui/Skeleton';
import PageTransition from '../ui/PageTransition';
import {
  BanknotesIcon,
  CreditCardIcon,
  ChartBarIcon,
  PlusIcon,
  HomeIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

const COLORS = ['#3B82F6', '#8B5CF6', '#EF4444', '#10B981', '#F59E0B', '#06B6D4'];

export default function Dashboard() {
  const { user } = usePlaid();
  const { 
    accounts: allAccounts, 
    transactions: allTransactions, 
    manualAccounts,
    ynabConnected,
    isLoading, 
    error,
    updateYNABToken,
    refreshData
  } = useCombinedFinanceData(user?.uid);
  const addManualAccount = useAddManualAccount();
  
  const [showManualModal, setShowManualModal] = useState(false);

  const handleYNABConnect = (accessToken) => {
    updateYNABToken(accessToken);
  };

  // allAccounts now includes YNAB accounts from useFinancialData
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

  const totalAssets = allAccounts.reduce((sum, acc) => {
    const bal = acc.balances?.current ?? acc.balance ?? 0;
    return !isLiability(acc) ? sum + bal : sum;
  }, 0);

  const totalLiabilities = allAccounts.reduce((sum, acc) => {
    const bal = acc.balances?.current ?? acc.balance ?? 0;
    return isLiability(acc) ? sum + Math.abs(bal) : sum;
  }, 0);

  const allocation = Object.values(allAccounts.reduce((acc, account) => {
    const type = account.type || 'other';
    const balance = typeof account.balances?.current === 'number' ? account.balances.current : (typeof account.balance === 'number' ? account.balance : 0);
    acc[type] = acc[type] || { name: type.charAt(0).toUpperCase() + type.slice(1), value: 0 };
    acc[type].value += Math.abs(balance);
    return acc;
  }, {})).filter(item => item.value > 0);

  // Process cashflow data
  const processCashflowData = () => {
    if (!allTransactions.length) return [];
    
    const last6Months = {};
    const today = new Date();
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = date.toISOString().slice(0, 7); // YYYY-MM format
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      last6Months[key] = { month: monthName, income: 0, expenses: 0, net: 0 };
    }
    
    // Process transactions
    allTransactions.forEach(transaction => {
      const transactionDate = new Date(transaction.date);
      const monthKey = transactionDate.toISOString().slice(0, 7);
      
      if (last6Months[monthKey]) {
        const amount = Math.abs(transaction.amount);
        if (transaction.amount > 0) {
          last6Months[monthKey].income += amount;
        } else {
          last6Months[monthKey].expenses += amount;
        }
      }
    });
    
    // Calculate net and return array
    return Object.values(last6Months).map(month => ({
      ...month,
      net: month.income - month.expenses
    }));
  };

  const cashflowData = processCashflowData();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <PageTransition>
      <div className="w-full max-w-none space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <HomeIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Track your financial health at a glance</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          {user && (
            <>
              <Button
                variant="outline"
                onClick={refreshData}
                className="flex items-center gap-2"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowManualModal(true)}
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Manual Account
              </Button>
              <YNABConnectionCard 
                onConnect={handleYNABConnect} 
                isConnected={ynabConnected} 
                compact={true}
              />
            </>
          )}
        </div>
      </div>

      {/* Error Messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 sm:p-4 rounded-lg text-sm sm:text-base">
          {error.message || 'Failed to load data'}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <ChartBarIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Net Worth</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                ${netWorth.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <BanknotesIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Assets</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                ${totalAssets.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                <CreditCardIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Liabilities</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                ${totalLiabilities.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        <Card>
          <div className="mb-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Asset Allocation</h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Breakdown by account type</p>
          </div>
          {allocation.length > 0 ? (
            <div className="h-80 sm:h-96 lg:h-[400px] min-h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 20, right: 30, bottom: 60, left: 30 }}>
                  <Pie
                    data={allocation}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="40%"
                    outerRadius="60%"
                    innerRadius="0%"
                    label={false}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {allocation.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name, props) => [`$${value.toLocaleString()}`, props.payload.name]}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    wrapperStyle={{ paddingTop: '20px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 sm:h-80 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm sm:text-base">
              No allocation data available
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Cash Flow</h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Income vs expenses over time</p>
          </div>
          {cashflowData.length > 0 ? (
            <div className="h-64 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cashflowData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs fill-gray-600 dark:fill-gray-400"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    className="text-xs fill-gray-600 dark:fill-gray-400"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'var(--tooltip-bg)',
                      border: '1px solid var(--tooltip-border)',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                    formatter={(value, name) => [`$${value.toLocaleString()}`, name]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="income" 
                    stroke="#10B981" 
                    strokeWidth={2} 
                    name="Income"
                    dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="expenses" 
                    stroke="#EF4444" 
                    strokeWidth={2} 
                    name="Expenses"
                    dot={{ fill: '#EF4444', strokeWidth: 2, r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="net" 
                    stroke="#3B82F6" 
                    strokeWidth={2} 
                    name="Net"
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 sm:h-80 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm sm:text-base">
              No transaction data available for cashflow analysis
            </div>
          )}
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <div className="mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Recent Transactions</h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Your latest financial activity</p>
        </div>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="min-w-full">
            <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Account
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {allTransactions && allTransactions
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 10)
                .map(txn => (
                <tr key={`${txn.transaction_id || txn.id}-${txn.source || 'plaid'}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white">
                    {txn.date}
                  </td>
                  <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white">
                    <div className="truncate max-w-32 sm:max-w-none">
                      {txn.name || txn.payee_name || 'Unknown Transaction'}
                      {txn.source === 'ynab' && (
                        <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">(YNAB)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                    ${Math.abs(txn.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    <div className="truncate max-w-24 sm:max-w-none">
                      {allAccounts.find(acc => (acc.account_id || acc.id) === txn.account_id)?.name || txn.account_id}
                    </div>
                  </td>
                </tr>
              ))}
              {(!allTransactions || allTransactions.length === 0) && (
                <tr>
                  <td colSpan="4" className="px-3 sm:px-6 py-4 text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    No transactions available
                  </td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
        </div>
      </Card>

      <ManualAccountModal 
        user={user} 
        show={showManualModal} 
        onClose={() => setShowManualModal(false)} 
        onAccountAdded={() => {
          // React Query will automatically invalidate and refetch
          setShowManualModal(false);
        }} 
      />
      </div>
    </PageTransition>
  );
}