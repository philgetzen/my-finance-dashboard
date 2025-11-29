import React, { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Button } from './button';
import { Input } from './input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog';

export default function ManageHoldingsModal({
  show,
  onClose,
  account,
  existingHoldings = [],
  onSaveHoldings
}) {
  const [holdings, setHoldings] = useState([]);
  const [newHolding, setNewHolding] = useState({
    symbol: '',
    shares: '',
    price: ''
  });

  // Initialize with existing holdings when modal opens
  useEffect(() => {
    if (show && existingHoldings.length > 0) {
      setHoldings(existingHoldings);
    } else if (show) {
      setHoldings([]);
    }
  }, [show, existingHoldings]);

  const handleAddHolding = () => {
    if (newHolding.symbol && newHolding.shares && newHolding.price) {
      const holding = {
        symbol: newHolding.symbol.toUpperCase(),
        shares: parseFloat(newHolding.shares),
        price: parseFloat(newHolding.price)
      };

      setHoldings([...holdings, holding]);
      setNewHolding({ symbol: '', shares: '', price: '' });
    }
  };

  const handleRemoveHolding = (index) => {
    setHoldings(holdings.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSaveHoldings(account.id, holdings);
    onClose();
  };

  const totalValue = holdings.reduce((sum, h) => sum + (h.shares * h.price), 0);

  if (!account) return null;

  return (
    <Dialog open={show} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Holdings - {account.name}</DialogTitle>
          <DialogDescription>
            Add or edit holdings for this investment account.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 pr-2">
          {/* Add new holding form */}
          <div className="p-4 mb-4 bg-muted rounded-lg border border-border">
            <h3 className="text-sm font-medium text-foreground mb-3">
              Add New Holding
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Input
                type="text"
                placeholder="Symbol (e.g. AAPL)"
                value={newHolding.symbol}
                onChange={(e) => setNewHolding({ ...newHolding, symbol: e.target.value })}
                maxLength="10"
              />
              <Input
                type="number"
                placeholder="Shares"
                value={newHolding.shares}
                onChange={(e) => setNewHolding({ ...newHolding, shares: e.target.value })}
                step="0.001"
              />
              <Input
                type="number"
                placeholder="Price per share"
                value={newHolding.price}
                onChange={(e) => setNewHolding({ ...newHolding, price: e.target.value })}
                step="0.01"
              />
              <Button
                onClick={handleAddHolding}
                disabled={!newHolding.symbol || !newHolding.shares || !newHolding.price}
                className="flex items-center justify-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          {/* Holdings list */}
          <div className="space-y-2">
            {holdings.length === 0 ? (
              <div className="p-8 text-center bg-muted rounded-lg border border-border">
                <p className="text-muted-foreground">
                  No holdings added yet. Add holdings to track this account's investments.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-5 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground uppercase">
                  <div>Symbol</div>
                  <div className="text-right">Shares</div>
                  <div className="text-right">Price</div>
                  <div className="text-right">Value</div>
                  <div></div>
                </div>
                {holdings.map((holding, index) => {
                  const value = holding.shares * holding.price;
                  return (
                    <div key={index} className="p-4 grid grid-cols-5 gap-2 items-center bg-muted rounded-lg border border-border">
                      <div className="font-medium text-foreground">
                        {holding.symbol}
                      </div>
                      <div className="text-right text-muted-foreground">
                        {holding.shares}
                      </div>
                      <div className="text-right text-muted-foreground">
                        ${holding.price.toFixed(2)}
                      </div>
                      <div className="text-right font-medium text-green-600 dark:text-green-400">
                        ${value.toFixed(2)}
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleRemoveHolding(index)}
                          className="p-1.5 hover:bg-background rounded-lg transition-colors bg-transparent border-0"
                        >
                          <TrashIcon className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Summary */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Total Holdings Value</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  ${totalValue.toFixed(2)}
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                {holdings.length} holding{holdings.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Holdings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
