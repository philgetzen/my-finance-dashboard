import React, { useState } from 'react';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner'; // Import LoadingSpinner component
import { usePlaid } from '../../contexts/PlaidDataContext'; // Use PlaidDataContext for user authentication

const ManualHoldingModal = ({ isOpen, onClose, onHoldingAdded }) => {
  const { user } = usePlaid(); // Get user from PlaidDataContext
  const [ticker, setTicker] = useState('');
  const [description, setDescription] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [costBasis, setCostBasis] = useState(''); // Optional
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!user || !user.uid) {
      setError('User not authenticated.');
      setIsSubmitting(false);
      return;
    }

    if (!ticker || !description || !quantity || !price) {
      setError('Ticker, Description, Quantity, and Price are required.');
      setIsSubmitting(false);
      return;
    }

    const holdingData = {
      ticker,
      description,
      accountNumber,
      quantity: parseFloat(quantity),
      price: parseFloat(price),
      costBasis: costBasis ? parseFloat(costBasis) : null,
    };

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/manual-holdings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: user.uid, holdingData }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add manual holding.');
      }

      onHoldingAdded(); // Callback to refetch or update holdings list
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset form fields
    setTicker('');
    setDescription('');
    setAccountNumber('');
    setQuantity('');
    setPrice('');
    setCostBasis('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Add Manual Holding</h2>
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="ticker" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ticker Symbol*</label>
            <input type="text" id="ticker" value={ticker} onChange={(e) => setTicker(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description*</label>
            <input type="text" id="description" value={description} onChange={(e) => setDescription(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
          </div>
          <div>
            <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account Number (Optional)</label>
            <input type="text" id="accountNumber" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Quantity*</label>
              <input type="number" step="any" id="quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Price per Share*</label>
              <input type="number" step="any" id="price" value={price} onChange={(e) => setPrice(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
            </div>
          </div>
          <div>
            <label htmlFor="costBasis" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Total Cost Basis (Optional)</label>
            <input type="number" step="any" id="costBasis" value={costBasis} onChange={(e) => setCostBasis(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? <LoadingSpinner size="xs" className="mr-2"/> : null}
              Add Holding
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualHoldingModal;
