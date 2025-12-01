import React from 'react';
import { ArrowPathIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { useFinanceData } from '../../contexts/ConsolidatedDataContext';

/**
 * SyncStatus - Shows the current sync status with YNAB
 * Displays loading, synced, or error states
 */
export default function SyncStatus({ compact = false }) {
  const { isLoading, error, ynabToken, isDemoMode } = useFinanceData();

  // Don't show sync status in demo mode or when not connected
  if (isDemoMode) {
    return null;
  }

  if (!ynabToken) {
    return compact ? null : (
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <ExclamationCircleIcon className="h-4 w-4" />
        <span>Not connected</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <ArrowPathIcon className="h-4 w-4 animate-spin" />
        <span className={compact ? 'sr-only' : ''}>Syncing...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-500 dark:text-red-400">
        <ExclamationCircleIcon className="h-4 w-4" />
        <span className={compact ? 'sr-only' : ''}>Sync error</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
      <CheckCircleIcon className="h-4 w-4" />
      <span className={compact ? 'sr-only' : ''}>Synced</span>
    </div>
  );
}
