import React, { useState, useEffect } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowPathIcon,
  CurrencyDollarIcon,
  BriefcaseIcon,
  ChartBarIcon,
  SparklesIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import { usePrivacy } from '../../contexts/ConsolidatedDataContext';
import { formatCurrency } from '../../utils/formatters';
import { EXPENSE_BUCKETS } from '../../hooks/useIncomeScenario';
import Card from './Card';
import PrivacyCurrency from './PrivacyCurrency';

/**
 * Format number with commas for display (no decimals for annual values)
 */
function formatWithCommas(num) {
  if (num === 0 || num === '') return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Currency input component for scenario values
 * Uses local state for editing to avoid formatting issues while typing
 */
function CurrencyInput({ label, icon: Icon, value, onChange, description, isPrivacyMode }) {
  const [localValue, setLocalValue] = useState(value > 0 ? formatWithCommas(value) : '');
  const [isFocused, setIsFocused] = useState(false);

  // Sync local value when prop changes (e.g., reset to current)
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value > 0 ? formatWithCommas(value) : '');
    }
  }, [value, isFocused]);

  const handleChange = (e) => {
    // Strip everything except digits
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    // Format with commas for display while typing
    setLocalValue(rawValue ? formatWithCommas(parseInt(rawValue, 10)) : '');
    // Update parent with numeric value
    onChange(parseInt(rawValue, 10) || 0);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Ensure formatted on blur
    setLocalValue(value > 0 ? formatWithCommas(value) : '');
  };

  return (
    <div className="flex-1 min-w-[140px]">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-violet-500" />
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm">
          $
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={isPrivacyMode ? '***' : localValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="0"
          disabled={isPrivacyMode}
          className={`w-full pl-7 pr-3 py-2.5 text-sm font-medium
                     bg-gray-50 dark:bg-gray-800
                     border border-gray-200 dark:border-gray-700 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
                     disabled:opacity-50 disabled:cursor-not-allowed
                     text-gray-900 dark:text-white
                     ${isPrivacyMode ? 'privacy-blur' : ''}`}
        />
      </div>
      {description && (
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{description}</p>
      )}
    </div>
  );
}

/**
 * Inline collapsible panel for income scenario planning
 * Designed to sit between summary cards and charts on Runway page
 */
