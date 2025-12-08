import React, { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useFinanceData, usePrivacy } from '../../contexts/ConsolidatedDataContext';
import { useConsciousSpendingPlan, useCSPSettings, CSP_TARGETS, CSP_BUCKETS } from '../../hooks/useConsciousSpendingPlan';
import { useCSPGoals } from '../../hooks/useCSPGoals';
import { normalizeYNABAccountType } from '../../utils/ynabHelpers';
import { formatCurrency } from '../../utils/formatters';
import PageTransition from '../ui/PageTransition';
import Card from '../ui/Card';
import PrivacyCurrency from '../ui/PrivacyCurrency';
import CSPGoalsPanel from '../ui/CSPGoalsPanel';
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  HomeIcon,
  ChartBarIcon,
  BanknotesIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ArrowTopRightOnSquareIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon,
  BuildingLibraryIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  MinusCircleIcon,
  QuestionMarkCircleIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/outline';

// CSP bucket colors - rich, vibrant palette with gradients
const BUCKET_COLORS = {
  fixedCosts: '#6366F1',    // Indigo - essential, stable
  investments: '#10B981',   // Emerald - growth
  savings: '#3B82F6',       // Blue - security
  guiltFree: '#F59E0B'      // Amber - fun!
};

const BUCKET_GRADIENTS = {
  fixedCosts: 'from-indigo-500 to-violet-600',
  investments: 'from-emerald-500 to-teal-600',
  savings: 'from-blue-500 to-cyan-600',
  guiltFree: 'from-amber-500 to-orange-600'
};

const BUCKET_BG_LIGHT = {
  fixedCosts: 'bg-indigo-50 dark:bg-indigo-950/30',
  investments: 'bg-emerald-50 dark:bg-emerald-950/30',
  savings: 'bg-blue-50 dark:bg-blue-950/30',
  guiltFree: 'bg-amber-50 dark:bg-amber-950/30'
};

const BUCKET_ICONS = {
  fixedCosts: HomeIcon,
  investments: ChartBarIcon,
  savings: BanknotesIcon,
  guiltFree: SparklesIcon
};

