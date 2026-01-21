import React, { useState } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowPathIcon,
  BookmarkIcon,
  TrashIcon,
  RocketLaunchIcon,
  HomeIcon,
  ChartBarIcon,
  BanknotesIcon,
  SparklesIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { usePrivacy } from '../../contexts/ConsolidatedDataContext';
import { formatCurrency } from '../../utils/formatters';
import { CSP_BUCKETS, CSP_TARGETS } from '../../hooks/useConsciousSpendingPlan';
import { calculateCSPScore } from '../../hooks/useCSPGoals';
import Card from './Card';
import PrivacyCurrency from './PrivacyCurrency';
import CSPGoalAmountInput from './CSPGoalAmountInput';

// Bucket visual config
const BUCKET_ICONS = {
  fixedCosts: HomeIcon,
  investments: ChartBarIcon,
  savings: BanknotesIcon,
  guiltFree: SparklesIcon
};

const BUCKET_GRADIENTS = {
  fixedCosts: 'from-indigo-500 to-violet-600',
  investments: 'from-emerald-500 to-teal-600',
  savings: 'from-blue-500 to-cyan-600',
  guiltFree: 'from-amber-500 to-orange-600'
};

const BUCKET_COLORS = {
  fixedCosts: 'text-indigo-500',
  investments: 'text-emerald-500',
  savings: 'text-blue-500',
  guiltFree: 'text-amber-500'
};

/**
 * Inline collapsible panel for CSP Future Goals planning
 * Designed to sit between hero section and spending categories on CSP page
 * Pattern: Matches IncomeScenarioPanel for consistency
 */
