import React, { useState } from 'react';
import { useFinanceData } from '../../contexts/ConsolidatedDataContext';
import { DemoModeWarning } from './DemoModeIndicator';
import { useDemoMode } from '../../hooks/useDemoMode';
import Card from './Card';
import Button from './Button';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function ManualAccountModal({ user, show, onClose, onAccountAdded }) {
  const { createManualAccount } = useFinanceData();
  const { isFeatureEnabled, getDisabledMessage } = useDemoMode();
  const [manualForm, setManualForm] = useState({ 
    name: '', 
    type: 'checking', 
    subtype: '', 
    balance: '' 
  });
  const [manualError, setManualError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent double submission
    
    setManualError('');
    setIsSubmitting(true);

    try {
      if (!manualForm.name || !manualForm.type || !manualForm.balance) {
        setManualError('Name, type, and balance are required.');
        return;
      }

      if (!user) {
        setManualError('You must be logged in to add an account.');
        return;
      }

      await createManualAccount({
        name: manualForm.name.trim(),
        type: manualForm.type,
        subtype: manualForm.subtype.trim(),
        balance: parseFloat(manualForm.balance) || 0,
      });
      
      // Reset form and close modal
      setManualForm({ name: '', type: 'checking', subtype: '', balance: '' });
      onClose();
      onAccountAdded?.();
    } catch (err) {
      setManualError('Failed to add manual account. Please try again.');
      console.error("Error adding manual account:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setManualForm({ name: '', type: 'checking', subtype: '', balance: '' });
      setManualError('');
      onClose();
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md">
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Manual Account</h2>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <DemoModeWarning 
            message={getDisabledMessage('create_account')}
            className="mb-4"
          />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Account Name
              </label>
              <input
                type="text"
                placeholder="e.g., Chase Savings"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                value={manualForm.name}
                onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))}
                disabled={!isFeatureEnabled('create_account')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Account Type
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                value={manualForm.type}
                onChange={e => setManualForm(f => ({ ...f, type: e.target.value }))}
                disabled={!isFeatureEnabled('create_account')}
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="investment">Investment</option>
                <option value="credit">Credit Card</option>
                <option value="loan">Loan</option>
                <option value="mortgage">Mortgage</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Subtype (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., savings, checking"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                value={manualForm.subtype}
                onChange={e => setManualForm(f => ({ ...f, subtype: e.target.value }))}
                disabled={!isFeatureEnabled('create_account')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Balance
              </label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                value={manualForm.balance}
                onChange={e => setManualForm(f => ({ ...f, balance: e.target.value }))}
                disabled={!isFeatureEnabled('create_account')}
              />
            </div>

            {manualError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm">
                {manualError}
              </div>
            )}

            <div className="flex space-x-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || !isFeatureEnabled('create_account')}
                className="flex-1"
              >
                {isSubmitting ? 'Adding...' : 'Add Account'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
