import React, { useState, useRef } from 'react';
import Button from './Button';
import { 
  XMarkIcon, 
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

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add Investment Holdings
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors bg-transparent border-0"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* CSV Upload Section */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-start gap-3">
              <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2">
                  Upload CSV File
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
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
              </div>
            </div>
          </div>

          {uploadError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">{uploadError}</p>
            </div>
          )}

          {/* Manual Entry Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Ticker *
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Shares *
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Price
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Account
                  </th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {holdings.map((holding, index) => (
                  <tr key={index}>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={holding.ticker}
                        onChange={(e) => updateHolding(index, 'ticker', e.target.value.toUpperCase())}
                        placeholder="AAPL"
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={holding.shares}
                        onChange={(e) => updateHolding(index, 'shares', e.target.value)}
                        placeholder="100"
                        step="0.001"
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={holding.price}
                        onChange={(e) => updateHolding(index, 'price', e.target.value)}
                        placeholder="150.00"
                        step="0.01"
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={holding.account}
                        onChange={(e) => updateHolding(index, 'account', e.target.value)}
                        placeholder="Brokerage"
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {holdings.length > 1 && (
                        <button
                          onClick={() => removeHolding(index)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors bg-transparent border-0"
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <Button
            onClick={onClose}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="primary"
          >
            Add Holdings
          </Button>
        </div>
      </div>
    </div>
  );
}