export default function IncomeScenarioPanel({
  // Panel state
  isOpen,
  onToggle,
  // Scenario values
  isEnabled,
  setEnabled,
  salary,
  setSalary,
  bonus,
  setBonus,
  stock,
  setStock,
  // Computed values
  scenarioMonthlyIncome,
  historicalAvgIncome,
  incomeDelta,
  hasScenarioValues,
  // Expense bucket filters
  expenseBuckets,
  toggleExpenseBucket,
  hasExpenseFilters,
  // Expense data by bucket (for showing amounts)
  bucketExpenses = {},
  historicalAvgExpenses = 0,
  scenarioMonthlyExpenses = 0,
  // Actions
  resetToCurrent,
  resetExpenseBuckets,
  // State
  isLoading,
  // Runway impact (optional - passed when scenario affects calculations)
  currentRunwayMonths,
  projectedRunwayMonths,
}) {
  const { privacyMode } = usePrivacy();

  // Calculate percentage change from historical
  const percentChange = historicalAvgIncome > 0
    ? ((incomeDelta / historicalAvgIncome) * 100).toFixed(0)
    : 0;

  return (
    <Card className="overflow-hidden" padding={false}>
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between
                   hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
            <SparklesIcon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Income Scenario Planning
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {isEnabled && (hasScenarioValues || hasExpenseFilters)
                ? `Scenario active${hasExpenseFilters ? ' with expense filters' : ''}`
                : 'Model income and expense scenarios'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick toggle when panel is collapsed */}
          {!isOpen && (hasScenarioValues || hasExpenseFilters) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEnabled(!isEnabled);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors
                ${isEnabled
                  ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
            >
              {isEnabled ? 'Active' : 'Inactive'}
            </button>
          )}

          <div className="p-1.5 rounded-full text-gray-400">
            {isOpen ? (
              <ChevronUpIcon className="h-5 w-5" />
            ) : (
              <ChevronDownIcon className="h-5 w-5" />
            )}
          </div>
        </div>
      </button>

      {/* Expandable content */}
      {isOpen && (
        <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800">
          {isLoading ? (
            <div className="py-8 text-center text-gray-400">Loading...</div>
          ) : (
            <>
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Apply Scenario to Projections
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Override historical income in runway calculations
                  </p>
                </div>
                <button
                  onClick={() => setEnabled(!isEnabled)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full
                             border-2 border-transparent transition-colors duration-200 ease-in-out
                             focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2
                             ${isEnabled ? 'bg-violet-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full
                               bg-white shadow ring-0 transition duration-200 ease-in-out
                               ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                  />
                </button>
              </div>

              {/* Income Inputs */}
              <div className="pt-4 space-y-4">
                <p className="text-[10px] font-medium tracking-[0.2em] text-gray-400 dark:text-gray-500 uppercase">
                  Annual Compensation
                </p>

                <div className="flex flex-wrap gap-4">
                  <CurrencyInput
                    label="Base Salary"
                    icon={BriefcaseIcon}
                    value={salary}
                    onChange={setSalary}
                    description="Pre-tax annual"
                    isPrivacyMode={privacyMode}
                  />
                  <CurrencyInput
                    label="Annual Bonus"
                    icon={CurrencyDollarIcon}
                    value={bonus}
                    onChange={setBonus}
                    description="Expected total"
                    isPrivacyMode={privacyMode}
                  />
                  <CurrencyInput
                    label="Annual Stock"
                    icon={ChartBarIcon}
                    value={stock}
                    onChange={setStock}
                    description="RSU/Options value"
                    isPrivacyMode={privacyMode}
                  />
                </div>
              </div>

              {/* Expense Bucket Filters */}
              <div className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AdjustmentsHorizontalIcon className="h-4 w-4 text-gray-400" />
                    <p className="text-[10px] font-medium tracking-[0.2em] text-gray-400 dark:text-gray-500 uppercase">
                      Expense Categories
                    </p>
                  </div>
                  {hasExpenseFilters && (
                    <button
                      onClick={resetExpenseBuckets}
                      className="text-xs text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      Reset all
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
                  Uncheck categories to see runway without them
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(EXPENSE_BUCKETS).map(([key, { label, description }]) => {
                    const isChecked = expenseBuckets?.[key] ?? true;
                    const bucketAmount = bucketExpenses[key] || 0;

                    return (
                      <button
                        key={key}
                        onClick={() => toggleExpenseBucket(key)}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors text-left
                          ${isChecked
                            ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
                            : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 opacity-60'
                          }`}
                      >
                        <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                          ${isChecked
                            ? 'bg-violet-600 border-violet-600'
                            : 'border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          {isChecked && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isChecked ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                            {label}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                            {description}
                          </p>
                          {bucketAmount > 0 && (
                            <PrivacyCurrency
                              amount={bucketAmount}
                              isPrivacyMode={privacyMode}
                              className={`text-xs mt-1 ${isChecked ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500 line-through'}`}
                            />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Comparison Summary */}
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <div className="grid grid-cols-2 gap-4">
                  {/* Income Comparison */}
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Historical Avg Income
                    </p>
                    <PrivacyCurrency
                      amount={historicalAvgIncome}
                      isPrivacyMode={privacyMode}
                      className="text-lg font-semibold text-gray-600 dark:text-gray-400"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Scenario Income
                    </p>
                    <div className="flex items-baseline gap-2">
                      <PrivacyCurrency
                        amount={scenarioMonthlyIncome}
                        isPrivacyMode={privacyMode}
                        className={`text-lg font-semibold ${
                          isEnabled && hasScenarioValues
                            ? 'text-violet-600 dark:text-violet-400'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      />
                      {hasScenarioValues && incomeDelta !== 0 && (
                        <span className={`text-xs font-medium ${
                          incomeDelta > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {incomeDelta > 0 ? '+' : ''}{percentChange}%
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Expense Comparison */}
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Historical Avg Expenses
                    </p>
                    <PrivacyCurrency
                      amount={historicalAvgExpenses}
                      isPrivacyMode={privacyMode}
                      className="text-lg font-semibold text-gray-600 dark:text-gray-400"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Scenario Expenses
                    </p>
                    <div className="flex items-baseline gap-2">
                      <PrivacyCurrency
                        amount={scenarioMonthlyExpenses}
                        isPrivacyMode={privacyMode}
                        className={`text-lg font-semibold ${
                          isEnabled && hasExpenseFilters
                            ? 'text-violet-600 dark:text-violet-400'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      />
                      {hasExpenseFilters && historicalAvgExpenses > 0 && (
                        <span className={`text-xs font-medium ${
                          scenarioMonthlyExpenses < historicalAvgExpenses
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {((scenarioMonthlyExpenses - historicalAvgExpenses) / historicalAvgExpenses * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Runway Impact Indicator */}
                {isEnabled && (hasScenarioValues || hasExpenseFilters) && currentRunwayMonths !== undefined && projectedRunwayMonths !== undefined && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Runway Impact
                      </p>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span className="text-gray-500 dark:text-gray-400">
                          {isFinite(currentRunwayMonths) ? Math.floor(currentRunwayMonths) : '∞'}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className={
                          projectedRunwayMonths > currentRunwayMonths
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : projectedRunwayMonths < currentRunwayMonths
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-violet-600 dark:text-violet-400'
                        }>
                          {isFinite(projectedRunwayMonths) ? Math.floor(projectedRunwayMonths) : '∞'} months
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex gap-3">
                <button
                  onClick={resetToCurrent}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                           text-sm font-medium text-gray-600 dark:text-gray-400
                           border border-gray-200 dark:border-gray-700 rounded-lg
                           hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  Reset to Current
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
