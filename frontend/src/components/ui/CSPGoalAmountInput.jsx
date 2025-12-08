import React, { useState, useEffect, useCallback } from 'react';
import { MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { usePrivacy } from '../../contexts/ConsolidatedDataContext';
import { formatCurrency } from '../../utils/formatters';
import { CSP_TARGETS } from '../../hooks/useConsciousSpendingPlan';

/**
 * Amount input with +/- steppers for CSP goal adjustments
 * Clean, minimal design with subtle interactions
 */
export default function CSPGoalAmountInput({
  label,
  value,
  onChange,
  currentValue,
  totalIncome,
  bucketKey = null,
  step = 100,
  min = 0,
  max = 999999,
  className = ''
}) {
  const { privacyMode } = usePrivacy();
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setInputValue(value?.toString() || '');
    }
  }, [value, isFocused]);

  const percentage = bucketKey && totalIncome > 0
    ? (value / totalIncome) * 100
    : null;

  const target = bucketKey ? CSP_TARGETS[bucketKey] : null;

  const isOnTarget = target
    ? (bucketKey === 'fixedCosts' || bucketKey === 'guiltFree')
      ? percentage <= target.max
      : percentage >= target.min
    : true;

  const delta = value - (currentValue ?? value);
  const hasDelta = Math.abs(delta) >= 1;

  const handleInputChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setInputValue(raw);
  };

  const handleInputBlur = () => {
    setIsFocused(false);
    const numValue = parseInt(inputValue, 10);
    if (!isNaN(numValue)) {
      const clamped = Math.max(min, Math.min(max, numValue));
      onChange(clamped);
    } else {
      setInputValue(value?.toString() || '');
    }
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    setInputValue(value?.toString() || '');
  };

  const handleIncrement = useCallback(() => {
    const newValue = Math.min(max, (value || 0) + step);
    onChange(newValue);
  }, [value, step, max, onChange]);

  const handleDecrement = useCallback(() => {
    const newValue = Math.max(min, (value || 0) - step);
    onChange(newValue);
  }, [value, step, min, onChange]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleIncrement();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleDecrement();
    } else if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Label row with percentage */}
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {label}
        </span>
        {percentage !== null && (
          <span className={`text-xs tabular-nums ${
            isOnTarget ? 'text-zinc-400' : 'text-amber-500'
          }`}>
            {percentage.toFixed(0)}%
            {target && (
              <span className="text-zinc-300 dark:text-zinc-600 ml-1">
                / {bucketKey === 'fixedCosts' || bucketKey === 'guiltFree'
                  ? `≤${target.max}`
                  : `≥${target.min}`}%
              </span>
            )}
          </span>
        )}
      </div>

      {/* Input with inline steppers */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={handleDecrement}
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center
                     rounded-l-xl bg-zinc-100 dark:bg-zinc-800
                     hover:bg-zinc-200 dark:hover:bg-zinc-700
                     text-zinc-500 dark:text-zinc-400
                     transition-colors focus:outline-none focus:z-10 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
          aria-label={`Decrease ${label} by $${step}`}
        >
          <MinusIcon className="h-4 w-4" />
        </button>

        <div className="relative flex-1">
          <input
            type="text"
            inputMode="numeric"
            value={isFocused ? inputValue : formatCurrency(value || 0)}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            className={`w-full h-10 px-4 text-center font-medium text-lg tabular-nums
                       bg-zinc-50 dark:bg-zinc-800
                       border-y border-zinc-200 dark:border-zinc-700
                       focus:outline-none focus:bg-white dark:focus:bg-zinc-700
                       transition-colors
                       ${hasDelta ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300'}
                       ${privacyMode ? 'privacy-blur' : ''}`}
            aria-label={label}
          />
          {/* Dollar sign overlay */}
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm pointer-events-none">
            $
          </span>
        </div>

        <button
          type="button"
          onClick={handleIncrement}
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center
                     rounded-r-xl bg-zinc-100 dark:bg-zinc-800
                     hover:bg-zinc-200 dark:hover:bg-zinc-700
                     text-zinc-500 dark:text-zinc-400
                     transition-colors focus:outline-none focus:z-10 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
          aria-label={`Increase ${label} by $${step}`}
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Delta indicator - only show when changed */}
      {hasDelta && (
        <div className={`flex items-center justify-end text-xs ${privacyMode ? 'privacy-blur' : ''}`}>
          <span className="text-zinc-400 mr-1">was ${formatCurrency(currentValue ?? value)}</span>
          <span className={`font-medium ${
            delta > 0 ? 'text-emerald-500' : 'text-rose-500'
          }`}>
            {delta > 0 ? '+' : ''}{formatCurrency(delta)}
          </span>
        </div>
      )}
    </div>
  );
}
