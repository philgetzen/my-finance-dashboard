import React, { useState, useEffect, useRef } from 'react';
import {
  XMarkIcon,
  TrashIcon,
  ArrowPathIcon,
  BookmarkIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
import { usePrivacy } from '../../contexts/ConsolidatedDataContext';
import { formatCurrency } from '../../utils/formatters';
import { CSP_BUCKETS } from '../../hooks/useConsciousSpendingPlan';
import { calculateCSPScore } from '../../hooks/useCSPGoals';
import CSPGoalAmountInput from './CSPGoalAmountInput';

// Bucket display configuration - minimal, no color coding
const BUCKET_CONFIG = {
  fixedCosts: {
    label: 'Fixed Costs',
    shortLabel: 'FIXED',
    description: 'Rent, utilities, insurance'
  },
  investments: {
    label: 'Investments',
    shortLabel: 'INVEST',
    description: '401k, IRA, brokerage'
  },
  savings: {
    label: 'Savings',
    shortLabel: 'SAVE',
    description: 'Emergency fund, goals'
  },
  guiltFree: {
    label: 'Guilt-Free',
    shortLabel: 'FREE',
    description: 'Fun stuff'
  }
};

/**
 * Side panel for Future Goals adjustments
 * Slides in from right on desktop, bottom sheet on mobile
 */
export default function CSPGoalsPanel({
  isOpen,
  onClose,
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
  const panelRef = useRef(null);
  const [goalName, setGoalName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [showSavedGoals, setShowSavedGoals] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus trap and body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Focus the panel
      setTimeout(() => panelRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

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

  if (!isOpen) return null;

  // Get score color based on value
  const getScoreColor = (score) => {
    if (score >= 90) return 'text-emerald-500';
    if (score >= 70) return 'text-sky-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-rose-500';
  };

  return (
    <>
      {/* Backdrop - subtle dark overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel - clean, editorial design */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Future Goals"
        className="fixed z-50 bg-white dark:bg-zinc-900
                   csp-goals-panel flex flex-col

                   /* Mobile: Bottom sheet */
                   inset-x-0 bottom-0 h-[85vh] rounded-t-3xl

                   /* Desktop: Side panel - full height */
                   lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[420px] lg:h-full lg:rounded-none"
      >
        {/* Header - minimal, typographic */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-medium tracking-[0.2em] text-zinc-400 dark:text-zinc-500 uppercase mb-1">
                Simulator
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                Future Goals
              </h2>
            </div>
            <button
              onClick={onClose}
              className="mt-1 p-2 -mr-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Close panel"
            >
              <XMarkIcon className="h-5 w-5 text-zinc-400" />
            </button>
          </div>

          {/* Error message - inline */}
          {error && (
            <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>
          )}
        </div>

        {/* Scrollable content - single scroll container */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-6 py-5 space-y-8">

            {/* Income Section */}
            <div>
              <CSPGoalAmountInput
                label="Monthly Income"
                value={draftIncome ?? actualIncome}
                onChange={setDraftIncome}
                currentValue={actualIncome}
                totalIncome={null}
                bucketKey={null}
                step={500}
              />
            </div>

            {/* Divider with projected score preview */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-light tabular-nums ${getScoreColor(projectedData.score)}`}>
                  {projectedData.score}
                </span>
                {deltas.score !== 0 && (
                  <span className={`text-sm font-medium ${
                    deltas.score > 0 ? 'text-emerald-500' : 'text-rose-500'
                  }`}>
                    {deltas.score > 0 ? '+' : ''}{deltas.score}
                  </span>
                )}
              </div>
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
            </div>

            {/* Bucket Inputs - clean grid */}
            <div className="space-y-1">
              {Object.keys(CSP_BUCKETS).map((bucketKey) => {
                const config = BUCKET_CONFIG[bucketKey];
                const currentAmount = actualBuckets[bucketKey] ?? 0;
                const draftAmount = draftBucketAmounts[bucketKey];

                return (
                  <div
                    key={bucketKey}
                    className="py-4 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                  >
                    <CSPGoalAmountInput
                      label={config.label}
                      value={draftAmount ?? currentAmount}
                      onChange={(val) => setDraftBucketAmount(bucketKey, val)}
                      currentValue={currentAmount}
                      totalIncome={projectedData.income}
                      bucketKey={bucketKey}
                      step={100}
                    />
                  </div>
                );
              })}

              {/* Total allocation indicator */}
              {projectedData.income > 0 && (() => {
                const totalAllocated = Object.values(projectedData.buckets).reduce((sum, val) => sum + val, 0);
                const totalPercent = (totalAllocated / projectedData.income) * 100;
                const remaining = projectedData.income - totalAllocated;
                const isOver = remaining < 0;
                const isExact = Math.abs(remaining) < 1;

                // Auto-balance handler - adjusts guilt-free to make total = 100%
                const handleAutoBalance = () => {
                  const currentGuiltFree = projectedData.buckets.guiltFree || 0;
                  const newGuiltFree = currentGuiltFree + remaining;
                  // Only balance if result is positive
                  if (newGuiltFree >= 0) {
                    setDraftBucketAmount('guiltFree', newGuiltFree);
                  }
                };

                return (
                  <div className="pt-4 mt-2 border-t border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        Total Allocated
                      </span>
                      <div className="flex items-center gap-3">
                        {!isExact && (
                          <button
                            onClick={handleAutoBalance}
                            className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                          >
                            Balance →
                          </button>
                        )}
                        <span className={`text-sm tabular-nums font-medium ${
                          isExact ? 'text-emerald-500' :
                          isOver ? 'text-rose-500' :
                          'text-zinc-600 dark:text-zinc-400'
                        }`}>
                          {totalPercent.toFixed(0)}%
                          {isExact && ' ✓'}
                        </span>
                      </div>
                    </div>
                    {!isExact && (
                      <div className={`text-xs mt-1 ${
                        isOver ? 'text-rose-500' : 'text-zinc-400'
                      }`}>
                        {isOver
                          ? `$${formatCurrency(Math.abs(remaining))} over budget — Balance will reduce Guilt-Free`
                          : `$${formatCurrency(remaining)} unallocated — Balance will add to Guilt-Free`
                        }
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Saved Goals Section */}
            <div>
              <button
                onClick={() => setShowSavedGoals(!showSavedGoals)}
                className="flex items-center justify-between w-full text-left group"
              >
                <span className="text-[10px] font-medium tracking-[0.2em] text-zinc-400 dark:text-zinc-500 uppercase">
                  Saved Goals
                  <span className="ml-2 text-zinc-300 dark:text-zinc-600">
                    {savedGoals.length}
                  </span>
                </span>
                <span className="text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-400 transition-colors">
                  {showSavedGoals ? (
                    <ChevronUpIcon className="h-4 w-4" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4" />
                  )}
                </span>
              </button>

              {showSavedGoals && (
                <div className="mt-4 space-y-2">
                  {isLoading ? (
                    <p className="text-sm text-zinc-400 py-4">Loading...</p>
                  ) : savedGoals.length === 0 ? (
                    <p className="text-sm text-zinc-400 py-4">No saved goals yet</p>
                  ) : (
                    savedGoals.map((goal) => {
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
                          className={`w-full text-left p-4 rounded-xl transition-all
                            ${activeGoalId === goal.id
                              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                              : 'bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {goal.name}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className={`text-sm tabular-nums ${
                                activeGoalId === goal.id
                                  ? 'text-white/60 dark:text-zinc-900/60'
                                  : 'text-zinc-400'
                              }`}>
                                {goalScore}
                              </span>
                              <button
                                onClick={(e) => handleDeleteGoal(e, goal.id)}
                                className={`p-1 rounded transition-colors ${
                                  activeGoalId === goal.id
                                    ? 'hover:bg-white/20 dark:hover:bg-zinc-900/20 text-white/60 dark:text-zinc-900/60 hover:text-white dark:hover:text-zinc-900'
                                    : 'hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-400 hover:text-rose-500'
                                }`}
                                aria-label="Delete goal"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div className={`text-sm mt-1 ${
                            activeGoalId === goal.id
                              ? 'text-white/60 dark:text-zinc-900/60'
                              : 'text-zinc-400'
                          } ${privacyMode ? 'privacy-blur' : ''}`}>
                            ${formatCurrency(goal.targetIncome)}/mo
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer - sticky actions */}
        <div className="flex-shrink-0 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 px-6 py-4 space-y-4">
          {/* Save input (toggleable) */}
          {showSaveInput && (
            <div className="flex gap-2">
              <input
                type="text"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                placeholder="Name this goal..."
                className="flex-1 px-4 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800
                         border-0 rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white
                         placeholder:text-zinc-400"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveGoal()}
                autoFocus
              />
              <button
                onClick={handleSaveGoal}
                disabled={isSaving || !goalName.trim()}
                className="px-5 py-2.5 text-sm font-medium bg-zinc-900 dark:bg-white
                         text-white dark:text-zinc-900 rounded-xl
                         hover:bg-zinc-800 dark:hover:bg-zinc-100
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors"
              >
                {isSaving ? '...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setShowSaveInput(false);
                  setGoalName('');
                }}
                className="px-3 py-2 text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                ✕
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={resetDraft}
              disabled={!hasChanges}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium
                       border border-zinc-200 dark:border-zinc-700 rounded-xl
                       text-zinc-600 dark:text-zinc-400
                       hover:bg-zinc-50 dark:hover:bg-zinc-800
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Reset
            </button>
            <button
              onClick={() => setShowSaveInput(true)}
              disabled={!hasChanges}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium
                       bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl
                       hover:bg-zinc-800 dark:hover:bg-zinc-100
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors"
            >
              <BookmarkIcon className="h-4 w-4" />
              Save Goal
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
