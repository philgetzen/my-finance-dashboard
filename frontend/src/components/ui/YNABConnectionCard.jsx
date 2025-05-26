import React, { useState } from 'react';
import { useYNAB } from '../../contexts/YNABDataContext';
import Card from './Card';
import Button from './Button';
import {
  CheckCircleIcon,
  LinkIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

export default function YNABConnectionCard({ onConnect, isConnected, compact = false }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { disconnectYNAB } = useYNAB();
  
  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      
      // Fetch auth URL from backend
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/ynab/auth`);
      const { authUrl } = await response.json();
      
      // Open YNAB OAuth in new window
      const authWindow = window.open(authUrl, 'ynab-auth', 'width=500,height=600');
      
      // Listen for OAuth callback
      const handleMessage = async (event) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'ynab-auth-success') {
          const { code } = event.data;
          
          // Exchange code for tokens
          const tokenResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/ynab/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
          });
          
          if (tokenResponse.ok) {
            const { access_token, refresh_token } = await tokenResponse.json();
            await onConnect(access_token, refresh_token);
          }
          
          window.removeEventListener('message', handleMessage);
          setIsConnecting(false);
        }
      };
      
      window.addEventListener('message', handleMessage);
      
      // Clean up if window is closed
      const checkClosed = setInterval(() => {
        if (authWindow.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setIsConnecting(false);
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error connecting to YNAB:', error);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectYNAB();
    } catch (error) {
      console.error('Error disconnecting YNAB:', error);
    }
  };

  if (compact) {
    if (isConnected) {
      return (
        <Button
          onClick={handleDisconnect}
          variant="outline"
          className="flex items-center gap-2"
        >
          <CheckCircleIcon className="h-4 w-4 text-green-600" />
          YNAB Connected
        </Button>
      );
    }
    
    return (
      <Button
        onClick={handleConnect}
        disabled={isConnecting}
        variant="outline"
        className="flex items-center gap-2"
      >
        <LinkIcon className="h-4 w-4" />
        {isConnecting ? 'Connecting...' : 'Connect YNAB'}
      </Button>
    );
  }

  return (
    <Card>
      <div className="text-center">
        {isConnected ? (
          <>
            <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              YNAB Connected
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Your YNAB budget is connected and syncing.
            </p>
            <Button
              onClick={handleDisconnect}
              variant="outline"
              className="text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Disconnect YNAB
            </Button>
          </>
        ) : (
          <>
            <LinkIcon className="mx-auto h-12 w-12 text-blue-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Connect Your YNAB Budget
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Connect your YNAB account to sync your budget, accounts, and transactions.
            </p>
            
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full sm:w-auto"
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              {isConnecting ? 'Connecting...' : 'Connect YNAB'}
            </Button>
            
            <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-start">
                <ExclamationCircleIcon className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm text-blue-700 dark:text-blue-400 font-medium mb-1">
                    Secure Connection
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-300">
                    Your YNAB credentials are never stored. We use OAuth to securely connect to your budget.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}