import React, { useState, useMemo, useEffect, Suspense, lazy, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useFinanceData, usePrivacy } from '../../contexts/ConsolidatedDataContext';
import { useConsciousSpendingPlan, useCSPSettings, CSP_TARGETS, CSP_BUCKETS } from '../../hooks/useConsciousSpendingPlan';
import { useCSPGoals } from '../../hooks/useCSPGoals';
import { formatCurrency } from '../../utils/formatters';
import PageTransition from '../ui/PageTransition';
import Card from '../ui/Card';
import PrivacyCurrency from '../ui/PrivacyCurrency';
import CSPGoalsInlinePanel from '../ui/CSPGoalsInlinePanel';

// Lazy load Debug Drawer for development only
const DebugDrawerContainer = lazy(() => import('../DebugDrawer/DebugDrawerContainer'));
import {
  CalendarIcon,
  ChevronDownIcon,
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
  QuestionMarkCircleIcon,
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

// Period options - matches YNAB Spending Report
const PERIOD_OPTIONS = [
  { value: 0, label: 'This Month' },        // Current partial month
  { value: 3, label: 'Last 3 Months' },     // 3 complete months
  { value: 6, label: 'Last 6 Months' },     // 6 complete months
  { value: 12, label: 'Last 12 Months' },   // 12 complete months
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
// Renders via Portal to prevent clipping by overflow:hidden containers
const InfoTooltip = ({ text, className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState({});
  const [arrowPosition, setArrowPosition] = useState('bottom'); // 'bottom' = arrow points down (tooltip above)
  const triggerRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 288; // w-72 = 18rem = 288px
    const tooltipHeight = 120; // Approximate max tooltip height
    const padding = 8; // Padding from viewport edges
    const arrowOffset = 8; // Space for arrow

    // Vertical positioning
    const spaceAbove = triggerRect.top;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const showAbove = spaceAbove >= tooltipHeight || spaceAbove > spaceBelow;

    let top;
    if (showAbove) {
      top = triggerRect.top - arrowOffset;
      setArrowPosition('bottom');
    } else {
      top = triggerRect.bottom + arrowOffset;
      setArrowPosition('top');
    }

    // Horizontal positioning - try to center, but adjust if it would clip
    let left = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
    let arrowLeft = '50%';

    // Check left edge
    if (left < padding) {
      const shift = padding - left;
      left = padding;
      // Adjust arrow to point to trigger
      arrowLeft = `${Math.max(12, tooltipWidth / 2 - shift)}px`;
    }

    // Check right edge
    const rightEdge = left + tooltipWidth;
    if (rightEdge > window.innerWidth - padding) {
      const shift = rightEdge - (window.innerWidth - padding);
      left = window.innerWidth - padding - tooltipWidth;
      // Adjust arrow to point to trigger
      arrowLeft = `${Math.min(tooltipWidth - 12, tooltipWidth / 2 + shift)}px`;
    }

    setTooltipStyle({
      position: 'fixed',
      top: showAbove ? 'auto' : `${top}px`,
      bottom: showAbove ? `${window.innerHeight - top}px` : 'auto',
      left: `${left}px`,
      width: `${tooltipWidth}px`,
      arrowLeft,
    });
  }, []);

  const handleShow = () => {
    updatePosition();
    setIsVisible(true);
  };

  const tooltipContent = isVisible && createPortal(
    <div
      style={{
        position: 'fixed',
        top: tooltipStyle.top,
        bottom: tooltipStyle.bottom,
        left: tooltipStyle.left,
        width: tooltipStyle.width,
        zIndex: 9999,
      }}
    >
      <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg">
        <div className="relative">
          {text}
          {/* Arrow */}
          <div
            className="absolute"
            style={{
              left: tooltipStyle.arrowLeft,
              transform: 'translateX(-50%)',
              ...(arrowPosition === 'bottom'
                ? { top: '100%', marginTop: '-1px' }
                : { bottom: '100%', marginBottom: '-1px' }
              ),
            }}
          >
            <div className={`w-0 h-0 border-l-8 border-r-8 border-transparent ${
              arrowPosition === 'bottom'
                ? 'border-t-8 border-t-gray-900'
                : 'border-b-8 border-b-gray-900'
            }`} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <span
        ref={triggerRef}
        onMouseEnter={handleShow}
        onMouseLeave={() => setIsVisible(false)}
        onClick={(e) => {
          e.stopPropagation();
          if (!isVisible) {
            handleShow();
          } else {
            setIsVisible(false);
          }
        }}
        className="p-0.5 rounded-full text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors cursor-help"
      >
        <QuestionMarkCircleIcon className="h-4 w-4" />
      </span>
      {tooltipContent}
    </span>
  );
};

// Calculation explanations for tooltips
const CALCULATION_EXPLANATIONS = {
  income: 'Your take-home pay: Total income from "Inflow: Ready to Assign" category, averaged over the selected period. Note: This does NOT include refunds or reimbursements (positive amounts in spending categories), which may cause a small difference vs YNAB\'s reported income. Excludes any payees or categories you\'ve marked as excluded.',
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
    <div className="relative w-40 h-40 mx-auto">
      {/* Background circle */}
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={colors.stroke}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold ${colors.text}`}>{score}</span>
        <div className="flex items-center gap-1">
          <span className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">Score</span>
          <InfoTooltip text={CALCULATION_EXPLANATIONS.score} className="ml-0" />
        </div>
      </div>
    </div>
  );
};

// Suggestions Panel - Always visible list of areas needing attention
const SuggestionsPanel = ({ suggestions }) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="flex items-start gap-3">
      <InformationCircleIcon className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 flex flex-wrap gap-x-4 gap-y-1">
        {suggestions.map((suggestion, idx) => (
          <span
            key={idx}
            className="text-sm text-gray-600 dark:text-gray-400"
          >
            {suggestion.message}
          </span>
        ))}
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
    scheduledTransactions,
    isLoading,
  } = useFinanceData();
  const { privacyMode } = usePrivacy();

  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    // Initialize from localStorage if available
    const saved = localStorage.getItem('cspSelectedPeriod');
    return saved ? parseInt(saved, 10) : 6;
  });

  // Sync period changes to localStorage and dispatch event for Debug Drawer
  useEffect(() => {
    localStorage.setItem('cspSelectedPeriod', selectedPeriod.toString());
    window.dispatchEvent(new CustomEvent('csp-period-changed', { detail: selectedPeriod }));
  }, [selectedPeriod]);
  const [showIncomeSettings, setShowIncomeSettings] = useState(false);

  // CSP settings (persisted to Firestore)
  const cspSettings = useCSPSettings();
  const {
    excludedPayees,
    excludedCategories,
    excludedExpenseCategories,
    categoryMappings,
    settings,
    isLoading: cspSettingsLoading,
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
  // Pass scheduledTransactions to include projected recurring income
  const cspData = useConsciousSpendingPlan(
    ynabTransactions,
    categories,
    ynabAccounts,
    selectedPeriod,
    cspSettings,
    months,
    scheduledTransactions
  );

  // Future Goals feature
  const goalsState = useCSPGoals(cspData);

  // Count active exclusions
  const activePayeeExclusions = cspData.incomePayees?.filter(p => p.isExcluded).length || 0;
  const activeCategoryExclusions = cspData.incomeCategories?.filter(c => c.isExcluded).length || 0;
  const activeExpenseExclusions = cspData.allExpenseCategories?.filter(c => c.isExcluded).length || 0;
  const activeExclusionCount = activePayeeExclusions + activeCategoryExclusions + activeExpenseExclusions;

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

  // Wait for both finance data AND CSP settings to load before rendering
  // This prevents race condition where CSP calculates before Firestore mappings are loaded
  if (isLoading || cspSettingsLoading) {
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
                    {opt.label}
                  </option>
                ))}
              </select>
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Integrated Hero Section - Score + Bucket Cards */}
        <Card className="overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col lg:flex-row items-stretch gap-6">
              {/* Left side: Score Ring + Status */}
              <div className="flex flex-col items-center justify-center w-full lg:w-64 lg:min-w-[16rem] p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-800/30">
                <CSPScoreRing buckets={cspData.buckets} isOnTrack={cspData.isOnTrack} />
                <div className="mt-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {cspData.isOnTrack ? (
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    )}
                    <span className={`text-sm font-semibold ${cspData.isOnTrack
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-amber-700 dark:text-amber-300'
                    }`}>
                      {cspData.isOnTrack ? "On Track" : 'Needs Attention'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-1.5">
                    <PrivacyCurrency
                      amount={cspData.monthlyIncome}
                      isPrivacyMode={privacyMode}
                      className="text-lg font-bold text-gray-900 dark:text-white"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">/mo</span>
                    <InfoTooltip text={CALCULATION_EXPLANATIONS.income} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {selectedPeriod === 0 ? 'This month' : `${selectedPeriod} mo avg`}
                  </p>
                </div>
              </div>

              {/* Right side: 2x2 Bucket Progress Cards */}
              <div className="flex-1 grid grid-cols-2 gap-3 w-full">
                {Object.entries(cspData.buckets).map(([key, bucket]) => {
                  const Icon = BUCKET_ICONS[key];
                  const gradient = BUCKET_GRADIENTS[key];
                  const color = BUCKET_COLORS[key];
                  const target = CSP_TARGETS[key];
                  const isOnTarget = bucket.isOnTarget;

                  return (
                    <div
                      key={key}
                      className="relative overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4"
                    >
                      {/* Top: Icon + Name + Status */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg bg-gradient-to-br ${gradient}`}>
                            <Icon className="h-3.5 w-3.5 text-white" />
                          </div>
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {bucket.target.label}
                          </span>
                        </div>
                        {isOnTarget ? (
                          <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
                        )}
                      </div>

                      {/* Amount + Percentage */}
                      <div className="flex items-baseline gap-1.5 mb-2">
                        <PrivacyCurrency
                          amount={bucket.amount}
                          isPrivacyMode={privacyMode}
                          className="text-lg font-bold text-gray-900 dark:text-white"
                        />
                        <span className="text-xs font-medium" style={{ color }}>
                          {bucket.percentage}%
                        </span>
                      </div>

                      {/* Mini Progress Bar with Target Range */}
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                        {/* Target zone indicator */}
                        <div
                          className="absolute h-full bg-gray-300/50 dark:bg-gray-600/50"
                          style={{
                            left: `${Math.min(target.min, 100)}%`,
                            width: `${Math.min(target.max - target.min, 100 - target.min)}%`
                          }}
                        />
                        {/* Actual percentage bar */}
                        <div
                          className={`h-full rounded-full transition-all duration-500 relative z-10 bg-gradient-to-r ${gradient}`}
                          style={{
                            width: `${Math.min(bucket.percentage, 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                        Target: {target.min === target.max ? `${target.min}%` : `${target.min}-${target.max}%`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Suggestions - inline in hero */}
            {cspData.suggestions?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <SuggestionsPanel suggestions={cspData.suggestions} />
              </div>
            )}
          </div>
        </Card>

        {/* Future Goals - Inline collapsible panel */}
        <CSPGoalsInlinePanel
          isOpen={goalsState.isPanelOpen}
          onToggle={() => goalsState.isPanelOpen ? goalsState.closePanel() : goalsState.openPanel()}
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

        {/* Spending Categories - Grouped by Bucket */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Spending Categories
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(cspData.buckets).map(([bucketKey, bucket]) => {
              const Icon = BUCKET_ICONS[bucketKey];
              const gradient = BUCKET_GRADIENTS[bucketKey];
              const bgLight = BUCKET_BG_LIGHT[bucketKey];
              const categories = bucket.categories || [];

              return (
                <div key={bucketKey}>
                  {/* Bucket Header */}
                  <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${bgLight} mb-2`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient}`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {bucket.target.label}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          {bucket.percentage}%
                        </span>
                      </div>
                    </div>
                    <PrivacyCurrency
                      amount={bucket.amount}
                      isPrivacyMode={privacyMode}
                      className="font-bold text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Category List */}
                  {categories.length > 0 ? (
                    <div className="ml-4 pl-4 border-l-2 border-gray-100 dark:border-gray-700 space-y-1">
                      {categories.slice(0, 6).map((cat, idx) => (
                        <div
                          key={cat.name || idx}
                          className="flex items-center justify-between py-1.5 text-sm"
                        >
                          <span className="text-gray-600 dark:text-gray-400 truncate pr-4">
                            {cat.name}
                          </span>
                          <PrivacyCurrency
                            amount={cat.monthlyAmount}
                            isPrivacyMode={privacyMode}
                            className="text-gray-900 dark:text-white font-medium tabular-nums"
                          />
                        </div>
                      ))}
                      {categories.length > 6 && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 py-1">
                          +{categories.length - 6} more categories
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="ml-4 pl-4 text-sm text-gray-400 dark:text-gray-500 italic py-2">
                      No categories in this bucket
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Total Spending Indicator */}
          {(() => {
            const totalPercent = Object.values(cspData.buckets).reduce(
              (sum, bucket) => sum + (bucket.percentage || 0), 0
            );
            const isOver = totalPercent > 100;
            const isUnder = totalPercent < 95;
            return (
              <div className="flex items-center justify-between py-3 px-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl mt-6">
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Total Spending
                </span>
                <span className={`text-sm font-semibold tabular-nums ${
                  isOver ? 'text-red-500' : isUnder ? 'text-blue-500' : 'text-emerald-500'
                }`}>
                  {Math.round(totalPercent)}% of income
                  {isOver && ' (over budget)'}
                </span>
              </div>
            );
          })()}
        </Card>

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

        {/* Debug Drawer - Press 'D' twice to toggle (dev only) */}
        {process.env.NODE_ENV === 'development' && (
          <Suspense fallback={null}>
            <DebugDrawerContainer />
          </Suspense>
        )}
      </div>
    </PageTransition>
  );
}
