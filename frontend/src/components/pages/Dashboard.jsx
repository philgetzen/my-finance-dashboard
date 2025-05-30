import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { useYNAB, usePrivacy } from '../../contexts/YNABDataContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ManualAccountModal from '../ui/ManualAccountModal';
import YNABConnectionCard from '../ui/YNABConnectionCard';
import { DashboardSkeleton } from '../ui/Skeleton';
import PageTransition from '../ui/PageTransition';
import YNABConnectionErrorModal from '../ui/YNABConnectionErrorModal';
import { getAccountBalance, getTransactionAmount, normalizeYNABAccountType } from '../../utils/ynabHelpers';
import { formatCurrency, isLiability, mapAccountType, getDisplayAccountType } from '../../utils/formatters';
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
  const isExpense = amount < 0; 
  
  return (
    <div className="glass-chart p-4 rounded-lg hover:scale-[1.02] transition-all duration-200">
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
        <p className={`font-semibold text-sm ${isExpense ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'} ${isPrivacyMode ? 'privacy-blur' : ''}`}>
          {isExpense ? '-' : '+'}${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
    refetch,
    showYNABErrorModal,
    setShowYNABErrorModal,
    ynabError
  } = useYNAB();
  const { isPrivacyMode } = usePrivacy();
  
  const [showManualModal, setShowManualModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Detect mobile screen
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Combine YNAB accounts and manual accounts
  const allAccounts = [...(ynabAccounts || []), ...(manualAccounts || [])];
  const allTransactions = ynabTransactions || [];

  const handleYNABConnect = async (accessToken, refreshToken) => {
    await saveYNABToken(accessToken, refreshToken);
    setTimeout(() => {
      refetch();
    }, 200);
  };

  const liabilityTypes = ['credit', 'loan', 'mortgage', 'credit_card', 'creditCard'];
  
  const isAccountLiability = (account) => {
    const type = mapAccountType(account.type);
    return liabilityTypes.some(liability => type?.includes(liability)) || type === 'credit' || isLiability(account);
  };
  
  const netWorth = allAccounts.reduce((sum, acc) => {
    const bal = getAccountBalance(acc);
    return isAccountLiability(acc) ? sum - Math.abs(bal) : sum + bal;
  }, 0);

  const totalAssets = allAccounts.reduce((sum, acc) => {
    const bal = getAccountBalance(acc);
    return !isAccountLiability(acc) ? sum + bal : sum;
  }, 0);

  const totalLiabilities = allAccounts.reduce((sum, acc) => {
    const bal = getAccountBalance(acc);
    return isAccountLiability(acc) ? sum + Math.abs(bal) : sum;
  }, 0);

  const assetAccounts = allAccounts.filter(account => !isAccountLiability(account));
  const allocation = Object.values(assetAccounts.reduce((acc, account) => {
    const type = getDisplayAccountType(account.type);
    const balance = getAccountBalance(account);
    if (balance > 0) { 
      acc[type] = acc[type] || { name: type, value: 0 };
      acc[type].value += balance; 
    }
    return acc;
  }, {})).filter(item => item.value > 0);

  // Identify investment account IDs to exclude their transactions from income/expense
  const investmentAccountIds = new Set(
    allAccounts
      .filter(acc => mapAccountType(acc.type) === 'investment')
      .map(acc => acc.id || acc.account_id)
      .filter(id => id)
  );

  // Define income categories based on YNAB report structure
  const ynabReportIncomeCategories = [
    "Inflow: Ready to Assign",
    "Adjustment", "Amazon", "Apple", "Bank of America Mobile", "Barry Getzen",
    "Deposit Mobile Banking", "Disney", "eCheck Deposit", "Gemini", "Interest Income",
    "Interest Paid",
    "Merrill Lynch Funds Transfer",
    "Mspbna Transfer",
    "Nanoleaf", "Next Brick Prope", "Next Brick Prope Sigonfile",
    "Paid Leave Wa Future Amount Tran Ddir", "Venmo"
  ];

  const debtPaymentCategoriesNamedAsTransfers = ["8331 Mortgage", "Kia Loan"];

  // Process cashflow data for line chart
  const processCashflowData = () => {
    if (!allTransactions.length) return [];
    
    const last6Months = {};
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = date.toISOString().slice(0, 7);
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      last6Months[key] = { month: monthName, income: 0, expenses: 0, net: 0 };
    }
    
    const processSingleTransaction = (txn, monthData, accountId) => {
      if (investmentAccountIds.has(accountId)) {
        return;
      }
      
      const isPayeeIndicatedTransfer = txn.payee_name && txn.payee_name.toLowerCase().startsWith("transfer : ");
      const isCategorizedDebtPayment = debtPaymentCategoriesNamedAsTransfers.includes(txn.category_name);

      if (txn.transfer_account_id || (isPayeeIndicatedTransfer && !isCategorizedDebtPayment)) {
        return;
      }
      
      if (txn.payee_name === 'Reconciliation Balance Adjustment' || txn.payee_name === 'Starting Balance') {
        return;
      }

      const rawAmount = getTransactionAmount(txn); 

      if (ynabReportIncomeCategories.includes(txn.category_name)) {
        monthData.income += rawAmount; 
      } else {
        if (txn.category_name || rawAmount < 0) { 
          monthData.expenses -= rawAmount; 
        }
      }
    };

    allTransactions.forEach(transaction => {
      const transactionDate = new Date(transaction.date);
      const monthKey = transactionDate.toISOString().slice(0, 7);

      if (last6Months[monthKey]) {
        if (transaction.subtransactions && transaction.subtransactions.length > 0) {
          transaction.subtransactions.forEach(subTxn => {
            const effectivePayeeName = subTxn.payee_name || transaction.payee_name;
            const subTransactionForProcessing = { ...subTxn, payee_name: effectivePayeeName };
            processSingleTransaction(subTransactionForProcessing, last6Months[monthKey], transaction.account_id);
          });
        } else {
          processSingleTransaction(transaction, last6Months[monthKey], transaction.account_id);
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
    
    const processSingleTransactionForIncomeExpense = (txn, monthData, accountId) => {
        if (investmentAccountIds.has(accountId)) {
            return;
        }

        const isPayeeIndicatedTransfer = txn.payee_name && txn.payee_name.toLowerCase().startsWith("transfer : ");
        const isCategorizedDebtPayment = debtPaymentCategoriesNamedAsTransfers.includes(txn.category_name);

        if (txn.transfer_account_id || (isPayeeIndicatedTransfer && !isCategorizedDebtPayment)) {
            return;
        }
        
        if (txn.payee_name === 'Reconciliation Balance Adjustment' || txn.payee_name === 'Starting Balance') {
            return;
        }

        const rawAmount = getTransactionAmount(txn);

        if (ynabReportIncomeCategories.includes(txn.category_name)) {
            monthData.income += rawAmount; 
        } else {
            if (txn.category_name || rawAmount < 0) { 
                monthData.expenses -= rawAmount; 
            }
        }
    };

    allTransactions.forEach(transaction => {
      const transactionDate = new Date(transaction.date);
      const monthKey = transactionDate.toISOString().slice(0, 7);

      if (last6Months[monthKey]) {
        if (transaction.subtransactions && transaction.subtransactions.length > 0) {
          transaction.subtransactions.forEach(subTxn => {
            const effectivePayeeName = subTxn.payee_name || transaction.payee_name;
            const subTransactionForProcessing = { ...subTxn, payee_name: effectivePayeeName };
            processSingleTransactionForIncomeExpense(subTransactionForProcessing, last6Months[monthKey], transaction.account_id);
          });
        } else {
          processSingleTransactionForIncomeExpense(transaction, last6Months[monthKey], transaction.account_id);
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
      <div className="w-full max-w-none space-y-6 pb-4">
        {/* Header with glassmorphism */}
        <div className="glass-hero p-6 rounded-2xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 glass-card-blue rounded-xl flex items-center justify-center glow-blue">
              <HomeIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                Financial Dashboard
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1">
                Your complete financial overview
              </p>
            </div>
          </div>
          
          {/* Quick actions */}
          <div className="flex gap-3 overflow-x-auto pb-2">
            {user && (
              <>
                <Button
                  variant="outline"
                  onClick={refetch}
                  className="glass-button flex items-center gap-2 text-sm whitespace-nowrap"
                  size="sm"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowManualModal(true)}
                  size="sm"
                  className="glass-button whitespace-nowrap"
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
          <div className="glass-card p-4 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
            {error.message || 'Failed to load data'}
          </div>
        )}

        {!ynabToken && (
          <div className="glass-card p-4 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400">
            <div className="flex items-center">
              <LinkIcon className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>Connect your YNAB account to see your financial data</span>
            </div>
          </div>
        )}

        {/* Key Metrics with glassmorphism */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Net Worth</p>
                <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} ${isPrivacyMode ? 'privacy-blur' : ''}`}>
                  ${formatCurrency(netWorth)}
                </p>
              </div>
              <div className="w-12 h-12 glass-card-blue rounded-xl flex items-center justify-center glow-blue">
                <ScaleIcon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Assets</p>
                <p className={`text-2xl font-bold text-green-600 dark:text-green-400 ${isPrivacyMode ? 'privacy-blur' : ''}`}>
                  ${formatCurrency(totalAssets)}
                </p>
              </div>
              <div className="w-12 h-12 glass-card-green rounded-xl flex items-center justify-center glow-emerald">
                <ArrowTrendingUpIcon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Liabilities</p>
                <p className={`text-2xl font-bold text-red-600 dark:text-red-400 ${isPrivacyMode ? 'privacy-blur' : ''}`}>
                  ${formatCurrency(totalLiabilities)}
                </p>
              </div>
              <div className="w-12 h-12 glass-card-red rounded-xl flex items-center justify-center">
                <ArrowTrendingDownIcon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section with glassmorphism */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Asset Allocation */}
          <div className="glass-card p-6">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 glass-card-purple rounded-lg flex items-center justify-center glow-purple mr-3">
                <ChartPieIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Asset Allocation</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Portfolio breakdown</p>
              </div>
            </div>
            
            {allocation.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocation}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={isMobile ? "70%" : "80%"}
                      label={false}
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth={2}
                    >
                      {allocation.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value, name) => {
                      if (isPrivacyMode) return ['***', name];
                      return [`$${formatCurrency(value)}`, name];
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
              <div className="h-80 flex items-center justify-center glass-chart rounded-lg">
                <div className="text-center">
                  <ChartPieIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No allocation data available</p>
                </div>
              </div>
            )}
          </div>

          {/* Account Summary */}
          <div className="glass-card p-6">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 glass-card-gold rounded-lg flex items-center justify-center glow-gold mr-3">
                <BanknotesIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Account Summary</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">All accounts overview</p>
              </div>
            </div>
            
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {/* Assets */}
              {allAccounts.filter(acc => !isAccountLiability(acc) && getAccountBalance(acc) !== 0).sort((a,b) => getAccountBalance(b) - getAccountBalance(a)).map((account, index) => (
                <div key={account.id || account.account_id || `asset-${index}`} className="glass-chart p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className="w-3 h-3 rounded-full mr-3"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {account.name} ({getDisplayAccountType(account.type)})
                        </span>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold text-green-600 dark:text-green-400 ${isPrivacyMode ? 'privacy-blur' : ''}`}>
                      ${formatCurrency(getAccountBalance(account))}
                    </span>
                  </div>
                </div>
              ))}

              {/* Spacer if both assets and liabilities exist */}
              {allAccounts.filter(acc => !isAccountLiability(acc) && getAccountBalance(acc) !== 0).length > 0 && 
               allAccounts.filter(acc => isAccountLiability(acc) && getAccountBalance(acc) !== 0).length > 0 && (
                <hr className="my-3 border-gray-200 dark:border-gray-600" />
              )}

              {/* Liabilities */}
              {allAccounts.filter(acc => isAccountLiability(acc) && getAccountBalance(acc) !== 0).sort((a,b) => getAccountBalance(b) - getAccountBalance(a)).map((account, index) => (
                <div key={account.id || account.account_id || `liability-${index}`} className="glass-chart p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className="w-3 h-3 rounded-full mr-3"
                        style={{ backgroundColor: COLORS[(allAccounts.filter(acc => !isAccountLiability(acc)).length + index) % COLORS.length] }}
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {account.name} ({getDisplayAccountType(account.type)})
                        </span>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold text-red-600 dark:text-red-400 ${isPrivacyMode ? 'privacy-blur' : ''}`}>
                      -${formatCurrency(Math.abs(getAccountBalance(account)))}
                    </span>
                  </div>
                </div>
              ))}
              
              {allAccounts.filter(acc => getAccountBalance(acc) !== 0).length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <ChartPieIcon className="mx-auto h-8 w-8 mb-3" />
                  <p className="text-sm">No accounts with balances</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Income vs Expenses Chart */}
        <div className="glass-card p-6">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 glass-card-emerald rounded-lg flex items-center justify-center glow-emerald mr-3">
              <ChartBarIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Income vs Expenses</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Monthly cash flow analysis</p>
            </div>
          </div>
          
          {incomeExpensesData.length > 0 ? (
            <div className="h-64 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeExpensesData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    interval={isMobile ? 1 : 0}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
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
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="expenses" 
                    fill="#EF4444" 
                    name="Expenses"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center glass-chart rounded-lg">
              <div className="text-center">
                <ChartBarIcon className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No transaction data available</p>
              </div>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="glass-card p-6">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 glass-card-purple rounded-lg flex items-center justify-center glow-purple mr-3">
              <CreditCardIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Transactions</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Latest financial activity</p>
            </div>
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
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Account</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {allTransactions && allTransactions
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .slice(0, 10)
                    .map(txn => (
                    <tr key={`${txn.transaction_id || txn.id}-${txn.source || 'plaid'}`} className="hover:bg-white/5">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {txn.date}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {txn.name || txn.payee_name || 'Unknown Transaction'}
                        {txn.source === 'ynab' && (
                          <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">(YNAB)</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium text-right ${getTransactionAmount(txn) < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'} ${isPrivacyMode ? 'privacy-blur' : ''}`}>
                        {getTransactionAmount(txn) < 0 ? '-' : '+'}${Math.abs(getTransactionAmount(txn)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        </div>

        <ManualAccountModal 
          user={user} 
          show={showManualModal} 
          onClose={() => setShowManualModal(false)} 
          onAccountAdded={() => {
            setShowManualModal(false);
          }} 
        />
        
        <YNABConnectionErrorModal
          show={showYNABErrorModal}
          onClose={() => setShowYNABErrorModal(false)}
          onReconnect={async (accessToken, refreshToken) => {
            await saveYNABToken(accessToken, refreshToken);
            setShowYNABErrorModal(false);
            setTimeout(() => {
              refetch();
            }, 200);
          }}
          error={ynabError}
        />
      </div>
    </PageTransition>
  );
}