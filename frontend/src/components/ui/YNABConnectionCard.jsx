import React, { useState } from 'react';
import Card from './Card';
import Button from './Button';
import { useInitializeYNAB, useYNABBudgets } from '../../hooks/useYNABData';
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  LinkIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

export default function YNABConnectionCard({ onConnect, isConnected, compact = false }) {
  const [accessToken, setAccessToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [error, setError] = useState('');
  
  const initializeYNAB = useInitializeYNAB();
  const { data: budgets, isLoading: budgetsLoading, error: budgetsError } = useYNABBudgets(isConnected);

  const handleConnect = async () => {
    if (!accessToken.trim()) {
      setError('Please enter your YNAB Personal Access Token');
      return;
    }

    setError('');
    try {
      await initializeYNAB.mutateAsync(accessToken);
      onConnect?.(accessToken);
      setShowTokenInput(false);
      setAccessToken('');
    } catch (err) {
      console.error('Error connecting to YNAB:', err);
      setError('Failed to connect to YNAB. Please check your access token and try again.');
    }
  };

  const handleDisconnect = () => {
    setAccessToken('');
    setShowTokenInput(false);
    setError('');
    onConnect?.(null);
  };

  if (isConnected) {
    if (compact) {
      return (
        <Button
          variant="outline"
          onClick={handleDisconnect}
          className="text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
        >
          <CheckCircleIcon className="h-4 w-4" />
          Disconnect YNAB
        </Button>
      );
    }
    
    return (
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircleIcon className="h-8 w-8 text-green-500 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                YNAB Connected
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {budgetsLoading ? 'Loading budgets...' : 
                 budgetsError ? 'Error loading budgets' :
                 `${budgets?.length || 0} budget(s) available`}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleDisconnect}
            className="text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Disconnect
          </Button>
        </div>
        
        {budgetsError && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
              <p className="text-sm text-red-700 dark:text-red-400">
                Error loading YNAB data: {budgetsError.message}
              </p>
            </div>
          </div>
        )}
      </Card>
    );
  }

  if (compact && !showTokenInput) {
    return (
      <Button
        onClick={() => setShowTokenInput(true)}
        className="flex items-center gap-2"
      >
        <LinkIcon className="h-4 w-4" />
        Connect YNAB
      </Button>
    );
  }
  
  if (compact && showTokenInput) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder="YNAB Access Token"
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        <Button
          onClick={handleConnect}
          disabled={!accessToken.trim() || initializeYNAB.isPending}
          className="text-sm px-3 py-2"
        >
          {initializeYNAB.isPending ? 'Connecting...' : 'Connect'}
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowTokenInput(false)}
          className="text-sm px-3 py-2"
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <div className="text-center">
        <LinkIcon className="mx-auto h-12 w-12 text-blue-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Connect Your YNAB Account
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Import your budgets, accounts, and transactions from You Need A Budget (YNAB)
        </p>

        {!showTokenInput ? (
          <div className="space-y-4">
            <Button onClick={() => setShowTokenInput(true)} className="w-full">
              Connect YNAB
            </Button>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-start">
                <InformationCircleIcon className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm text-blue-700 dark:text-blue-400 font-medium mb-1">
                    You'll need a YNAB Personal Access Token
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-300">
                    Get yours from: YNAB → Account Settings → Developer Settings → Personal Access Tokens
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="ynab-token" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                YNAB Personal Access Token
              </label>
              <input
                id="ynab-token"
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Enter your YNAB Personal Access Token"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="flex items-center">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <Button
                onClick={handleConnect}
                disabled={initializeYNAB.isPending}
                className="flex-1"
              >
                {initializeYNAB.isPending ? 'Connecting...' : 'Connect'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowTokenInput(false);
                  setAccessToken('');
                  setError('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 text-left">
                <strong>Note:</strong> Your access token is stored locally and only used to connect to YNAB's API. 
                We never store or transmit your token to our servers.
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}