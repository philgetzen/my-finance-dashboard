import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import { useFinanceData, usePrivacy } from '../../contexts/ConsolidatedDataContext';
import { useAccountManager } from '../../hooks/useAccountManager';
import { useTransactionProcessor } from '../../hooks/useTransactionProcessor';
import { useRunwayCalculator } from '../../hooks/useRunwayCalculator';
import { formatCurrency } from '../../utils/formatters';
import PageTransition from '../ui/PageTransition';
import Card from '../ui/Card';
import PrivacyCurrency from '../ui/PrivacyCurrency';
import { RunwaySkeleton } from '../ui/Skeleton';
import {
  ClockIcon,
  BanknotesIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

// Purple-first color palette (matches Dashboard)
const COLORS = {
  purple: '#8B5CF6',
  orange: '#F97316',
  blue: '#3B82F6',
  green: '#10B981',
  pink: '#EC4899',
  teal: '#14B8A6',
};

// Period options - matches YNAB
const PERIOD_OPTIONS = [
  { value: 3, label: 'Last 3 Months' },
  { value: 6, label: 'Last 6 Months' },
  { value: 12, label: 'Last 12 Months' },
];

// Health status configuration
const HEALTH_CONFIG = {
  critical: {
    label: 'Critical',
    description: 'Less than 3 months of runway',
    icon: ExclamationTriangleIcon,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800'
  },
  caution: {
    label: 'Caution',
    description: '3-6 months of runway',
    icon: ExclamationTriangleIcon,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800'
  },
  healthy: {
    label: 'Healthy',
    description: '6-12 months of runway',
    icon: CheckCircleIcon,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800'
  },
  excellent: {
    label: 'Excellent',
    description: 'More than 12 months of runway',
    icon: CheckCircleIcon,
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    border: 'border-violet-200 dark:border-violet-800'
  }
};

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label, privacyMode }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
      <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
        {label}
      </p>
      {payload.map((entry, index) => {
        const color = entry.color || entry.stroke || entry.fill;
        return (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {entry.name}:
            </span>
            <span
              className={`text-sm font-medium ${privacyMode ? 'privacy-blur' : ''}`}
              style={{ color }}
            >
              ${formatCurrency(entry.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default function Runway() {
  const {
    accounts: ynabAccounts,
    transactions: ynabTransactions,
    manualAccounts,
    isLoading,
  } = useFinanceData();
  const { privacyMode } = usePrivacy();

  const [selectedPeriod, setSelectedPeriod] = useState(6);

  // Use account manager to get normalized accounts
  const { allAccounts } = useAccountManager(ynabAccounts, manualAccounts);

  // Get investment account IDs for transaction filtering
  const investmentAccountIds = useMemo(() => new Set(
    allAccounts
      .filter(acc => acc.normalizedType === 'investment')
      .map(acc => acc.id || acc.account_id)
      .filter(Boolean)
  ), [allAccounts]);

  // Process transactions to get monthly data
  const { monthlyData } = useTransactionProcessor(
    ynabTransactions,
    allAccounts,
    investmentAccountIds
  );

  // Calculate runway metrics
  const runway = useRunwayCalculator(allAccounts, monthlyData, selectedPeriod);

  const healthConfig = HEALTH_CONFIG[runway.runwayHealth];
  const HealthIcon = healthConfig.icon;

  // Format runway display
  const formatRunway = (months) => {
    if (!isFinite(months)) return { value: '∞', label: 'Unlimited' };
    if (months >= 24) return { value: '24+', label: 'months' };
    return { value: Math.floor(months).toString(), label: months === 1 ? 'month' : 'months' };
  };

  const pureDisplay = formatRunway(runway.pureRunwayMonths);
  const netDisplay = formatRunway(runway.netRunwayMonths);

  if (isLoading) {
    return (
      <PageTransition>
        <RunwaySkeleton />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="w-full max-w-none space-y-6 pb-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ClockIcon className="h-7 w-7 text-violet-500" />
              Cash Runway
              {/* Info tooltip */}
              <div className="relative group">
                <InformationCircleIcon className="h-5 w-5 text-gray-400 hover:text-violet-500 cursor-help transition-colors" />
                <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
                    How Runway is Calculated
                  </h4>
                  <div className="space-y-3 text-xs text-gray-600 dark:text-gray-400">
                    <div>
                      <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Cash Reserves</p>
                      <p>Sum of all Checking, Savings, and Cash accounts (excludes investments and closed accounts)</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Worst Case (No Income)</p>
                      <p>Cash Reserves ÷ Average Monthly Expenses = Months until depleted with no income</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Realistic (With Income)</p>
                      <p>Cash Reserves ÷ (Avg Expenses - Avg Income) = Months until depleted considering income</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Averaging Period</p>
                      <p>Income and expenses are averaged over the selected period ({selectedPeriod} months) for more stable projections</p>
                    </div>
                  </div>
                </div>
              </div>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              How long your cash reserves will last
            </p>
          </div>

          {/* Period selector */}
          <div className="relative">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(Number(e.target.value))}
              className="appearance-none pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            >
              {PERIOD_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} Average
                </option>
              ))}
            </select>
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Health Status Banner */}
        <Card className={`p-4 ${healthConfig.bg} ${healthConfig.border} border`}>
          <div className="flex items-center gap-3">
            <HealthIcon className={`h-6 w-6 ${healthConfig.color}`} />
            <div>
              <p className={`font-semibold ${healthConfig.color}`}>
                {healthConfig.label}: {pureDisplay.value} {pureDisplay.label} of runway
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {healthConfig.description}
              </p>
            </div>
          </div>
        </Card>

        {/* Two Scenario Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pure Burn Rate (Worst Case) */}
          <Card className="p-6 border-l-4 border-l-orange-500">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Worst Case
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  No income, expenses only
                </p>
              </div>
              <ArrowTrendingDownIcon className="h-5 w-5 text-orange-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-orange-600 dark:text-orange-400">
                {pureDisplay.value}
              </span>
              <span className="text-lg text-gray-500 dark:text-gray-400">
                {pureDisplay.label}
              </span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Avg Monthly Burn</span>
                <PrivacyCurrency
                  amount={runway.avgMonthlyExpenses}
                  isPrivacyMode={privacyMode}
                  className="font-medium text-gray-700 dark:text-gray-300"
                />
              </div>
            </div>
          </Card>

          {/* Net Burn Rate (Realistic) */}
          <Card className="p-6 border-l-4 border-l-violet-500">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Realistic Case
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Income minus expenses
                </p>
              </div>
              <ArrowTrendingUpIcon className="h-5 w-5 text-violet-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-violet-600 dark:text-violet-400">
                {netDisplay.value}
              </span>
              <span className="text-lg text-gray-500 dark:text-gray-400">
                {netDisplay.label}
              </span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Avg Monthly Net</span>
                <span className={`font-medium ${privacyMode ? 'privacy-blur' : ''} ${
                  runway.avgMonthlyNet >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {runway.avgMonthlyNet >= 0 ? '+' : '-'}
                  <PrivacyCurrency
                    amount={Math.abs(runway.avgMonthlyNet)}
                    isPrivacyMode={privacyMode}
                    className=""
                  />
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Cash Reserves Breakdown */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BanknotesIcon className="h-5 w-5 text-violet-500" />
            Cash Reserves Breakdown
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-lg text-center">
              <p className="text-xs text-violet-600 dark:text-violet-400 font-medium uppercase mb-1">
                Total Cash
              </p>
              <PrivacyCurrency
                amount={runway.cashReserves}
                isPrivacyMode={privacyMode}
                className="text-xl sm:text-2xl font-bold text-violet-700 dark:text-violet-400"
              />
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium uppercase mb-1">
                Checking
              </p>
              <PrivacyCurrency
                amount={runway.cashBreakdown.checking}
                isPrivacyMode={privacyMode}
                className="text-lg sm:text-xl font-bold text-gray-700 dark:text-gray-300"
              />
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium uppercase mb-1">
                Savings
              </p>
              <PrivacyCurrency
                amount={runway.cashBreakdown.savings}
                isPrivacyMode={privacyMode}
                className="text-lg sm:text-xl font-bold text-gray-700 dark:text-gray-300"
              />
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium uppercase mb-1">
                Other Cash
              </p>
              <PrivacyCurrency
                amount={runway.cashBreakdown.manualCash}
                isPrivacyMode={privacyMode}
                className="text-lg sm:text-xl font-bold text-gray-700 dark:text-gray-300"
              />
            </div>
          </div>
        </Card>

        {/* Cash Projection Chart */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Cash Depletion Projection
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={runway.projection}>
                <defs>
                  <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.orange} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={COLORS.orange} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => privacyMode ? '***' : `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip privacyMode={privacyMode} />} />
                <Legend />
                <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="netBalance"
                  stroke={COLORS.purple}
                  fill="url(#purpleGradient)"
                  strokeWidth={2}
                  name="With Income"
                />
                <Area
                  type="monotone"
                  dataKey="pureBalance"
                  stroke={COLORS.orange}
                  fill="url(#orangeGradient)"
                  strokeWidth={2}
                  name="No Income"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Historical Spending Chart */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Monthly Income vs Expenses
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={runway.historicalSpending}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => privacyMode ? '***' : `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip privacyMode={privacyMode} />} />
                <Legend />
                <Bar
                  dataKey="income"
                  fill={COLORS.green}
                  radius={[4, 4, 0, 0]}
                  name="Income"
                />
                <Bar
                  dataKey="expenses"
                  fill={COLORS.orange}
                  radius={[4, 4, 0, 0]}
                  name="Expenses"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Spending Metrics Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium mb-1">
              Avg Monthly Income
            </p>
            <PrivacyCurrency
              amount={runway.avgMonthlyIncome}
              isPrivacyMode={privacyMode}
              className="text-xl font-bold text-emerald-600 dark:text-emerald-400"
            />
          </Card>
          <Card className="p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium mb-1">
              Avg Monthly Expenses
            </p>
            <PrivacyCurrency
              amount={runway.avgMonthlyExpenses}
              isPrivacyMode={privacyMode}
              className="text-xl font-bold text-red-600 dark:text-red-400"
            />
          </Card>
          <Card className="p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium mb-1">
              Avg Monthly Savings
            </p>
            <span className={`text-xl font-bold ${privacyMode ? 'privacy-blur' : ''} ${
              runway.avgMonthlyNet >= 0
                ? 'text-violet-600 dark:text-violet-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {runway.avgMonthlyNet >= 0 ? '+$' : '-$'}
              {privacyMode ? '***' : formatCurrency(Math.abs(runway.avgMonthlyNet))}
            </span>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
