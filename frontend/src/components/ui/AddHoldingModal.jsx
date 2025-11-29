import React, { useState, useRef } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Alert, AlertDescription } from './alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog';
import {
  PlusIcon,
  TrashIcon,
  DocumentArrowUpIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

export default function AddHoldingModal({ show, onClose, onAddHoldings }) {
  const [holdings, setHoldings] = useState([
    { ticker: '', shares: '', price: '', account: '' }
  ]);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  // Add a new holding row
  const addHoldingRow = () => {
    setHoldings([...holdings, { ticker: '', shares: '', price: '', account: '' }]);
  };

  // Remove a holding row
  const removeHolding = (index) => {
    setHoldings(holdings.filter((_, i) => i !== index));
  };

  // Update a holding field
  const updateHolding = (index, field, value) => {
    const updated = [...holdings];
    updated[index][field] = value;
    setHoldings(updated);
  };

  // Handle CSV file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadError('');

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      // Parse CSV (expecting headers: ticker,shares,price,account)
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
      const tickerIndex = headers.findIndex(h => h.includes('ticker') || h.includes('symbol'));
      const sharesIndex = headers.findIndex(h => h.includes('shares') || h.includes('quantity'));
      const priceIndex = headers.findIndex(h => h.includes('price') || h.includes('cost'));
      const accountIndex = headers.findIndex(h => h.includes('account'));

      if (tickerIndex === -1 || sharesIndex === -1) {
        setUploadError('CSV must contain ticker/symbol and shares/quantity columns');
        return;
      }

      const parsedHoldings = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values[tickerIndex]) {
          parsedHoldings.push({
            ticker: values[tickerIndex],
            shares: values[sharesIndex] || '',
            price: priceIndex !== -1 ? values[priceIndex] || '' : '',
            account: accountIndex !== -1 ? values[accountIndex] || '' : ''
          });
        }
      }

      if (parsedHoldings.length > 0) {
        setHoldings(parsedHoldings);
      } else {
        setUploadError('No valid holdings found in CSV');
      }
    } catch (error) {
      setUploadError('Error parsing CSV file');
    }
  };

  // Handle form submission
  const handleSubmit = () => {
    // Filter out empty rows and validate
    const validHoldings = holdings.filter(h => h.ticker && h.shares);

    if (validHoldings.length === 0) {
      setUploadError('Please add at least one holding with ticker and shares');
      return;
    }

    // Convert shares and price to numbers
    const processedHoldings = validHoldings.map(h => ({
      ...h,
      shares: parseFloat(h.shares) || 0,
      price: h.price ? parseFloat(h.price) : null
    }));

    onAddHoldings(processedHoldings);
    onClose();
  };

  return (
    <Dialog open={show} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Investment Holdings</DialogTitle>
          <DialogDescription>
            Add holdings manually or upload a CSV file.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 pr-2">
          {/* CSV Upload Section */}
          <Alert variant="info" className="mb-4">
            <InformationCircleIcon className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium mb-1">Upload CSV File</p>
              <p className="text-xs mb-3">
                CSV should contain columns: ticker/symbol, shares/quantity, price (optional), account (optional)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <DocumentArrowUpIcon className="h-4 w-4" />
                Choose CSV File
              </Button>
            </AlertDescription>
          </Alert>

          {uploadError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}

          {/* Manual Entry Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                    Ticker *
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                    Shares *
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                    Price
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                    Account
                  </th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {holdings.map((holding, index) => (
                  <tr key={index}>
                    <td className="px-3 py-2">
                      <Input
                        type="text"
                        value={holding.ticker}
                        onChange={(e) => updateHolding(index, 'ticker', e.target.value.toUpperCase())}
                        placeholder="AAPL"
                        className="h-8"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        value={holding.shares}
                        onChange={(e) => updateHolding(index, 'shares', e.target.value)}
                        placeholder="100"
                        step="0.001"
                        className="h-8"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        value={holding.price}
                        onChange={(e) => updateHolding(index, 'price', e.target.value)}
                        placeholder="150.00"
                        step="0.01"
                        className="h-8"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="text"
                        value={holding.account}
                        onChange={(e) => updateHolding(index, 'account', e.target.value)}
                        placeholder="Brokerage"
                        className="h-8"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {holdings.length > 1 && (
                        <button
                          onClick={() => removeHolding(index)}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors bg-transparent border-0"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Row Button */}
          <div className="mt-4">
            <Button
              onClick={addHoldingRow}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              Add Row
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Add Holdings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
