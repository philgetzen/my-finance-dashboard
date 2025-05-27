import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { useYNAB, usePrivacy } from '../../contexts/YNABDataContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ManualAccountModal from '../ui/ManualAccountModal';
import YNABConnectionCard from '../ui/YNABConnectionCard';
import { DashboardSkeleton } from '../ui/Skeleton';
import PageTransition from '../ui/PageTransition';
import { getAccountBalance, getTransactionAmount, normalizeYNABAccountType } from '../../utils/ynabHelpers';
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
    disconnectYNAB,
    refetch
  } = useYNAB();
  const { isPrivacyMode } = usePrivacy();
  
  const [showManualModal, setShowManualModal] = useState(false);
  
  // Combine YNAB accounts and manual accounts
  const allAccounts = [...(ynabAccounts || []), ...(manualAccounts || [])];
  const allTransactions = ynabTransactions || [];

  // Helper functions for account processing
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

  const formatCurrency = (amount) => {
    return `${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleYNABConnect = async (accessToken, refreshToken) => {
    await saveYNABToken(accessToken, refreshToken);
    refetch();
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
    const bal = getAccountBalance(acc);
    return isLiability(acc) ? sum - Math.abs(bal) : sum + bal;
  }, 0);

  const totalAssets = allAccounts.reduce((sum, acc) => {
    const bal = getAccountBalance(acc);
    return !isLiability(acc) ? sum + bal : sum;
  }, 0);

  const totalLiabilities = allAccounts.reduce((sum, acc) => {
    const bal = getAccountBalance(acc);
    return isLiability(acc) ? sum + Math.abs(bal) : sum;
  }, 0);

  const allocation = Object.values(allAccounts.reduce((acc, account) => {
    const type = getDisplayAccountType(account.type);
    const balance = getAccountBalance(account);
    acc[type] = acc[type] || { name: type, value: 0 };
    acc[type].value += Math.abs(balance);
    return acc;
  }, {})).filter(item => item.value > 0);

  // Process cashflow data for line chart
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
    
    // Process transactions - YNAB transactions have different structure
    allTransactions.forEach(transaction => {
      const transactionDate = new Date(transaction.date);
      const monthKey = transactionDate.toISOString().slice(0, 7);
      
      if (last6Months[monthKey]) {
        // YNAB transactions: positive amounts are outflows (expenses), negative are inflows (income)
        // Convert from milliunits if it's a YNAB transaction
        const rawAmount = getTransactionAmount(transaction);
        
        if (rawAmount > 0) {
          // Positive amount = expense (outflow)
          last6Months[monthKey].expenses += rawAmount;
        } else {
          // Negative amount = income (inflow)
          last6Months[monthKey].income += Math.abs(rawAmount);
        }
      }
    });
    
    // Calculate net and return array
    return Object.values(last6Months).map(month => ({
      ...month,
      net: month.income - month.expenses
    }));
  };

  // Process income vs expenses data for bar chart (from Snapshot)
  const processIncomeExpensesData = () => {
    if (!allTransactions.length) return [];
    
    const last6Months = {};
    const today = new Date();
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = date.toISOString().slice(0, 7); // YYYY-MM format
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      last6Months[key] = { month: monthName, income: 0, expenses: 0 };
    }
    
    // Process transactions - YNAB transactions have different structure
    allTransactions.forEach(transaction => {
      const transactionDate = new Date(transaction.date);
      const monthKey = transactionDate.toISOString().slice(0, 7);
      
      if (last6Months[monthKey]) {
        // YNAB transactions: positive amounts are outflows (expenses), negative are inflows (income)
        const rawAmount = getTransactionAmount(transaction);
        
        if (rawAmount > 0) {
          // Positive amount = expense (outflow)
          last6Months[monthKey].expenses += rawAmount;
        } else {
          // Negative amount = income (inflow)
          last6Months[monthKey].income += Math.abs(rawAmount);
        }
      }
    });
    
    return Object.values(last6Months);
  };

  const cashflowData = processCashflowData();
  const incomeExpensesData = processIncomeExpensesData();

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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white text-left">Dashboard</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 text-left">Track your financial health at a glance</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          {user && (
            <>
              <Button
                variant="outline"
                onClick={refetch}
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
                isConnected={!!ynabToken} 
                compact={true}
              />
            </>
          )}
        </div>
      </div>

      {/* Error Messages */}
      {error && ynabToken && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 sm:p-4 rounded-lg text-sm sm:text-base">
          {error.message || 'Failed to load data'}
        </div>
      )}

      {/* YNAB Connection Status */}
      {!ynabToken && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 p-3 sm:p-4 rounded-lg text-sm sm:text-base">
          <div className="flex items-center">
            <LinkIcon className="h-5 w-5 mr-2" />
            <span>Connect your YNAB account to see your financial data</span>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                    <ScaleIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Net Worth</p>
              <p className={`text-xl sm:text-2xl font-bold ${netWorth > 0 ? 'text-green-600 dark:text-green-400' : netWorth < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                ${netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <ArrowTrendingUpIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Assets</p>
              <p className={`text-xl sm:text-2xl font-bold ${totalAssets > 0 ? 'text-green-600 dark:text-green-400' : totalAssets < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                ${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                    <ArrowTrendingDownIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Liabilities</p>
              <p className={`text-xl sm:text-2xl font-bold ${totalLiabilities > 0 ? 'text-red-600 dark:text-red-400' : totalLiabilities < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                ${totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        <Card>
          <div className="mb-6">
            <div className="flex items-center justify-center">
              <ChartPieIcon className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2 justify-center" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white text-center">Asset Allocation</h3>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">Breakdown by account type</p>
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
                    formatter={(value, name) => {
                      if (isPrivacyMode) {
                        return ['***', name]; // Hide values in privacy mode
                      }
                      return [`${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name];
                    }}
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

        {/* Account Summary - from Snapshot */}
        <Card>
          <div className="mb-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Account Summary</h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">Quick overview of all accounts</p>
          </div>
          
          <div className="space-y-3 sm:space-y-4">
            {allocation.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 rounded-full mr-3"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">{item.name}</span>
                </div>
                <span className={`text-sm sm:text-base font-semibold ${item.value > 0 ? 'text-green-600 dark:text-green-400' : item.value < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                  ${item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            ))}
            
            {allocation.length === 0 && (
              <div className="text-center py-6 sm:py-8 text-gray-500 dark:text-gray-400">
                <ChartPieIcon className="mx-auto h-8 sm:h-12 w-8 sm:w-12 mb-4" />
                <p className="text-sm sm:text-base">No accounts connected</p>
                <p className="text-xs sm:text-sm">Connect your accounts to see your financial snapshot</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Income vs Expenses Chart - from Snapshot */}
      <Card>
        <div className="mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Income vs Expenses</h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">Monthly cash flow analysis</p>
        </div>
        {incomeExpensesData.length > 0 ? (
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeExpensesData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="month" 
                  className="text-xs fill-gray-600 dark:fill-gray-400"
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  className="text-xs fill-gray-600 dark:fill-gray-400"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg)',
                    border: '1px solid var(--tooltip-border)',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                  formatter={(value, name) => {
                    if (isPrivacyMode) {
                      return ['***', name]; // Hide values in privacy mode
                    }
                    return [`${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name];
                  }}
                />
                <Bar 
                  dataKey="income" 
                  fill="#10B981" 
                  name="Income"
                  radius={[2, 2, 0, 0]}
                />
                <Bar 
                  dataKey="expenses" 
                  fill="#EF4444" 
                  name="Expenses"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 sm:h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-center">
              <ChartBarIcon className="mx-auto h-8 sm:h-12 w-8 sm:w-12 text-gray-400 mb-4" />
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">No transaction data available</p>
              <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-1">
                Connect accounts to see income and expenses
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Cash Flow Trends */}
      <Card>
        <div className="mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Cash Flow Trends</h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Income vs expenses trend over time</p>
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
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg)',
                    border: '1px solid var(--tooltip-border)',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                  formatter={(value, name) => {
                    if (isPrivacyMode) {
                      return ['***', name]; // Hide values in privacy mode
                    }
                    return [`${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name];
                  }}
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

      {/* Recent Transactions */}
      <Card>
        <div className="mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white text-left">Recent Transactions</h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-left">Your latest financial activity</p>
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
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
                  <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white text-left">
                    <div className="truncate max-w-32 sm:max-w-none">
                      {txn.name || txn.payee_name || 'Unknown Transaction'}
                      {txn.source === 'ynab' && (
                        <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">(YNAB)</span>
                      )}
                    </div>
                  </td>
                  <td className={`px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-right ${getTransactionAmount(txn) > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                    ${getTransactionAmount(txn) < 0 ? '-' : ''}${Math.abs(getTransactionAmount(txn)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    <div className="truncate max-w-24 sm:max-w-none text-left">
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