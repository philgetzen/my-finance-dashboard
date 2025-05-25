import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { usePlaid } from '../../contexts/PlaidDataContext';
import { useCombinedFinanceData } from '../../hooks/useCombinedFinanceData';
import Card from '../ui/Card';
import LoadingSpinner from '../ui/LoadingSpinner';
import PageTransition from '../ui/PageTransition';
import {
  EyeIcon,
  ChartBarIcon,
  ChartPieIcon,
} from '@heroicons/react/24/outline';

const COLORS = ['#3B82F6', '#8B5CF6', '#EF4444', '#10B981', '#F59E0B', '#06B6D4'];

export default function Snapshot() {
  const { user } = usePlaid();
  const { accounts, transactions, isLoading, isError, error } = useCombinedFinanceData(user?.uid);


  const allAccounts = accounts || [];
  const liabilityTypes = ['credit', 'loan', 'mortgage'];
  
  const netWorth = allAccounts.reduce((sum, acc) => {
    const bal = acc.balances?.current ?? acc.balance ?? 0;
    return liabilityTypes.includes(acc.type) || (acc.subtype && liabilityTypes.includes(acc.subtype))
      ? sum - Math.abs(bal) : sum + bal;
  }, 0);

  const allocation = Object.values(allAccounts.reduce((acc, account) => {
    const type = account.type || 'other';
    const balance = typeof account.balances?.current === 'number' ? account.balances.current : (typeof account.balance === 'number' ? account.balance : 0);
    acc[type] = acc[type] || { name: type.charAt(0).toUpperCase() + type.slice(1), value: 0 };
    acc[type].value += Math.abs(balance);
    return acc;
  }, {})).filter(item => item.value > 0);

  // Process income vs expenses data for last 6 months
  const processIncomeExpensesData = () => {
    if (!transactions?.length) return [];
    
    const last6Months = {};
    const today = new Date();
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = date.toISOString().slice(0, 7); // YYYY-MM format
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      last6Months[key] = { month: monthName, income: 0, expenses: 0 };
    }
    
    // Process transactions
    transactions.forEach(transaction => {
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
    
    return Object.values(last6Months);
  };

  const incomeExpensesData = processIncomeExpensesData();

  if (isLoading && !accounts && !isError) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="w-full max-w-none space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Error Display */}
      {isError && error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 sm:p-4 rounded-lg text-sm sm:text-base">
          Error: {error?.message || 'Failed to load data'}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <EyeIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Financial Snapshot</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Your financial overview at a glance</p>
        </div>
      </div>

      {/* Net Worth Hero */}
      <Card className="text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <ChartBarIcon className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
          </div>
        </div>
        <h2 className="text-base sm:text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">Total Net Worth</h2>
        <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
          ${netWorth.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </p>
        <div className="flex items-center justify-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          <span className="mr-2">•</span>
          <span>Updated just now</span>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        {/* Asset Allocation Chart */}
        <Card>
          <div className="mb-6">
            <div className="flex items-center">
              <ChartPieIcon className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Asset Allocation</h3>
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
                    formatter={(value) => [`$${value.toLocaleString()}`, 'Value']}
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
            <div className="h-64 sm:h-80 flex items-center justify-center text-sm sm:text-base text-gray-500 dark:text-gray-400">
              No allocation data available
            </div>
          )}
        </Card>

        {/* Account Summary */}
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
                <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                  ${item.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
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

      {/* Income vs Expenses Chart */}
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
      </div>
    </PageTransition>
  );
}