// Period options
const PERIOD_OPTIONS = [
  { value: 3, label: '3 Months' },
  { value: 6, label: '6 Months' },
  { value: 12, label: '12 Months' },
];

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label, privacyMode }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
      <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
        {label}
      </p>
      {payload.map((entry, index) => {
        const color = entry.color || entry.fill;
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

// Info Tooltip - Hover tooltip for explaining calculations
// Uses span instead of button to avoid nested button errors
const InfoTooltip = ({ text, className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <span
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={(e) => {
          e.stopPropagation();
          setIsVisible(!isVisible);
        }}
        className="p-0.5 rounded-full text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors cursor-help"
      >
        <QuestionMarkCircleIcon className="h-4 w-4" />
      </span>

      {/* Tooltip */}
      {isVisible && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 sm:w-72">
          <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg">
            <div className="relative">
              {text}
              {/* Arrow */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
                <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-gray-900" />
              </div>
            </div>
          </div>
        </div>
      )}
    </span>
  );
};

// Calculation explanations for tooltips
const CALCULATION_EXPLANATIONS = {
  income: 'Your take-home pay: Total income from "Inflow: Ready to Assign" category, averaged over the selected period. Excludes any payees or categories you\'ve marked as excluded.',
  fixedCosts: 'Essentials you must pay: Rent, utilities, insurance, groceries, subscriptions, and other recurring expenses. Based on actual spending from budget categories mapped to Fixed Costs.',
  investments: 'Building your future: Includes transfers to investment tracking accounts (401k, IRA, brokerage) and any budget categories mapped to Investments. Shows the actual money moved to investment accounts.',
  savings: 'Money set aside for goals: Shows the AVAILABLE balance in categories mapped to Savings. This is the actual money accumulated in emergency funds, vacation savings, house funds, etc. Displayed as monthly average over the selected period.',
  guiltFree: 'Enjoy without guilt: Everything not in another bucket - dining, entertainment, shopping, hobbies. This is your reward for handling the essentials first!',
  netWorth: 'Your complete financial picture: Total assets (investments + savings + property) minus total debt (mortgage, loans, credit cards). Includes all accounts, both on-budget and tracking.',
  score: 'Based on Ramit Sethi\'s targets: Fixed Costs ≤60%, Investments ≥10%, Savings ≥5%, Guilt-Free ≤35%. Score improves as you stay within targets.',
};

// CSP Score Ring - Visual indicator of overall plan health
const CSPScoreRing = ({ buckets, isOnTrack }) => {
  // Calculate a score based on how well each bucket meets targets
  const calculateScore = () => {
    let score = 0;
    let maxScore = 0;

    // Fixed costs: Good if <= max (25 points)
    maxScore += 25;
    if (buckets.fixedCosts.percentage <= CSP_TARGETS.fixedCosts.max) {
      score += 25;
    } else {
      // Partial score based on how close
      const over = buckets.fixedCosts.percentage - CSP_TARGETS.fixedCosts.max;
      score += Math.max(0, 25 - over);
    }

    // Guilt-free: Good if <= max (25 points)
    maxScore += 25;
    if (buckets.guiltFree.percentage <= CSP_TARGETS.guiltFree.max) {
      score += 25;
    } else {
      const over = buckets.guiltFree.percentage - CSP_TARGETS.guiltFree.max;
      score += Math.max(0, 25 - over);
    }

    // Investments: Good if >= min (25 points)
    maxScore += 25;
    if (buckets.investments.percentage >= CSP_TARGETS.investments.min) {
      score += 25;
    } else {
      // Partial score
      const ratio = buckets.investments.percentage / CSP_TARGETS.investments.min;
      score += Math.min(25, ratio * 25);
    }

    // Savings: Good if >= min (25 points)
    maxScore += 25;
    if (buckets.savings.percentage >= CSP_TARGETS.savings.min) {
      score += 25;
    } else {
      const ratio = buckets.savings.percentage / CSP_TARGETS.savings.min;
      score += Math.min(25, ratio * 25);
    }

    return Math.round((score / maxScore) * 100);
  };

  const score = calculateScore();
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getScoreColor = () => {
    if (score >= 90) return { stroke: '#10B981', text: 'text-emerald-500' };
    if (score >= 70) return { stroke: '#3B82F6', text: 'text-blue-500' };
    if (score >= 50) return { stroke: '#F59E0B', text: 'text-amber-500' };
    return { stroke: '#EF4444', text: 'text-red-500' };
  };

  const colors = getScoreColor();

  return (
    <div className="relative w-32 h-32 mx-auto">
      {/* Background circle */}
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={colors.stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${colors.text}`}>{score}</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Score</span>
          <InfoTooltip text={CALCULATION_EXPLANATIONS.score} className="ml-0" />
        </div>
      </div>
    </div>
  );
};

// Net Worth Section Component
const NetWorthSection = ({ netWorth, preTaxInvestments, privacyMode }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const categories = [
    {
      key: 'assets',
      label: 'Assets',
      icon: HomeIcon,
      amount: netWorth?.assets || 0,
      accounts: netWorth?.breakdown?.assets || [],
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
      description: 'Home value, property, vehicles'
    },
    {
      key: 'investments',
      label: 'Investments',
      icon: ArrowTrendingUpIcon,
      amount: netWorth?.investments || 0,
      accounts: netWorth?.breakdown?.investments || [],
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
      description: 'Retirement, brokerage, stocks'
    },
    {
      key: 'savings',
      label: 'Savings',
      icon: BanknotesIcon,
      amount: netWorth?.savings || 0,
      accounts: netWorth?.breakdown?.savings || [],
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
      description: 'Emergency fund, cash reserves'
    },
    {
      key: 'debt',
      label: 'Debt',
      icon: MinusCircleIcon,
      amount: -(netWorth?.debt || 0),
      accounts: netWorth?.breakdown?.debt || [],
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950/30',
      description: 'Mortgage, loans, credit'
    }
  ];

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-5 flex items-center justify-between group"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg">
            <BuildingLibraryIcon className="h-6 w-6 text-white" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-100 transition-colors">
                Net Worth
              </h3>
              <InfoTooltip text={CALCULATION_EXPLANATIONS.netWorth} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your complete financial picture
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <PrivacyCurrency
            amount={netWorth?.total || 0}
            isPrivacyMode={privacyMode}
            className={`text-2xl font-bold ${(netWorth?.total || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
          />
          <div className={`p-1 rounded-lg transition-colors ${isExpanded ? 'bg-gray-100 dark:bg-gray-700' : 'group-hover:bg-gray-100 dark:group-hover:bg-gray-700'}`}>
            {isExpanded ? (
              <ChevronDownIcon className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-gray-500" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-5 pb-5 space-y-4">
          {/* Category cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {categories.map(cat => {
              const Icon = cat.icon;
              return (
                <div key={cat.key} className={`p-4 rounded-xl ${cat.bgColor}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-5 w-5 ${cat.color}`} />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {cat.label}
                    </span>
                  </div>
                  <PrivacyCurrency
                    amount={cat.amount}
                    isPrivacyMode={privacyMode}
                    className={`text-lg font-bold ${cat.color}`}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {cat.accounts.length} account{cat.accounts.length !== 1 ? 's' : ''}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Account breakdown */}
          {categories.map(cat => (
            cat.accounts.length > 0 && (
              <div key={`${cat.key}-breakdown`} className="space-y-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${cat.color.replace('text-', 'bg-')}`}></span>
                  {cat.label} Breakdown ({cat.accounts.length} accounts)
                </p>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <div className="space-y-2">
                    {cat.accounts.map((acc, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                        <span className="text-sm text-gray-600 dark:text-gray-400 truncate pr-2">
                          {acc.name}
                        </span>
                        <PrivacyCurrency
                          amount={cat.key === 'debt' ? -Math.abs(acc.balance) : acc.balance}
                          isPrivacyMode={privacyMode}
                          className={`text-sm font-medium ${cat.color} whitespace-nowrap`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          ))}

          {/* Pre-tax investments note */}
          {preTaxInvestments?.monthlyAmount > 0 && (
            <div className="mt-4 p-4 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20 rounded-xl border border-violet-200 dark:border-violet-800">
              <div className="flex items-start gap-3">
                <InformationCircleIcon className="h-5 w-5 text-violet-600 dark:text-violet-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-violet-800 dark:text-violet-200 mb-1">
                    Pre-Tax Contributions (401k, Traditional IRA)
                  </p>
                  <p className="text-sm text-violet-600 dark:text-violet-300">
                    You're also contributing{' '}
                    <PrivacyCurrency
                      amount={preTaxInvestments.monthlyAmount}
                      isPrivacyMode={privacyMode}
                      className="font-semibold"
                    />
                    /month to pre-tax retirement accounts. These come out before your take-home pay and are tracked separately from your CSP investments target.
                  </p>
                  {preTaxInvestments.accounts?.length > 0 && (
                    <div className="mt-2 text-xs text-violet-500 dark:text-violet-400">
                      {preTaxInvestments.accounts.map((acc, i) => (
                        <span key={i}>
                          {acc.name}: <PrivacyCurrency amount={acc.monthlyAmount} isPrivacyMode={privacyMode} />/mo
                          {i < preTaxInvestments.accounts.length - 1 ? ' • ' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

// Bucket Card Component - Enhanced with better visuals
const BucketCard = React.memo(({ bucketKey, bucket, privacyMode, isExpanded, onToggle }) => {
  const Icon = BUCKET_ICONS[bucketKey];
  const color = BUCKET_COLORS[bucketKey];
  const gradient = BUCKET_GRADIENTS[bucketKey];
  const bgLight = BUCKET_BG_LIGHT[bucketKey];
  const target = bucket.target;

  const statusColor = bucket.isOnTarget
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-amber-600 dark:text-amber-400';

  const StatusIcon = bucket.isOnTarget ? CheckCircleIcon : ExclamationTriangleIcon;

  return (
    <div className={`rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-200`}>
      <button
        onClick={onToggle}
        className="w-full p-5 flex items-center justify-between group"
      >
        <div className="flex items-center gap-4">
          {/* Gradient icon background */}
          <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-100 transition-colors">
                {target.label}
              </h3>
              <InfoTooltip text={CALCULATION_EXPLANATIONS[bucketKey]} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Target: {target.min === target.max ? `${target.min}%` : `${target.min}-${target.max}%`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="flex items-baseline justify-end gap-1">
              <PrivacyCurrency
                amount={bucket.amount}
                isPrivacyMode={privacyMode}
                className="text-xl font-bold text-gray-900 dark:text-white"
              />
              <span className="text-sm text-gray-500 dark:text-gray-400">/mo</span>
            </div>
            <div className="flex items-center gap-1.5 justify-end mt-1">
              <StatusIcon className={`h-4 w-4 ${statusColor}`} />
              <span className={`text-sm font-semibold ${statusColor}`}>
                {bucket.percentage}% of income
              </span>
            </div>
          </div>
          <div className={`p-1 rounded-lg transition-colors ${isExpanded ? 'bg-gray-100 dark:bg-gray-700' : 'group-hover:bg-gray-100 dark:group-hover:bg-gray-700'}`}>
            {isExpanded ? (
              <ChevronDownIcon className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-gray-500" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded content with smooth animation */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className={`px-5 pb-5 ${bgLight}`}>
          {/* Enhanced Progress bar */}
          <div className="mt-4 mb-5">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
              <span>0%</span>
              <span className="font-semibold text-sm" style={{ color }}>
                {bucket.percentage}% of income
              </span>
              <span>100%</span>
            </div>
            <div className="h-4 bg-gray-200/60 dark:bg-gray-700/60 rounded-full overflow-hidden relative backdrop-blur-sm">
              {/* Target zone indicator */}
              <div
                className="absolute h-full bg-gray-300/50 dark:bg-gray-600/50 border-l border-r border-gray-400/30 dark:border-gray-500/30"
                style={{
                  left: `${target.min}%`,
                  width: `${target.max - target.min}%`
                }}
              />
              {/* Actual percentage bar with gradient */}
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out relative z-10 bg-gradient-to-r ${gradient} shadow-sm`}
                style={{
                  width: `${Math.min(bucket.percentage, 100)}%`,
                }}
              />
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <div className="w-3 h-2 bg-gray-300/50 dark:bg-gray-600/50 rounded-sm"></div>
              <span>Target zone: {target.min}-{target.max}%</span>
            </div>
          </div>

          {/* Category breakdown with improved styling */}
          {bucket.categories?.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <span className="w-1 h-4 rounded-full bg-gradient-to-b" style={{ background: `linear-gradient(to bottom, ${color}, transparent)` }}></span>
                Categories ({bucket.categories.length})
              </p>
              <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3 backdrop-blur-sm max-h-64 overflow-y-auto">
                {bucket.categories.map((cat, idx) => (
                  <div
                    key={cat.name}
                    className={`flex items-center justify-between py-2.5 ${idx !== bucket.categories.length - 1 ? 'border-b border-gray-200/50 dark:border-gray-700/50' : ''}`}
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {cat.name}
                    </span>
                    <PrivacyCurrency
                      amount={cat.monthlyAmount}
                      isPrivacyMode={privacyMode}
                      className="text-sm font-semibold text-gray-900 dark:text-white"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

BucketCard.displayName = 'BucketCard';

// Suggestion Card - Enhanced with bucket-specific styling
const SuggestionCard = ({ suggestion }) => {
  const bucketColor = suggestion.bucket ? BUCKET_COLORS[suggestion.bucket] : null;

  const config = {
    warning: {
      bg: 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20',
      border: 'border-amber-200/60 dark:border-amber-800/60',
      icon: 'text-amber-600 dark:text-amber-400',
      text: 'text-amber-800 dark:text-amber-200'
    },
    alert: {
      bg: 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20',
      border: 'border-red-200/60 dark:border-red-800/60',
      icon: 'text-red-600 dark:text-red-400',
      text: 'text-red-800 dark:text-red-200'
    },
    info: {
      bg: 'bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/20',
      border: 'border-blue-200/60 dark:border-blue-800/60',
      icon: 'text-blue-600 dark:text-blue-400',
      text: 'text-blue-800 dark:text-blue-200'
    }
  };

  const styles = config[suggestion.type] || config.info;
  const Icon = suggestion.type === 'alert' ? ExclamationTriangleIcon : InformationCircleIcon;

  return (
    <div className={`relative overflow-hidden p-4 rounded-xl border ${styles.bg} ${styles.border}`}>
      {/* Bucket color accent */}
      {bucketColor && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ backgroundColor: bucketColor }}
        />
      )}
      <div className="flex items-start gap-3 pl-2">
        <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${styles.icon}`} />
        <p className={`text-sm font-medium ${styles.text}`}>
          {suggestion.message}
        </p>
      </div>
    </div>
  );
};

// CSP Settings Panel - Comprehensive settings for category mappings and exclusions
const CSPSettingsPanel = ({
  incomePayees,
  incomeCategories,
  expenseCategories,
  onTogglePayee,
  onToggleCategory,
  onToggleExpenseCategory,
  onSetCategoryBucket,
  categoryMappings,
  privacyMode,
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState('payees');

  if (!isOpen) return null;

  const excludedPayees = incomePayees.filter(p => p.isExcluded);
  const excludedPayeesTotal = excludedPayees.reduce((sum, p) => sum + p.amount, 0);
  const excludedIncomeCategories = incomeCategories.filter(c => c.isExcluded);
  const excludedIncomeCategoriesTotal = excludedIncomeCategories.reduce((sum, c) => sum + c.amount, 0);
  const excludedExpenseCategories = expenseCategories.filter(c => c.isExcluded);
  const excludedExpenseCategoriesTotal = excludedExpenseCategories.reduce((sum, c) => sum + (c.totalAmount || 0), 0);
  const customMappingsCount = Object.keys(categoryMappings).length;

  const tabs = [
    { id: 'payees', label: 'Income Payees', count: excludedPayees.length },
    { id: 'incomeCategories', label: 'Income Categories', count: excludedIncomeCategories.length },
    { id: 'expenseExclusions', label: 'Exclude Expenses', count: excludedExpenseCategories.length },
    { id: 'buckets', label: 'Buckets', count: customMappingsCount },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              CSP Settings
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Customize how transactions are categorized
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-violet-600 dark:text-violet-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                  activeTab === tab.id
                    ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {tab.count}
                </span>
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600 dark:bg-violet-400" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Payees Tab */}
          {activeTab === 'payees' && (
            <div className="p-4 space-y-2">
              {excludedPayees.length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    <span className="font-medium">{excludedPayees.length} payee{excludedPayees.length !== 1 ? 's' : ''}</span> excluded, totaling{' '}
                    <PrivacyCurrency amount={excludedPayeesTotal} isPrivacyMode={privacyMode} className="font-medium" />
                  </p>
                </div>
              )}
              {incomePayees.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  No income payees found in this period
                </p>
              ) : (
                incomePayees.map((payee) => (
                  <div
                    key={payee.name}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                      payee.isExcluded
                        ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                    onClick={() => onTogglePayee(payee.name)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${payee.isExcluded ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                        {payee.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {payee.transactionCount} transaction{payee.transactionCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <PrivacyCurrency
                          amount={payee.amount}
                          isPrivacyMode={privacyMode}
                          className={`font-medium ${payee.isExcluded ? 'text-gray-400 dark:text-gray-500' : 'text-emerald-600 dark:text-emerald-400'}`}
                        />
                        <p className="text-xs text-gray-400">
                          <PrivacyCurrency amount={payee.monthlyAmount} isPrivacyMode={privacyMode} />/mo
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        payee.isExcluded ? 'bg-gray-200 dark:bg-gray-600 border-gray-400 dark:border-gray-500' : 'bg-emerald-500 border-emerald-500'
                      }`}>
                        {!payee.isExcluded && <CheckCircleIcon className="h-4 w-4 text-white" />}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Income Categories Tab */}
          {activeTab === 'incomeCategories' && (
            <div className="p-4 space-y-2">
              {excludedIncomeCategories.length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    <span className="font-medium">{excludedIncomeCategories.length} categor{excludedIncomeCategories.length !== 1 ? 'ies' : 'y'}</span> excluded, totaling{' '}
                    <PrivacyCurrency amount={excludedIncomeCategoriesTotal} isPrivacyMode={privacyMode} className="font-medium" />
                  </p>
                </div>
              )}
              {incomeCategories.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  No income categories found in this period
                </p>
              ) : (
                incomeCategories.map((category) => (
                  <div
                    key={category.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                      category.isExcluded
                        ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                    onClick={() => onToggleCategory(category.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${category.isExcluded ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                        {category.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {category.transactionCount} transaction{category.transactionCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <PrivacyCurrency
                          amount={category.amount}
                          isPrivacyMode={privacyMode}
                          className={`font-medium ${category.isExcluded ? 'text-gray-400 dark:text-gray-500' : 'text-emerald-600 dark:text-emerald-400'}`}
                        />
                        <p className="text-xs text-gray-400">
                          <PrivacyCurrency amount={category.monthlyAmount} isPrivacyMode={privacyMode} />/mo
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        category.isExcluded ? 'bg-gray-200 dark:bg-gray-600 border-gray-400 dark:border-gray-500' : 'bg-emerald-500 border-emerald-500'
                      }`}>
                        {!category.isExcluded && <CheckCircleIcon className="h-4 w-4 text-white" />}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Expense Exclusions Tab */}
          {activeTab === 'expenseExclusions' && (
            <div className="p-4 space-y-2">
              {excludedExpenseCategories.length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    <span className="font-medium">{excludedExpenseCategories.length} categor{excludedExpenseCategories.length !== 1 ? 'ies' : 'y'}</span> excluded, totaling{' '}
                    <PrivacyCurrency amount={excludedExpenseCategoriesTotal} isPrivacyMode={privacyMode} className="font-medium" />
                  </p>
                </div>
              )}
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Exclude expense categories from your CSP calculations. Useful for reimbursable business expenses or one-time purchases.
                </p>
              </div>
              {expenseCategories.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  No expense categories found
                </p>
              ) : (
                (() => {
                  // Group categories by their groupName
                  const groupedCategories = expenseCategories.reduce((acc, category) => {
                    const groupName = category.groupName || 'Uncategorized';
                    if (!acc[groupName]) {
                      acc[groupName] = { categories: [], groupIndex: category.groupIndex };
                    }
                    acc[groupName].categories.push(category);
                    return acc;
                  }, {});

                  // Sort groups by groupIndex
                  const sortedGroups = Object.entries(groupedCategories)
                    .sort(([, a], [, b]) => (a.groupIndex || 0) - (b.groupIndex || 0));

                  return sortedGroups.map(([groupName, { categories: groupCategories }]) => (
                    <div key={groupName} className="mb-4">
                      {/* Group Header */}
                      <div className="sticky top-0 bg-gray-100 dark:bg-gray-900 px-3 py-2 rounded-lg mb-2 z-10">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                          {groupName}
                        </h4>
                      </div>
                      {/* Categories in this group */}
                      <div className="space-y-2">
                        {groupCategories.map((category) => {
                          const hasTransactions = category.transactionCount > 0;
                          return (
                            <div
                              key={category.id || category.name}
                              className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                                category.isExcluded
                                  ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600'
                                  : hasTransactions
                                    ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                              }`}
                              onClick={() => onToggleExpenseCategory(category.id)}
                            >
                              <div className="flex-1 min-w-0">
                                <p className={`font-medium truncate ${
                                  category.isExcluded
                                    ? 'text-gray-500 dark:text-gray-400 line-through'
                                    : hasTransactions
                                      ? 'text-gray-900 dark:text-white'
                                      : 'text-gray-500 dark:text-gray-400'
                                }`}>
                                  {category.name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {hasTransactions ? (
                                    <p className="text-xs text-gray-400">
                                      {category.transactionCount} txn{category.transactionCount !== 1 ? 's' : ''}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-gray-400 italic">No transactions</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {hasTransactions && (
                                  <div className="text-right">
                                    <PrivacyCurrency
                                      amount={category.totalAmount || category.amount}
                                      isPrivacyMode={privacyMode}
                                      className={`font-medium ${category.isExcluded ? 'text-gray-400 dark:text-gray-500' : 'text-red-600 dark:text-red-400'}`}
                                    />
                                    <p className="text-xs text-gray-400">
                                      <PrivacyCurrency amount={category.monthlyAmount + (category.monthlyExcludedAmount || 0)} isPrivacyMode={privacyMode} />/mo
                                    </p>
                                  </div>
                                )}
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  category.isExcluded ? 'bg-amber-500 border-amber-500' : 'bg-gray-200 dark:bg-gray-600 border-gray-400 dark:border-gray-500'
                                }`}>
                                  {category.isExcluded && <XMarkIcon className="h-3 w-3 text-white" />}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()
              )}
            </div>
          )}

          {/* Category Buckets Tab */}
          {activeTab === 'buckets' && (
            <div className="p-4 space-y-2">
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Assign expense categories to CSP buckets. Categories without a custom assignment use automatic keyword matching.
                </p>
              </div>
              {expenseCategories.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  No expense categories found
                </p>
              ) : (
                (() => {
                  // Group categories by their groupName
                  const groupedCategories = expenseCategories.reduce((acc, category) => {
                    const groupName = category.groupName || 'Uncategorized';
                    if (!acc[groupName]) {
                      acc[groupName] = { categories: [], groupIndex: category.groupIndex };
                    }
                    acc[groupName].categories.push(category);
                    return acc;
                  }, {});

                  // Sort groups by groupIndex
                  const sortedGroups = Object.entries(groupedCategories)
                    .sort(([, a], [, b]) => (a.groupIndex || 0) - (b.groupIndex || 0));

                  return sortedGroups.map(([groupName, { categories: groupCategories }]) => (
                    <div key={groupName} className="mb-4">
                      {/* Group Header */}
                      <div className="sticky top-0 bg-gray-100 dark:bg-gray-900 px-3 py-2 rounded-lg mb-2 z-10">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                          {groupName}
                        </h4>
                      </div>
                      {/* Categories in this group */}
                      <div className="space-y-2">
                        {groupCategories.map((category) => {
                          const currentBucket = category.customBucket || category.inferredBucket;
                          const hasCustomMapping = !!category.customBucket;
                          const hasTransactions = category.transactionCount > 0;
                          return (
                            <div
                              key={category.id || category.name}
                              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                hasTransactions
                                  ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                                  : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50'
                              }`}
                            >
                              <div className="flex-1 min-w-0 mr-4">
                                <div className="flex items-center gap-2">
                                  <p className={`font-medium truncate ${
                                    hasTransactions
                                      ? 'text-gray-900 dark:text-white'
                                      : 'text-gray-500 dark:text-gray-400'
                                  }`}>
                                    {category.name}
                                  </p>
                                  {hasCustomMapping && (
                                    <span className="px-1.5 py-0.5 text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded">
                                      custom
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  {hasTransactions ? (
                                    <>
                                      <PrivacyCurrency
                                        amount={category.monthlyAmount}
                                        isPrivacyMode={privacyMode}
                                        className="text-xs text-gray-400"
                                      />
                                      <span className="text-xs text-gray-400">/mo</span>
                                      <span className="text-xs text-gray-400">
                                        ({category.transactionCount} txn{category.transactionCount !== 1 ? 's' : ''})
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-xs text-gray-400 italic">No transactions</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {Object.entries(CSP_BUCKETS).map(([key, bucket]) => (
                                  <button
                                    key={key}
                                    onClick={() => onSetCategoryBucket(category.id, key === currentBucket && hasCustomMapping ? null : key)}
                                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                      currentBucket === key
                                        ? 'text-white'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                                    style={currentBucket === key ? { backgroundColor: bucket.color } : {}}
                                    title={bucket.label}
                                  >
                                    {key === 'fixedCosts' ? 'Fixed' :
                                     key === 'investments' ? 'Invest' :
                                     key === 'savings' ? 'Save' : 'Free'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {activeTab === 'payees' && 'Click on a payee to include/exclude it from your monthly income average. Useful for one-time events like bonuses or tax refunds.'}
            {activeTab === 'incomeCategories' && 'Click on a category to include/exclude it from your monthly income average. Useful for infrequent income sources.'}
            {activeTab === 'expenseExclusions' && 'Click on a category to exclude it entirely from CSP calculations. Excluded expenses won\'t count toward any bucket.'}
            {activeTab === 'buckets' && 'Click on a bucket button to assign a category. Click again to reset to automatic detection. "Custom" badge indicates a manual override.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default function ConsciousSpendingPlan() {
  const {
    accounts: ynabAccounts,
    transactions: ynabTransactions,
    categories,
    months,
    isLoading,
  } = useFinanceData();
  const { privacyMode } = usePrivacy();

  const [selectedPeriod, setSelectedPeriod] = useState(6);
  const [expandedBuckets, setExpandedBuckets] = useState(new Set(['fixedCosts']));
  const [showIncomeSettings, setShowIncomeSettings] = useState(false);

  // CSP settings (persisted to localStorage)
  const cspSettings = useCSPSettings();
  const {
    excludedPayees,
    excludedCategories,
    excludedExpenseCategories,
    categoryMappings,
    settings,
    togglePayeeExclusion,
    toggleCategoryExclusion,
    toggleExpenseCategoryExclusion,
    setCategoryBucket,
    clearCategoryMapping,
    updateSettings
  } = cspSettings;

  // Handler for setting category bucket (with toggle support)
  const handleSetCategoryBucket = (categoryId, bucket) => {
    if (bucket === null) {
      clearCategoryMapping(categoryId);
    } else {
      setCategoryBucket(categoryId, bucket);
    }
  };

  // Calculate CSP data with all settings
  // Pass months data for budgeted amounts (used for savings categories)
  const cspData = useConsciousSpendingPlan(
    ynabTransactions,
    categories,
    ynabAccounts,
    selectedPeriod,
    cspSettings,
    months
  );

  // Future Goals feature
  const goalsState = useCSPGoals(cspData);

  // Count active exclusions
  const activePayeeExclusions = cspData.incomePayees?.filter(p => p.isExcluded).length || 0;
  const activeCategoryExclusions = cspData.incomeCategories?.filter(c => c.isExcluded).length || 0;
  const activeExpenseExclusions = cspData.allExpenseCategories?.filter(c => c.isExcluded).length || 0;
  const activeExclusionCount = activePayeeExclusions + activeCategoryExclusions + activeExpenseExclusions;

  const toggleBucket = (key) => {
    setExpandedBuckets(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Pie chart data - always exactly 4 buckets totaling 100% (Ramit's CSP formula)
  const pieData = useMemo(() => {
    return Object.entries(cspData.buckets).map(([key, bucket]) => ({
      name: bucket.target.label,
      value: bucket.amount,
      color: BUCKET_COLORS[key]
    }));
  }, [cspData.buckets]);

  // Bar chart data for monthly breakdown
  const barData = useMemo(() => {
    return cspData.monthlyData.map(month => ({
      month: month.month,
      'Fixed Costs': month.fixedCosts,
      'Investments': month.investments,
      'Savings': month.savings,
      'Guilt-Free': month.guiltFree
    }));
  }, [cspData.monthlyData]);

  if (isLoading) {
    return (
      <PageTransition>
        <div className="w-full max-w-none space-y-6 pb-4">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
              <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="w-full max-w-none space-y-6 pb-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Conscious Spending Plan
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Based on Ramit Sethi's money management system
            </p>
            <a
              href="https://www.iwillteachyoutoberich.com/conscious-spending-basics/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-violet-600 dark:text-violet-400 hover:underline mt-2"
            >
              Learn more about CSP
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </a>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Future Goals Button */}
            <button
              onClick={goalsState.openPanel}
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white rounded-lg text-sm font-medium transition-all shadow-md hover:shadow-lg"
            >
              <RocketLaunchIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Future Goals</span>
            </button>

            {/* Income Settings Button */}
            <button
              onClick={() => setShowIncomeSettings(true)}
              className={`relative flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                activeExclusionCount > 0
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <AdjustmentsHorizontalIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeExclusionCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-amber-500 text-white text-xs font-bold rounded-full">
                  {activeExclusionCount}
                </span>
              )}
            </button>

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
        </div>

        {/* Hero Status Card with CSP Score */}
        <div className={`rounded-2xl p-6 ${cspData.isOnTrack
          ? 'bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-cyan-950/20 border border-emerald-200/50 dark:border-emerald-800/50'
          : 'bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-yellow-950/20 border border-amber-200/50 dark:border-amber-800/50'
        }`}>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* CSP Score Ring */}
            <div className="flex-shrink-0">
              <CSPScoreRing buckets={cspData.buckets} isOnTrack={cspData.isOnTrack} />
            </div>

            {/* Status Text */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                {cspData.isOnTrack ? (
                  <CheckCircleIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                )}
                <h2 className={`text-xl font-bold ${cspData.isOnTrack
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-amber-700 dark:text-amber-300'
                }`}>
                  {cspData.isOnTrack
                    ? "You're on track!"
                    : 'Needs attention'
                  }
                </h2>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                {cspData.isOnTrack
                  ? "Your spending aligns with Ramit Sethi's Conscious Spending Plan guidelines."
                  : "Some spending categories are outside the recommended ranges."
                }
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/60 dark:bg-gray-800/60 rounded-lg backdrop-blur-sm">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Monthly Take-Home Pay:</span>
                  <PrivacyCurrency
                    amount={cspData.monthlyIncome}
                    isPrivacyMode={privacyMode}
                    className="text-sm font-bold text-gray-900 dark:text-white"
                  />
                  <InfoTooltip text={CALCULATION_EXPLANATIONS.income} />
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/60 dark:bg-gray-800/60 rounded-lg backdrop-blur-sm">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Based on:</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{selectedPeriod} month average</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Net Worth Section */}
        <NetWorthSection
          netWorth={cspData.netWorth}
          preTaxInvestments={cspData.preTaxInvestments}
          privacyMode={privacyMode}
        />

        {/* Suggestions */}
        {cspData.suggestions.length > 0 && (
          <div className="space-y-3">
            {cspData.suggestions.map((suggestion, idx) => (
              <SuggestionCard key={idx} suggestion={suggestion} />
            ))}
          </div>
        )}

        {/* Quick Stats Row - Clean horizontal layout */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Fixed Costs', key: 'fixedCosts', icon: HomeIcon },
            { label: 'Investments', key: 'investments', icon: ChartBarIcon },
            { label: 'Savings', key: 'savings', icon: BanknotesIcon },
            { label: 'Guilt-Free', key: 'guiltFree', icon: SparklesIcon },
          ].map(({ label, key, icon: Icon }) => {
            const bucket = cspData.buckets[key];
            const gradient = BUCKET_GRADIENTS[key];
            const isOnTarget = bucket?.isOnTarget;
            return (
              <div
                key={key}
                className="relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 group hover:shadow-md transition-all duration-200"
              >
                {/* Subtle gradient accent */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`} />

                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient}`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  {isOnTarget ? (
                    <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
                  )}
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
                  {label}
                </p>
                <PrivacyCurrency
                  amount={bucket?.amount || 0}
                  isPrivacyMode={privacyMode}
                  className="text-lg font-bold text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {bucket?.percentage || 0}% of income
                </p>
              </div>
            );
          })}
        </div>

        {/* Pie Chart and Target Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Your Spending Breakdown
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius="70%"
                    label={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<CustomTooltip privacyMode={privacyMode} />}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => {
                      const item = pieData.find(d => d.name === value);
                      const total = pieData.reduce((sum, d) => sum + d.value, 0);
                      const percent = total > 0 ? ((item?.value || 0) / total * 100).toFixed(0) : 0;
                      return <span className="text-sm text-gray-700 dark:text-gray-300">{value} ({percent}%)</span>;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Target Comparison */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Target vs Actual
            </h3>
            <div className="space-y-4">
              {Object.entries(cspData.buckets).map(([key, bucket]) => {
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {bucket.target.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-semibold"
                          style={{ color: BUCKET_COLORS[key] }}
                        >
                          {bucket.percentage}%
                        </span>
                        <span className="text-xs text-gray-400">
                          (target: {bucket.target.min === bucket.target.max
                            ? `${bucket.target.min}%`
                            : `${bucket.target.min}-${bucket.target.max}%`
                          })
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden relative">
                        {/* Target range indicator */}
                        <div
                          className="absolute h-full bg-gray-200 dark:bg-gray-600"
                          style={{
                            left: `${bucket.target.min}%`,
                            width: `${bucket.target.max - bucket.target.min}%`
                          }}
                        />
                        {/* Actual bar */}
                        <div
                          className="h-full rounded-full transition-all duration-500 relative z-10"
                          style={{
                            width: `${Math.min(bucket.percentage, 100)}%`,
                            backgroundColor: BUCKET_COLORS[key]
                          }}
                        />
                      </div>
                      {bucket.isOnTarget ? (
                        <CheckCircleIcon className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <span className="inline-block w-8 h-2 bg-gray-200 dark:bg-gray-600 rounded"></span>
                Target range
              </p>
            </div>
          </Card>
        </div>

        {/* Bucket Detail Cards */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Spending Categories
          </h3>
          {Object.entries(cspData.buckets).map(([key, bucket]) => (
            <BucketCard
              key={key}
              bucketKey={key}
              bucket={bucket}
              privacyMode={privacyMode}
              isExpanded={expandedBuckets.has(key)}
              onToggle={() => toggleBucket(key)}
            />
          ))}

          {/* Total allocation indicator - always 100% with Ramit's formula */}
          <div className="flex items-center justify-between py-3 px-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Total Allocated
            </span>
            <span className="text-sm font-semibold tabular-nums text-emerald-500">
              100% ✓
            </span>
          </div>
        </div>

        {/* Monthly Trend Chart */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Monthly Spending by Category
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
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
                <Bar dataKey="Fixed Costs" stackId="a" fill={BUCKET_COLORS.fixedCosts} />
                <Bar dataKey="Investments" stackId="a" fill={BUCKET_COLORS.investments} />
                <Bar dataKey="Savings" stackId="a" fill={BUCKET_COLORS.savings} />
                <Bar dataKey="Guilt-Free" stackId="a" fill={BUCKET_COLORS.guiltFree} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Attribution Footer */}
        <Card className="p-6 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 border-violet-200 dark:border-violet-800">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                About the Conscious Spending Plan
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                The Conscious Spending Plan (CSP) was created by Ramit Sethi, author of
                "I Will Teach You To Be Rich." It's a guilt-free approach to managing your money
                that focuses on spending extravagantly on things you love while cutting costs
                mercilessly on things you don't.
              </p>
            </div>
            <a
              href="https://www.iwillteachyoutoberich.com/conscious-spending-basics/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              Visit Ramit's Site
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </a>
          </div>
        </Card>

        {/* CSP Settings Panel */}
        <CSPSettingsPanel
          incomePayees={cspData.incomePayees || []}
          incomeCategories={cspData.incomeCategories || []}
          expenseCategories={cspData.allExpenseCategories || []}
          onTogglePayee={togglePayeeExclusion}
          onToggleCategory={toggleCategoryExclusion}
          onToggleExpenseCategory={toggleExpenseCategoryExclusion}
          onSetCategoryBucket={handleSetCategoryBucket}
          categoryMappings={categoryMappings}
          privacyMode={privacyMode}
          isOpen={showIncomeSettings}
          onClose={() => setShowIncomeSettings(false)}
        />

        {/* Future Goals Panel */}
        <CSPGoalsPanel
          isOpen={goalsState.isPanelOpen}
          onClose={goalsState.closePanel}
          draftIncome={goalsState.draftIncome}
          setDraftIncome={goalsState.setDraftIncome}
          draftBucketAmounts={goalsState.draftBucketAmounts}
          setDraftBucketAmount={goalsState.setDraftBucketAmount}
          hasChanges={goalsState.hasChanges}
          resetDraft={goalsState.resetDraft}
          actualIncome={goalsState.actualIncome}
          actualBuckets={goalsState.actualBuckets}
          projectedData={goalsState.projectedData}
          deltas={goalsState.deltas}
          savedGoals={goalsState.savedGoals}
          activeGoalId={goalsState.activeGoalId}
          saveGoal={goalsState.saveGoal}
          loadGoal={goalsState.loadGoal}
          deleteGoal={goalsState.deleteGoal}
          isLoading={goalsState.isLoading}
          error={goalsState.error}
          setError={goalsState.setError}
        />
      </div>
    </PageTransition>
  );
}
