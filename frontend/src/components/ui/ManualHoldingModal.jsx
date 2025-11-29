import React, { useState } from 'react';
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
import LoadingSpinner from './LoadingSpinner';
import { usePlaid } from '../../contexts/PlaidDataContext';

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Manual Holding</DialogTitle>
          <DialogDescription>
            Add a new investment holding to track manually.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ticker">Ticker Symbol *</Label>
            <Input
              type="text"
              id="ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              required
              placeholder="e.g. AAPL"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Input
              type="text"
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="e.g. Apple Inc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountNumber">Account Number (Optional)</Label>
            <Input
              type="text"
              id="accountNumber"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="e.g. 123456789"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                type="number"
                step="any"
                id="quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                placeholder="100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price per Share *</Label>
              <Input
                type="number"
                step="any"
                id="price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                placeholder="150.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="costBasis">Total Cost Basis (Optional)</Label>
            <Input
              type="number"
              step="any"
              id="costBasis"
              value={costBasis}
              onChange={(e) => setCostBasis(e.target.value)}
              placeholder="15000.00"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <LoadingSpinner size="xs" className="mr-2"/> : null}
              Add Holding
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ManualHoldingModal;
