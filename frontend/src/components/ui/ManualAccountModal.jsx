import React, { useState } from 'react';
import { useFinanceData } from '../../contexts/ConsolidatedDataContext';
import { DemoModeWarning } from './DemoModeIndicator';
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
    if (isSubmitting) return;

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

  return (
    <Dialog open={show} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Manual Account</DialogTitle>
          <DialogDescription>
            Add a manual account to track balances not connected to YNAB.
          </DialogDescription>
        </DialogHeader>

        <DemoModeWarning
          message={getDisabledMessage('create_account')}
          className="mb-4"
        />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Account Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="e.g., Chase Savings"
              value={manualForm.name}
              onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))}
              disabled={!isFeatureEnabled('create_account')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Account Type</Label>
            <Select
              value={manualForm.type}
              onValueChange={(value) => setManualForm(f => ({ ...f, type: value }))}
              disabled={!isFeatureEnabled('create_account')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checking">Checking</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
                <SelectItem value="investment">Investment</SelectItem>
                <SelectItem value="credit">Credit Card</SelectItem>
                <SelectItem value="loan">Loan</SelectItem>
                <SelectItem value="mortgage">Mortgage</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subtype">Subtype (Optional)</Label>
            <Input
              id="subtype"
              type="text"
              placeholder="e.g., savings, checking"
              value={manualForm.subtype}
              onChange={e => setManualForm(f => ({ ...f, subtype: e.target.value }))}
              disabled={!isFeatureEnabled('create_account')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="balance">Balance</Label>
            <Input
              id="balance"
              type="number"
              step="any"
              placeholder="0.00"
              value={manualForm.balance}
              onChange={e => setManualForm(f => ({ ...f, balance: e.target.value }))}
              disabled={!isFeatureEnabled('create_account')}
            />
          </div>

          {manualError && (
            <Alert variant="destructive">
              <AlertDescription>{manualError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !isFeatureEnabled('create_account')}
              loading={isSubmitting}
            >
              {isSubmitting ? 'Adding...' : 'Add Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
