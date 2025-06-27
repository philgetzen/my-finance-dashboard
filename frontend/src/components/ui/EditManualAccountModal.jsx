import React, { useState, useEffect } from 'react';
import { useFinanceData } from '../../contexts/ConsolidatedDataContext';
import { DemoModeWarning } from './DemoModeIndicator';
import { useDemoMode } from '../../hooks/useDemoMode';
import Button from './Button';
import {
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

export default function EditManualAccountModal({ user, account, show, onClose, onAccountUpdated }) {
  const { updateManualAccount, deleteManualAccount } = useFinanceData();
  const { isFeatureEnabled, getDisabledMessage } = useDemoMode();
  const [formData, setFormData] = useState({
    name: '',
    type: 'checking',
    balance: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name || '',
        type: account.type || 'checking',
        balance: account.balance?.toString() || '',
      });
    }
  }, [account]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !account) return;

    setError('');
    setIsLoading(true);

    try {
      await updateManualAccount(account.id, {
        name: formData.name.trim(),
        type: formData.type,
        balance: parseFloat(formData.balance) || 0,
      });

      onAccountUpdated?.();
    } catch (err) {
      console.error('Error updating account:', err);
      setError('Failed to update account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !account) return;

    setError('');
    setIsLoading(true);

    try {
      await deleteManualAccount(account.id);
      onAccountUpdated?.();
    } catch (err) {
      console.error('Error deleting account:', err);
      setError('Failed to delete account. Please try again.');
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Edit Account
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            </div>
          )}

          {!showDeleteConfirm ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Account Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Account Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="e.g., Emergency Fund"
                />
              </div>

              {/* Account Type */}
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Account Type
                </label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="credit">Credit Card</option>
                  <option value="investment">Investment</option>
                  <option value="loan">Loan</option>
                  <option value="mortgage">Mortgage</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Balance */}
              <div>
                <label htmlFor="balance" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Balance
                </label>
                <input
                  id="balance"
                  name="balance"
                  type="number"
                  step="0.01"
                  required
                  value={formData.balance}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="0.00"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? 'Updating...' : 'Update Account'}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>

              {/* Delete Button */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Delete Account
                </Button>
              </div>
            </form>
          ) : (
            /* Delete Confirmation */
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Delete Account
              </h3>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete "{account?.name}"? This action cannot be undone.
              </p>
              
              <div className="flex gap-3">
                <Button
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {isLoading ? 'Deleting...' : 'Yes, Delete'}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}