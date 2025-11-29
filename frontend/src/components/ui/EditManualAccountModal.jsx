import React, { useState, useEffect } from 'react';
import { useFinanceData } from '../../contexts/ConsolidatedDataContext';
import { useDemoMode } from '../../hooks/useDemoMode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { Alert, AlertDescription } from './alert';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function EditManualAccountModal({ user, account, show, onClose, onAccountUpdated }) {
  const { updateManualAccount, deleteManualAccount } = useFinanceData();
  const { isFeatureEnabled } = useDemoMode();
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

  const handleClose = () => {
    setShowDeleteConfirm(false);
    setError('');
    onClose();
  };

  return (
    <Dialog open={show} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {showDeleteConfirm ? 'Delete Account' : 'Edit Account'}
          </DialogTitle>
          <DialogDescription>
            {showDeleteConfirm
              ? 'This action cannot be undone.'
              : 'Update your manual account details.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <ExclamationTriangleIcon className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!showDeleteConfirm ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Account Name</Label>
              <Input
                id="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Emergency Fund"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Account Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="credit">Credit Card</SelectItem>
                  <SelectItem value="investment">Investment</SelectItem>
                  <SelectItem value="loan">Loan</SelectItem>
                  <SelectItem value="mortgage">Mortgage</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="balance">Current Balance</Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                required
                value={formData.balance}
                onChange={(e) => setFormData(prev => ({ ...prev, balance: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            <DialogFooter className="flex-col gap-3 sm:flex-col">
              <div className="flex gap-3 w-full">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  loading={isLoading}
                  className="flex-1"
                >
                  {isLoading ? 'Updating...' : 'Update Account'}
                </Button>
              </div>

              <div className="pt-4 border-t border-border w-full">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full text-destructive border-destructive hover:bg-destructive/10"
                >
                  Delete Account
                </Button>
              </div>
            </DialogFooter>
          </form>
        ) : (
          <div className="text-center py-4">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-destructive/10 mb-4">
              <ExclamationTriangleIcon className="h-6 w-6 text-destructive" />
            </div>

            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete "{account?.name}"? This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isLoading}
                loading={isLoading}
                className="flex-1"
              >
                {isLoading ? 'Deleting...' : 'Yes, Delete'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
