import React from 'react';
import { TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog';
import { Button } from './button';
import { Alert, AlertDescription, AlertTitle } from './alert';

export default function ManageAccountModal({ account, show, onClose, onRemove, isLoading }) {
  if (!account) return null;

  const handleRemove = async () => {
    if (onRemove) {
      await onRemove(account);
    }
    onClose();
  };

  const getAccountSource = () => {
    switch (account.sourceType) {
      case 'plaid':
        return 'Plaid Connected';
      case 'ynab':
        return 'YNAB Synced';
      default:
        return 'Unknown';
    }
  };

  return (
    <Dialog open={show} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Account</DialogTitle>
          <DialogDescription>
            View and manage your connected account.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <h3 className="font-medium text-foreground mb-2">
            {account.name}
          </h3>
          <p className="text-sm text-muted-foreground mb-1">
            {account.subtype || account.type} - {getAccountSource()}
          </p>
          <p className="text-lg font-semibold text-foreground">
            ${(account.balances?.current || account.balance || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="space-y-4">
          {account.sourceType === 'plaid' && (
            <Alert variant="warning">
              <ExclamationTriangleIcon className="h-4 w-4" />
              <AlertTitle>Disconnect Plaid Account</AlertTitle>
              <AlertDescription>
                This will remove the connection to your bank account. You can reconnect it later by adding a new bank account.
              </AlertDescription>
            </Alert>
          )}

          {account.sourceType === 'ynab' && (
            <Alert variant="info">
              <ExclamationTriangleIcon className="h-4 w-4" />
              <AlertTitle>YNAB Account Management</AlertTitle>
              <AlertDescription>
                YNAB accounts are read-only and managed through your YNAB application. To remove this account, disconnect your YNAB integration.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>

            {account.sourceType === 'plaid' && (
              <Button
                variant="destructive"
                onClick={handleRemove}
                loading={isLoading}
                className="flex items-center gap-2"
              >
                <TrashIcon className="h-4 w-4" />
                {isLoading ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
