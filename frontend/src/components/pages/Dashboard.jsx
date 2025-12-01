import React, { useState, useEffect, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Legend
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
import { formatCurrency, isLiability, getDisplayAccountType, isEffectivelyZero } from '../../utils/formatters';
import { useTransactionProcessor, getMonthlyRangeData } from '../../hooks/useTransactionProcessor';
import {
  BanknotesIcon,
  CreditCardIcon,
  ChartBarIcon,
  PlusIcon,
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ScaleIcon,
  ChartPieIcon,
  LinkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

// Mixpanel-inspired chart colors - purple first
const COLORS = ['#8B5CF6', '#F97316', '#3B82F6', '#10B981', '#EC4899', '#14B8A6'];

// Memoized components for better performance
const MetricCard = React.memo(({ title, value, icon: Icon, trend, color, isPrivacyMode }) => (
  <Card className="p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</p>
        <PrivacyCurrency
          amount={value}
          isPrivacyMode={isPrivacyMode}
          className={`text-2xl font-bold ${color}`}
        />
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
        trend === 'up' ? 'bg-emerald-50 dark:bg-emerald-900/30' :
        trend === 'down' ? 'bg-red-50 dark:bg-red-900/30' :
        'bg-violet-50 dark:bg-violet-900/30'
      }`}>
        <Icon className={`h-6 w-6 ${
          trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' :
          trend === 'down' ? 'text-red-500 dark:text-red-400' :
          'text-violet-600 dark:text-violet-400'
        }`} />
      </div>
    </div>
  </Card>
));

MetricCard.displayName = 'MetricCard';

// Collapsible section for progressive disclosure
const CollapsibleSection = React.memo(({ title, subtitle, icon: Icon, defaultOpen = false, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden" padding={false}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex items-center justify-between bg-white dark:bg-[var(--color-surface)] hover:bg-gray-50 dark:hover:bg-[#252a2f] transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="h-5 w-5 text-violet-500" />}
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
            {subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {isOpen ? (
          <ChevronUpIcon className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDownIcon className="h-5 w-5 text-gray-400" />
        )}
      </button>
      <div
        className={`transition-all duration-300 ease-in-out bg-white dark:bg-[var(--color-surface)] ${
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}
      >
        <div className="px-6 pb-6 border-t border-gray-100 dark:border-gray-700">
          <div className="pt-4">
            {children}
          </div>
        </div>
      </div>
    </Card>
  );
});

CollapsibleSection.displayName = 'CollapsibleSection';

// Time period options matching YNAB
const TIME_PERIODS = [
  { key: 'this-month', label: 'This Month', months: 1 },
  { key: 'last-3-months', label: 'Last 3 Months', months: 3 },
  { key: 'last-6-months', label: 'Last 6 Months', months: 6 },
  { key: 'last-12-months', label: 'Last 12 Months', months: 12 },
  { key: 'ytd', label: 'Year To Date', months: null },
  { key: 'last-year', label: 'Last Year', months: null },
  { key: 'all', label: 'All Dates', months: null },
];

