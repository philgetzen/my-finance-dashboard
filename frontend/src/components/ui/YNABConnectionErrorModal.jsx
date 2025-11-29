import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './dialog';
import { Button } from './button';
import { Alert, AlertDescription } from './alert';
import YNABConnectionCard from './YNABConnectionCard';

export default function YNABConnectionErrorModal({ show, onClose, onReconnect, error }) {
  return (
    <Dialog open={show} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
              <ExclamationTriangleIcon className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <DialogTitle>YNAB Connection Error</DialogTitle>
              <DialogDescription>
                Your YNAB connection needs to be refreshed
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error.message || 'Unable to fetch YNAB data. Please reconnect your account.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <YNABConnectionCard
            onConnect={onReconnect}
            isConnected={false}
            compact={false}
          />

          <Button
            variant="outline"
            onClick={onClose}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
