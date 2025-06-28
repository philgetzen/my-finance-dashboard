import React from 'react';
import { useFinanceData } from '../../contexts/ConsolidatedDataContext';
import { EyeIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

/**
 * Visual indicator that shows when the user is in demo mode
 * Displays in the top navigation area as a subtle but clear indicator
 */
export default function DemoModeIndicator() {
  const { isDemoMode } = useFinanceData();

  if (!isDemoMode) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-full">
      <EyeIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 stroke-current" />
      <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
        Demo Mode
      </span>
    </div>
  );
}

/**
 * Inline demo mode warning for features that are disabled
 * Used within forms and interactive components
 */
export function DemoModeWarning({ message, className = "" }) {
  const { isDemoMode } = useFinanceData();

  if (!isDemoMode) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg ${className}`}>
      <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 stroke-current" />
      <div>
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
          Feature disabled in demo mode
        </p>
        {message && (
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Small badge indicator for buttons or cards
 */
export function DemoModeBadge({ className = "" }) {
  const { isDemoMode } = useFinanceData();

  if (!isDemoMode) {
    return null;
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700 ${className}`}>
      Demo
    </span>
  );
}