export default function CSPGoalsInlinePanel({
  // Panel state
  isOpen,
  onToggle,
  // Draft state
  draftIncome,
  setDraftIncome,
  draftBucketAmounts,
  setDraftBucketAmount,
  hasChanges,
  resetDraft,
  // Actual values
  actualIncome,
  actualBuckets,
  // Projected values
  projectedData,
  deltas,
  // Goals
  savedGoals,
  activeGoalId,
  saveGoal,
  loadGoal,
  deleteGoal,
  // State
  isLoading,
  error,
  setError
}) {
  const { privacyMode } = usePrivacy();
  const [goalName, setGoalName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Get score color based on value
  const getScoreColor = (score) => {
    if (score >= 90) return 'text-emerald-500';
    if (score >= 70) return 'text-sky-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-rose-500';
  };

  // Handle save goal
  const handleSaveGoal = async () => {
    if (!goalName.trim()) {
      setError('Please enter a goal name');
      return;
    }

    setIsSaving(true);
    const success = await saveGoal(goalName.trim());
    setIsSaving(false);

    if (success) {
      setGoalName('');
      setShowSaveInput(false);
    }
  };

  // Handle load goal
  const handleLoadGoal = (goalId) => {
    loadGoal(goalId);
  };

  // Handle delete goal
  const handleDeleteGoal = async (e, goalId) => {
    e.stopPropagation();
    if (window.confirm('Delete this goal?')) {
      await deleteGoal(goalId);
    }
  };

  // Auto-balance handler - adjusts guilt-free to make total = 100%
  // If overspent, sets guilt-free to 0 and proportionally reduces other buckets
  const handleAutoBalance = () => {
    if (projectedData.income <= 0) return;

    const totalAllocated = Object.values(projectedData.buckets).reduce((sum, val) => sum + val, 0);
    const remaining = projectedData.income - totalAllocated;
    const currentGuiltFree = projectedData.buckets.guiltFree || 0;
    const newGuiltFree = currentGuiltFree + remaining;

    if (newGuiltFree >= 0) {
      // Simple case: just adjust guilt-free
      setDraftBucketAmount('guiltFree', newGuiltFree);
    } else {
      // Overspent case: set guilt-free to 0, then scale down other buckets proportionally
      setDraftBucketAmount('guiltFree', 0);

      // Calculate how much we're still over after zeroing guilt-free
      const otherBucketsTotal = totalAllocated - currentGuiltFree;
      const targetTotal = projectedData.income; // We want other buckets to sum to income

      if (otherBucketsTotal > targetTotal && otherBucketsTotal > 0) {
        // Scale factor to bring other buckets down to fit
        const scaleFactor = targetTotal / otherBucketsTotal;

        // Apply scale to each non-guilt-free bucket
        ['fixedCosts', 'investments', 'savings'].forEach(key => {
          const currentVal = projectedData.buckets[key] || 0;
          setDraftBucketAmount(key, Math.round(currentVal * scaleFactor));
        });
      }
    }
  };

  // Calculate total allocation stats
  const totalAllocated = projectedData.income > 0
    ? Object.values(projectedData.buckets).reduce((sum, val) => sum + val, 0)
    : 0;
  const totalPercent = projectedData.income > 0
    ? (totalAllocated / projectedData.income) * 100
    : 0;
  const remaining = projectedData.income - totalAllocated;
  const isOver = remaining < 0;
  const isExact = Math.abs(remaining) < 1;

  return (
    <Card className="overflow-hidden" padding={false}>
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between
                   hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-lg shadow-md">
            <RocketLaunchIcon className="h-5 w-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Future Goals
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {hasChanges
                ? `Scenario active • Score: ${projectedData.score}`
                : 'Plan your ideal spending allocation'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick status when panel is collapsed */}
          {!isOpen && hasChanges && (
            <div className="flex items-center gap-2">
              <span className={`text-lg font-semibold tabular-nums ${getScoreColor(projectedData.score)}`}>
                {projectedData.score}
              </span>
              {deltas.score !== 0 && (
                <span className={`text-xs font-medium ${
                  deltas.score > 0 ? 'text-emerald-500' : 'text-rose-500'
                }`}>
                  {deltas.score > 0 ? '+' : ''}{deltas.score}
                </span>
              )}
            </div>
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
        <div className="px-5 pb-4 border-t border-gray-100 dark:border-gray-800">
          {isLoading ? (
            <div className="py-6 text-center text-gray-400">Loading...</div>
          ) : (
            <>
              {/* Error message */}
              {error && (
                <div className="mt-3 p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-800">
                  <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
                </div>
              )}

              {/* Top Row: Income + Score - centered and visually distinct */}
              <div className="pt-4 pb-5 flex justify-center">
                <div className="px-8 py-5 rounded-2xl bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-indigo-500/10 dark:from-violet-500/20 dark:via-purple-500/20 dark:to-indigo-500/20 border border-violet-200/50 dark:border-violet-500/30">
                  {/* Labels row */}
                  <div className="flex items-center gap-8 mb-2">
                    <div className="flex-1 text-center pl-12">
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Monthly Income</span>
                    </div>
                    <div className="w-px" /> {/* Spacer for divider */}
                    <div className="text-center min-w-[60px]">
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Score</span>
                    </div>
                  </div>

                  {/* Values row - icon, input, divider, score all vertically centered */}
                  <div className="flex items-center gap-6">
                    {/* Income section */}
                    <div className="flex items-center gap-6">
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md">
                        <CurrencyDollarIcon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setDraftIncome(Math.max(0, (draftIncome ?? actualIncome) - 500))}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/80 dark:bg-zinc-700/80 text-zinc-500 hover:bg-white dark:hover:bg-zinc-600 transition-colors text-sm font-medium shadow-sm"
                        >
                          −
                        </button>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-violet-400 text-base">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatCurrency(draftIncome ?? actualIncome)}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, '');
                              const numValue = parseInt(raw, 10);
                              if (!isNaN(numValue)) {
                                setDraftIncome(numValue);
                              } else if (raw === '') {
                                setDraftIncome(0);
                              }
                            }}
                            className={`w-36 pl-6 pr-2 py-1.5 text-center text-xl font-bold tabular-nums text-violet-600 dark:text-violet-400
                                       bg-white/60 dark:bg-zinc-800/60 rounded-lg border-0
                                       focus:outline-none focus:ring-2 focus:ring-violet-500/50
                                       ${privacyMode ? 'privacy-blur' : ''}`}
                          />
                        </div>
                        <button
                          onClick={() => setDraftIncome((draftIncome ?? actualIncome) + 500)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/80 dark:bg-zinc-700/80 text-zinc-500 hover:bg-white dark:hover:bg-zinc-600 transition-colors text-sm font-medium shadow-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="w-px h-10 bg-violet-300/50 dark:bg-violet-500/30" />

                    {/* Score display */}
                    <div className="flex items-center justify-center gap-1.5 min-w-[60px]">
                      <span className={`text-3xl font-bold tabular-nums ${getScoreColor(projectedData.score)}`}>
                        {projectedData.score}
                      </span>
                      {deltas.score !== 0 && (
                        <span className={`text-sm font-medium ${deltas.score > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {deltas.score > 0 ? '+' : ''}{deltas.score}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bucket Inputs - Visual cards with icons */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {Object.entries(CSP_BUCKETS).map(([bucketKey, bucket]) => {
                  const currentAmount = actualBuckets[bucketKey] ?? 0;
                  const draftAmount = draftBucketAmounts[bucketKey];
                  const value = draftAmount ?? currentAmount;
                  const Icon = BUCKET_ICONS[bucketKey];
                  const gradient = BUCKET_GRADIENTS[bucketKey];
                  const colorClass = BUCKET_COLORS[bucketKey];
                  const target = CSP_TARGETS[bucketKey];
                  const percentage = projectedData.income > 0 ? (value / projectedData.income) * 100 : 0;
                  const isOnTarget = bucketKey === 'fixedCosts' || bucketKey === 'guiltFree'
                    ? percentage <= target.max
                    : percentage >= target.min;
                  const delta = value - currentAmount;

                  return (
                    <div
                      key={bucketKey}
                      className="relative overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3"
                    >
                      {/* Colored accent bar at top */}
                      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`} />

                      {/* Header with icon */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1 rounded-md bg-gradient-to-br ${gradient}`}>
                          <Icon className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                          {bucket.label}
                        </span>
                      </div>

                      {/* Amount with +/- controls */}
                      <div className="flex items-center justify-between mb-2">
                        <button
                          onClick={() => setDraftBucketAmount(bucketKey, Math.max(0, value - 100))}
                          className="w-6 h-6 flex items-center justify-center rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                        >
                          <span className="text-sm font-medium">−</span>
                        </button>
                        <div className="relative flex-1 mx-1">
                          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatCurrency(value)}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, '');
                              const numValue = parseInt(raw, 10);
                              if (!isNaN(numValue)) {
                                setDraftBucketAmount(bucketKey, numValue);
                              } else if (raw === '') {
                                setDraftBucketAmount(bucketKey, 0);
                              }
                            }}
                            className={`w-full pl-4 pr-1 py-0.5 text-center text-base font-bold tabular-nums ${colorClass}
                                       bg-transparent rounded border-0
                                       focus:outline-none focus:bg-white/50 dark:focus:bg-zinc-700/50
                                       ${privacyMode ? 'privacy-blur' : ''}`}
                          />
                        </div>
                        <button
                          onClick={() => setDraftBucketAmount(bucketKey, value + 100)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                        >
                          <span className="text-sm font-medium">+</span>
                        </button>
                      </div>

                      {/* Mini progress bar */}
                      <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden mb-1">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-300`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>

                      {/* Percentage and target */}
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`font-medium tabular-nums ${isOnTarget ? 'text-zinc-500' : 'text-amber-500'}`}>
                          {percentage.toFixed(0)}%
                        </span>
                        <span className="text-zinc-400">
                          {bucketKey === 'fixedCosts' || bucketKey === 'guiltFree' ? `≤${target.max}%` : `≥${target.min}%`}
                        </span>
                        {delta !== 0 && (
                          <span className={`font-medium ${delta > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {delta > 0 ? '+' : ''}{formatCurrency(delta)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer: Total + Saved Goals + Actions - all in one row */}
              <div className="mt-4 flex flex-wrap items-center gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                {/* Total allocation */}
                <div className="flex items-center gap-2">
                  <span className={`text-sm tabular-nums font-semibold ${
                    isExact ? 'text-emerald-500' :
                    isOver ? 'text-rose-500' :
                    'text-zinc-600 dark:text-zinc-300'
                  }`}>
                    {totalPercent.toFixed(0)}%
                  </span>
                  {!isExact && (
                    <>
                      <span className={`text-xs ${isOver ? 'text-rose-400' : 'text-zinc-400'}`}>
                        {isOver ? 'over' : `$${formatCurrency(remaining)} left`}
                      </span>
                      <button
                        onClick={handleAutoBalance}
                        className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                        title="Add remaining to Guilt-Free"
                      >
                        Balance
                      </button>
                    </>
                  )}
                  {isExact && <span className="text-emerald-500 text-xs">✓</span>}
                </div>

                {/* Divider */}
                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />

                {/* Saved Goals pills */}
                {savedGoals.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-400 uppercase">Goals:</span>
                    {savedGoals.map((goal) => {
                      const goalPercentages = {
                        fixedCosts: goal.targetIncome > 0 ? (goal.bucketAmounts.fixedCosts / goal.targetIncome) * 100 : 0,
                        investments: goal.targetIncome > 0 ? (goal.bucketAmounts.investments / goal.targetIncome) * 100 : 0,
                        savings: goal.targetIncome > 0 ? (goal.bucketAmounts.savings / goal.targetIncome) * 100 : 0,
                        guiltFree: goal.targetIncome > 0 ? (goal.bucketAmounts.guiltFree / goal.targetIncome) * 100 : 0
                      };
                      const goalScore = calculateCSPScore(goalPercentages);

                      return (
                        <button
                          key={goal.id}
                          onClick={() => handleLoadGoal(goal.id)}
                          className={`px-2 py-1 rounded text-xs transition-all flex items-center gap-1.5
                            ${activeGoalId === goal.id
                              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                              : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-zinc-600 dark:text-zinc-300'
                            }`}
                        >
                          <span className="font-medium">{goal.name}</span>
                          <span className="opacity-60">{goalScore}</span>
                          <button
                            onClick={(e) => handleDeleteGoal(e, goal.id)}
                            className="opacity-40 hover:opacity-100 hover:text-rose-500 transition-opacity"
                            aria-label="Delete goal"
                          >
                            <TrashIcon className="h-3 w-3" />
                          </button>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  {showSaveInput ? (
                    <>
                      <input
                        type="text"
                        value={goalName}
                        onChange={(e) => setGoalName(e.target.value)}
                        placeholder="Goal name..."
                        className="w-32 px-2 py-1 text-xs text-zinc-900 dark:text-zinc-100
                                 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded
                                 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white
                                 placeholder:text-zinc-400"
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveGoal()}
                        autoFocus
                      />
                      <button
                        onClick={handleSaveGoal}
                        disabled={isSaving || !goalName.trim()}
                        className="px-2 py-1 text-xs font-medium bg-zinc-900 dark:bg-white
                                 text-white dark:text-zinc-900 rounded
                                 disabled:opacity-40 transition-colors"
                      >
                        {isSaving ? '...' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setShowSaveInput(false); setGoalName(''); }}
                        className="text-xs text-zinc-400 hover:text-zinc-600"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={resetDraft}
                        disabled={!hasChanges}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400
                                 hover:text-gray-700 dark:hover:text-gray-200
                                 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ArrowPathIcon className="h-3 w-3" />
                        Reset
                      </button>
                      <button
                        onClick={() => setShowSaveInput(true)}
                        disabled={!hasChanges}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium
                                 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded
                                 hover:bg-zinc-800 dark:hover:bg-zinc-100
                                 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <BookmarkIcon className="h-3 w-3" />
                        Save
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
