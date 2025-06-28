import React, { useState, useEffect } from 'react';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import Button from './Button';

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

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 pb-0">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Manage Holdings - {account.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Add or edit holdings for this investment account
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors bg-transparent border-0"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
          {/* Add new holding form */}
          <div className="p-4 mb-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Add New Holding
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Symbol (e.g. AAPL)"
                value={newHolding.symbol}
                onChange={(e) => setNewHolding({ ...newHolding, symbol: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                maxLength="10"
              />
              <input
                type="number"
                placeholder="Shares"
                value={newHolding.shares}
                onChange={(e) => setNewHolding({ ...newHolding, shares: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                step="0.001"
              />
              <input
                type="number"
                placeholder="Price per share"
                value={newHolding.price}
                onChange={(e) => setNewHolding({ ...newHolding, price: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                step="0.01"
              />
              <Button
                onClick={handleAddHolding}
                disabled={!newHolding.symbol || !newHolding.shares || !newHolding.price}
                variant="primary"
                size="md"
                className="flex items-center justify-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          {/* Holdings list */}
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-2">
              {holdings.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-gray-500 dark:text-gray-400">
                    No holdings added yet. Add holdings to track this account's investments.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-5 gap-2 px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    <div>Symbol</div>
                    <div className="text-right">Shares</div>
                    <div className="text-right">Price</div>
                    <div className="text-right">Value</div>
                    <div></div>
                  </div>
                  {holdings.map((holding, index) => {
                    const value = holding.shares * holding.price;
                    return (
                      <div key={index} className="p-4 grid grid-cols-5 gap-2 items-center bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {holding.symbol}
                        </div>
                        <div className="text-right text-gray-600 dark:text-gray-400">
                          {holding.shares}
                        </div>
                        <div className="text-right text-gray-600 dark:text-gray-400">
                          ${holding.price.toFixed(2)}
                        </div>
                        <div className="text-right font-medium text-green-600 dark:text-green-400">
                          ${value.toFixed(2)}
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleRemoveHolding(index)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors bg-transparent border-0"
                          >
                            <TrashIcon className="h-4 w-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* Summary and actions */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Holdings Value</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  ${totalValue.toFixed(2)}
                </p>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {holdings.length} holding{holdings.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={onClose}
                className="px-4 py-2 rounded-lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                variant="primary"
              >
                Save Holdings
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