// Time Period Selector component
const TimePeriodSelector = React.memo(({ selectedPeriod, onPeriodChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = TIME_PERIODS.find(p => p.key === selectedPeriod) || TIME_PERIODS[2];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <CalendarIcon className="h-4 w-4" />
        <span>{selectedOption.label}</span>
        <ChevronDownIcon className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#23272b] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 py-1"
          >
            {TIME_PERIODS.map(period => (
              <button
                key={period.key}
                onClick={() => {
                  onPeriodChange(period.key);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${
                  selectedPeriod === period.key
                    ? 'text-violet-600 dark:text-violet-400 font-medium bg-violet-50 dark:bg-violet-900/20'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {period.label}
                {selectedPeriod === period.key && (
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
});

TimePeriodSelector.displayName = 'TimePeriodSelector';

// Hero metric component for primary focus
const HeroMetric = React.memo(({ value, label, trend, change, isPrivacyMode }) => (
  <Card className="p-8 bg-gradient-to-br from-violet-500 to-violet-600 dark:from-violet-600 dark:to-violet-700 text-white">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <p className="text-violet-100 text-sm font-medium uppercase tracking-wider mb-2">
          {label}
        </p>
        <PrivacyCurrency
          amount={value}
          isPrivacyMode={isPrivacyMode}
          className="text-4xl sm:text-5xl font-bold text-white"
        />
        {change !== undefined && (
          <div className="flex items-center gap-2 mt-3">
            {trend === 'up' ? (
              <ArrowTrendingUpIcon className="h-5 w-5 text-emerald-300" />
            ) : trend === 'down' ? (
              <ArrowTrendingDownIcon className="h-5 w-5 text-red-300" />
            ) : null}
            <span className={`text-sm font-medium ${
              trend === 'up' ? 'text-emerald-300' :
              trend === 'down' ? 'text-red-300' :
              'text-violet-200'
            }`}>
              {change > 0 ? '+' : ''}{formatCurrency(change)} this month
            </span>
          </div>
        )}
      </div>
      <div className="hidden sm:block">
        <ScaleIcon className="h-16 w-16 text-violet-300 opacity-50" />
      </div>
    </div>
  </Card>
));

HeroMetric.displayName = 'HeroMetric';

// Period Summary component
const PeriodSummary = React.memo(({ title, income, expenses, savings, isPrivacyMode }) => {
  const savingsRate = income > 0 ? ((savings / income) * 100).toFixed(0) : 0;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {title}
      </h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium uppercase mb-1">
            Income
          </p>
          <PrivacyCurrency
            amount={income}
            isPrivacyMode={isPrivacyMode}
            className="text-lg font-bold text-emerald-700 dark:text-emerald-400"
          />
        </div>
        <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-xs text-red-600 dark:text-red-400 font-medium uppercase mb-1">
            Spent
          </p>
          <PrivacyCurrency
            amount={expenses}
            isPrivacyMode={isPrivacyMode}
            className="text-lg font-bold text-red-700 dark:text-red-400"
          />
        </div>
        <div className="text-center p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg">
          <p className="text-xs text-violet-600 dark:text-violet-400 font-medium uppercase mb-1">
            Saved
          </p>
          <PrivacyCurrency
            amount={savings}
            isPrivacyMode={isPrivacyMode}
            className="text-lg font-bold text-violet-700 dark:text-violet-400"
          />
          <p className="text-xs text-violet-500 dark:text-violet-400 mt-0.5">
            {savingsRate}% rate
          </p>
        </div>
      </div>
    </Card>
  );
});

PeriodSummary.displayName = 'PeriodSummary';

// Top Categories component
const TopCategories = React.memo(({ categories, isPrivacyMode }) => {
  if (!categories || categories.length === 0) return null;

  const topCategories = categories.slice(0, 5);
  const maxValue = topCategories[0]?.value || 0;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Top Spending Categories
      </h3>
      <div className="space-y-3">
        {topCategories.map((category, index) => (
          <div key={category.name} className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {category.name}
                </span>
                <PrivacyCurrency
                  amount={category.value}
                  isPrivacyMode={isPrivacyMode}
                  className="text-sm font-semibold text-gray-900 dark:text-white ml-2"
                />
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(category.value / maxValue) * 100}%`,
                    backgroundColor: COLORS[index % COLORS.length]
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
});

TopCategories.displayName = 'TopCategories';

const TransactionRow = React.memo(({ transaction, account, isPrivacyMode }) => {
  const amount = transaction.processedAmount || 0;
  const isZero = isEffectivelyZero(amount);
  const isExpense = !isZero && amount < 0;

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
      <td className="px-4 py-3 text-sm font-medium text-right">
        <PrivacyCurrency
          amount={amount}
          isPrivacyMode={isPrivacyMode}
          className={isExpense ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}
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
  const [selectedTimePeriod, setSelectedTimePeriod] = useState('last-6-months');

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

  // Calculate date range based on selected time period
  const dateRange = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    let startDate, endDate;

    switch (selectedTimePeriod) {
      case 'this-month':
        startDate = new Date(currentYear, currentMonth, 1);
        endDate = new Date(currentYear, currentMonth + 1, 0);
        break;
      case 'last-3-months':
        startDate = new Date(currentYear, currentMonth - 2, 1);
        endDate = now;
        break;
      case 'last-6-months':
        startDate = new Date(currentYear, currentMonth - 5, 1);
        endDate = now;
        break;
      case 'last-12-months':
        startDate = new Date(currentYear, currentMonth - 11, 1);
        endDate = now;
        break;
      case 'ytd':
        startDate = new Date(currentYear, 0, 1);
        endDate = now;
        break;
      case 'last-year':
        startDate = new Date(currentYear - 1, 0, 1);
        endDate = new Date(currentYear - 1, 11, 31);
        break;
      case 'all':
      default:
        startDate = new Date(2000, 0, 1); // Far in the past
        endDate = now;
    }

    return { startDate, endDate };
  }, [selectedTimePeriod]);

  // Get number of months for charts based on selected period
  const chartMonths = useMemo(() => {
    const periodOption = TIME_PERIODS.find(p => p.key === selectedTimePeriod);
    if (periodOption?.months) return periodOption.months;

    // Calculate months for special cases
    const now = new Date();
    switch (selectedTimePeriod) {
      case 'ytd':
        return now.getMonth() + 1;
      case 'last-year':
        return 12;
      case 'all':
        return 24; // Show last 2 years for "all"
      default:
        return 6;
    }
  }, [selectedTimePeriod]);

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

  // Chart data - uses selected time period
  const chartData = useMemo(() => {
    const monthsData = getMonthlyRangeData(monthlyData, chartMonths);

    return monthsData.map(month => ({
      month: month.monthName.split(' ')[0],
      income: month.income,
      expenses: month.expenses
    }));
  }, [monthlyData, chartMonths]);

  // Period summary data - uses selected time period
  const periodSummaryData = useMemo(() => {
    const { startDate, endDate } = dateRange;
    let totalIncome = 0;
    let totalExpenses = 0;

    // Sum up all months within the date range
    Object.entries(monthlyData).forEach(([monthKey, data]) => {
      const [year, month] = monthKey.split('-').map(Number);
      const monthDate = new Date(year, month - 1, 15); // Mid-month for comparison

      if (monthDate >= startDate && monthDate <= endDate) {
        totalIncome += data.income || 0;
        totalExpenses += data.expenses || 0;
      }
    });

    const savings = totalIncome - totalExpenses;

    return {
      income: totalIncome,
      expenses: totalExpenses,
      savings
    };
  }, [monthlyData, dateRange]);

  // This month's summary (for net worth change calculation)
  const thisMonthData = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonth = monthlyData[currentMonthKey] || { income: 0, expenses: 0 };
    const savings = thisMonth.income - thisMonth.expenses;

    return {
      income: thisMonth.income,
      expenses: thisMonth.expenses,
      savings
    };
  }, [monthlyData]);

  // Net worth change (approximation from cash flow)
  const netWorthChange = useMemo(() => {
    return thisMonthData.savings;
  }, [thisMonthData]);

  // Top spending categories from transactions - uses selected time period
  const topSpendingCategories = useMemo(() => {
    const categoryTotals = {};
    const { startDate, endDate } = dateRange;

    processedTransactions
      .filter(txn => {
        const txnDate = new Date(txn.date);
        return txnDate >= startDate &&
               txnDate <= endDate &&
               (txn.processedAmount || 0) < 0; // Only expenses
      })
      .forEach(txn => {
        const category = txn.category_name || txn.category || 'Uncategorized';
        const amount = Math.abs(txn.processedAmount || 0);
        categoryTotals[category] = (categoryTotals[category] || 0) + amount;
      });

    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [processedTransactions, dateRange]);

  // Net worth over time data - work backwards from current totals using cash flow
  const netWorthHistoryData = useMemo(() => {
    const monthsToShow = getMonthlyRangeData(monthlyData, chartMonths);

    if (monthsToShow.length === 0) return [];

    // Start with current values and work backwards
    let runningAssets = totalAssets;
    let runningLiabilities = totalLiabilities;

    // Calculate the data points in reverse (from oldest to newest)
    const reversedData = [...monthsToShow].reverse().map((month, index) => {
      const netFlow = month.income - month.expenses;

      // For months before the current one, subtract the net flow
      // (since we're working backwards from current totals)
      if (index < monthsToShow.length - 1) {
        // Approximate: positive net flow increases assets, negative reduces them
        // This is a simplification since we don't have actual historical balance data
        if (netFlow > 0) {
          runningAssets -= netFlow;
        } else {
          // Negative flow could mean paying down debt or reducing assets
          runningAssets -= netFlow * 0.3; // 30% from assets
          runningLiabilities += Math.abs(netFlow) * 0.7; // 70% reduced debt
        }
      }

      return {
        month: month.monthName.split(' ')[0],
        fullMonth: month.monthName,
        assets: Math.max(0, runningAssets),
        liabilities: Math.max(0, runningLiabilities),
        netWorth: runningAssets - runningLiabilities
      };
    });

    // Reverse back to chronological order
    return reversedData.reverse();
  }, [monthlyData, chartMonths, totalAssets, totalLiabilities]);

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

        {/* Hero: Net Worth - Primary Focus */}
        <HeroMetric
          value={netWorth}
          label="Net Worth"
          trend={netWorthChange >= 0 ? 'up' : 'down'}
          change={netWorthChange}
          isPrivacyMode={privacyMode}
        />

        {/* Quick Actions Bar */}
        <div className="flex gap-2 flex-wrap items-center justify-between">
          <div className="flex gap-2 flex-wrap items-center">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  if (ynabToken) {
                    await refetch();
                  }
                } catch (error) {
                  console.error('Error refreshing data:', error);
                }
              }}
              className="flex items-center gap-2 text-sm"
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
          <TimePeriodSelector
            selectedPeriod={selectedTimePeriod}
            onPeriodChange={setSelectedTimePeriod}
          />
        </div>

        {/* Period Summary + Top Categories */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PeriodSummary
            title={TIME_PERIODS.find(p => p.key === selectedTimePeriod)?.label || 'Summary'}
            income={periodSummaryData.income}
            expenses={periodSummaryData.expenses}
            savings={periodSummaryData.savings}
            isPrivacyMode={privacyMode}
          />
          <TopCategories
            categories={topSpendingCategories}
            isPrivacyMode={privacyMode}
          />
        </div>

        {/* Assets vs Liabilities Quick View */}
        <div className="grid grid-cols-2 gap-4">
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

        {/* Collapsible: Net Worth Over Time */}
        <CollapsibleSection
          title="Net Worth Over Time"
          subtitle={TIME_PERIODS.find(p => p.key === selectedTimePeriod)?.label || 'Last 6 Months'}
          icon={ChartBarIcon}
          defaultOpen={false}
        >
          {netWorthHistoryData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={netWorthHistoryData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      if (Math.abs(value) >= 1000000) {
                        return `$${(value / 1000000).toFixed(1)}M`;
                      } else if (Math.abs(value) >= 1000) {
                        return `$${(value / 1000).toFixed(0)}k`;
                      }
                      return `$${value}`;
                    }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const data = payload[0]?.payload;
                      return (
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                            {data?.fullMonth || label}
                          </p>
                          {payload.map((entry, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: entry.stroke }}
                              />
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {entry.name}:
                              </span>
                              <span className={`text-sm font-medium ${privacyMode ? 'privacy-blur' : ''}`}
                                style={{ color: entry.stroke }}>
                                ${formatCurrency(entry.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: '20px' }}
                    formatter={(value) => (
                      <span className="text-sm text-gray-600 dark:text-gray-400">{value}</span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="assets"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Assets"
                  />
                  <Line
                    type="monotone"
                    dataKey="liabilities"
                    stroke="#EF4444"
                    strokeWidth={2}
                    dot={{ fill: '#EF4444', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Liabilities"
                  />
                  <Line
                    type="monotone"
                    dataKey="netWorth"
                    stroke="#3B82F6"
                    strokeWidth={3}
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Net Worth"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center">
              <div className="text-center">
                <ChartBarIcon className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No historical data available
                </p>
              </div>
            </div>
          )}
        </CollapsibleSection>

        {/* Collapsible: Portfolio Breakdown */}
        <CollapsibleSection
          title="Portfolio Breakdown"
          subtitle="Asset allocation and account summary"
          icon={ChartPieIcon}
          defaultOpen={false}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Asset Allocation */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Asset Allocation</h4>
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
            </div>

            {/* Account Summary */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Account Summary</h4>
              <div className="space-y-3 max-h-80 overflow-y-auto">
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
            </div>
          </div>
        </CollapsibleSection>

        {/* Collapsible: Income vs Expenses */}
        <CollapsibleSection
          title="Income vs Expenses"
          subtitle={TIME_PERIODS.find(p => p.key === selectedTimePeriod)?.label || 'Selected period'}
          icon={ChartBarIcon}
          defaultOpen={false}
        >
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
        </CollapsibleSection>

        {/* Collapsible: Recent Transactions */}
        <CollapsibleSection
          title="Recent Transactions"
          subtitle="Latest financial activity"
          icon={CreditCardIcon}
          defaultOpen={false}
        >
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
        </CollapsibleSection>

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
