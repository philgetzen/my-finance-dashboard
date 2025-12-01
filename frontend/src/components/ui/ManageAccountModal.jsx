import React from 'react';
import { XMarkIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Button from './Button';
import Card from './Card';

export default function ManageAccountModal({ account, show, onClose, onRemove, isLoading }) {
  if (!show || !account) return null;

  const handleRemove = async () => {
    if (onRemove) {
      await onRemove(account);
    }
    onClose();
  };

  const getAccountSource = () => {
    switch (account.sourceType) {
      case 'ynab':
        return 'YNAB Synced';
      case 'manual':
        return 'Manual Account';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Manage Account
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-6">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">
            {account.name}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            {account.subtype || account.type} • {getAccountSource()}
          </p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            ${(account.balances?.current || account.balance || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="space-y-4">
          {account.sourceType === 'ynab' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start">
                <ExclamationTriangleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                    YNAB Account Management
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    YNAB accounts are read-only and managed through your YNAB application. To remove this account, disconnect your YNAB integration.
                  </p>
                </div>
              </div>
            </div>
          )}

          {account.sourceType === 'manual' && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                    Delete Manual Account
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    This will permanently remove this manual account and all associated data.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>

            {account.sourceType === 'manual' && (
              <Button
                variant="destructive"
                onClick={handleRemove}
                loading={isLoading}
                className="flex-1 flex items-center justify-center gap-2"
              >
                <TrashIcon className="h-4 w-4" />
                {isLoading ? 'Deleting...' : 'Delete'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
