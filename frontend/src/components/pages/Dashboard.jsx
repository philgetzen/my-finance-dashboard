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

// Mobile-friendly transaction card component
const TransactionCard = ({ transaction, account, isPrivacyMode }) => {
  const amount = getTransactionAmount(transaction);
  const isExpense = amount > 0;
  
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 mr-3">
          <p className="font-medium text-gray-900 dark:text-white text-sm">
            {transaction.name || transaction.payee_name || 'Unknown Transaction'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {account?.name || transaction.account_id}
            {transaction.source === 'ynab' && (
              <span className="ml-2 text-purple-600 dark:text-purple-400">(YNAB)</span>
            )}
          </p>
        </div>
        <p className={`font-semibold text-sm ${isExpense ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'} ${isPrivacyMode ? 'filter blur' : ''}`}>
          ${isExpense ? '-' : '+'}${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {new Date(transaction.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>
    </div>
  );
};

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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Detect mobile screen
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
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
    setTimeout(() => {
      refetch();
    }, 200);
  };

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
      const key = date.toISOString().slice(0, 7);
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      last6Months[key] = { month: monthName, income: 0, expenses: 0, net: 0 };
    }
    
    allTransactions.forEach(transaction => {
      const transactionDate = new Date(transaction.date);
      const monthKey = transactionDate.toISOString().slice(0, 7);
      
      if (last6Months[monthKey]) {
        const rawAmount = getTransactionAmount(transaction);
        
        if (rawAmount > 0) {
          last6Months[monthKey].expenses += rawAmount;
        } else {
          last6Months[monthKey].income += Math.abs(rawAmount);
        }
      }
    });
    
    return Object.values(last6Months).map(month => ({
      ...month,
      net: month.income - month.expenses
    }));
  };

  // Process income vs expenses data for bar chart
  const processIncomeExpensesData = () => {
    if (!allTransactions.length) return [];
    
    const last6Months = {};
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = date.toISOString().slice(0, 7);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      last6Months[key] = { month: monthName, income: 0, expenses: 0 };
    }
    
    allTransactions.forEach(transaction => {
      const transactionDate = new Date(transaction.date);
      const monthKey = transactionDate.toISOString().slice(0, 7);
      
      if (last6Months[monthKey]) {
        const rawAmount = getTransactionAmount(transaction);
        
        if (rawAmount > 0) {
          last6Months[monthKey].expenses += rawAmount;
        } else {
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
      <div className="w-full max-w-none space-y-4 pb-4">
        {/* Header - Mobile Optimized */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <HomeIcon className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Track your financial health</p>
            </div>
          </div>
          
          {/* Mobile Actions */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {user && (
              <>
                <Button
                  variant="outline"
                  onClick={refetch}
                  className="flex items-center gap-2 text-sm whitespace-nowrap"
                  size="sm"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowManualModal(true)}
                  size="sm"
                  className="whitespace-nowrap"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Account
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

        {/* Error/Status Messages */}
        {error && ynabToken && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm">
            {error.message || 'Failed to load data'}
          </div>
        )}

        {!ynabToken && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 p-3 rounded-lg text-sm">
            <div className="flex items-center">
              <LinkIcon className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>Connect your YNAB account to see your financial data</span>
            </div>
          </div>
        )}

        {/* Key Metrics - Mobile Optimized */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Net Worth</p>
                <p className={`text-lg sm:text-xl font-bold mt-1 ${netWorth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                  ${formatCurrency(netWorth)}
                </p>
              </div>
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <ScaleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Total Assets</p>
                <p className={`text-lg sm:text-xl font-bold mt-1 text-green-600 dark:text-green-400 ${isPrivacyMode ? 'filter blur' : ''}`}>
                  ${formatCurrency(totalAssets)}
                </p>
              </div>
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <ArrowTrendingUpIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Total Liabilities</p>
                <p className={`text-lg sm:text-xl font-bold mt-1 text-red-600 dark:text-red-400 ${isPrivacyMode ? 'filter blur' : ''}`}>
                  ${formatCurrency(totalLiabilities)}
                </p>
              </div>
              <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                <ArrowTrendingDownIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </Card>
        </div>

        {/* Charts Section - Mobile Optimized */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Asset Allocation */}
          <Card className="p-4">
            <div className="mb-4">
              <div className="flex items-center">
                <ChartPieIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Asset Allocation</h3>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Breakdown by account type</p>
            </div>
            {allocation.length > 0 ? (
              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 0, bottom: 40, left: 0 }}>
                    <Pie
                      data={allocation}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      outerRadius={isMobile ? "70%" : "60%"}
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
                        if (isPrivacyMode) return ['***', name];
                        return [`$${formatCurrency(value)}`, name];
                      }}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                No allocation data available
              </div>
            )}
          </Card>

          {/* Account Summary */}
          <Card className="p-4">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Account Summary</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Quick overview of all accounts</p>
            </div>
            
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {allocation.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</span>
                  </div>
                  <span className={`text-sm font-semibold text-green-600 dark:text-green-400 ${isPrivacyMode ? 'filter blur' : ''}`}>
                    ${formatCurrency(item.value)}
                  </span>
                </div>
              ))}
              
              {allocation.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <ChartPieIcon className="mx-auto h-8 w-8 mb-3" />
                  <p className="text-sm">No accounts connected</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Income vs Expenses Chart */}
        <Card className="p-4">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Income vs Expenses</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Monthly cash flow analysis</p>
          </div>
          {incomeExpensesData.length > 0 ? (
            <div className="h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeExpensesData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 10 }}
                    interval={isMobile ? 1 : 0}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }}
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
                      if (isPrivacyMode) return ['***', name];
                      return [`$${formatCurrency(value)}`, name];
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
            <div className="h-48 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-center">
                <ChartBarIcon className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No transaction data available</p>
              </div>
            </div>
          )}
        </Card>

        {/* Recent Transactions - Mobile Optimized */}
        <Card className="p-4">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Recent Transactions</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">Your latest financial activity</p>
          </div>
          
          {/* Mobile: Card Layout, Desktop: Table */}
          {isMobile ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {allTransactions && allTransactions
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 10)
                .map(txn => (
                  <TransactionCard 
                    key={`${txn.transaction_id || txn.id}-${txn.source || 'plaid'}`}
                    transaction={txn}
                    account={allAccounts.find(acc => (acc.account_id || acc.id) === txn.account_id)}
                    isPrivacyMode={isPrivacyMode}
                  />
                ))}
              {(!allTransactions || allTransactions.length === 0) && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p className="text-sm">No transactions available</p>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Account</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {allTransactions && allTransactions
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .slice(0, 10)
                    .map(txn => (
                    <tr key={`${txn.transaction_id || txn.id}-${txn.source || 'plaid'}`}>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {txn.date}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {txn.name || txn.payee_name || 'Unknown Transaction'}
                        {txn.source === 'ynab' && (
                          <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">(YNAB)</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium text-right ${getTransactionAmount(txn) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                        ${getTransactionAmount(txn) > 0 ? '-' : '+'}${Math.abs(getTransactionAmount(txn)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {allAccounts.find(acc => (acc.account_id || acc.id) === txn.account_id)?.name || txn.account_id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!allTransactions || allTransactions.length === 0) && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p className="text-sm">No transactions available</p>
                </div>
              )}
            </div>
          )}
        </Card>

        <ManualAccountModal 
          user={user} 
          show={showManualModal} 
          onClose={() => setShowManualModal(false)} 
          onAccountAdded={() => {
            setShowManualModal(false);
          }} 
        />
      </div>
    </PageTransition>
  );
}