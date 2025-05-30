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
  const [isProcessingToken, setIsProcessingToken] = useState(false);
  const [connectionError, setConnectionError] = useState(null); // For displaying errors
  const { disconnectYNAB } = useYNAB();
  
  const handleConnect = async () => {
    setConnectionError(null); // Clear previous errors
    try {
      setIsConnecting(true);
      console.log('Starting YNAB connection process...');
      
      // Fetch auth URL from backend
      console.log('Fetching auth URL from backend...');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/ynab/auth`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to get auth URL:', response.status, errorText);
        throw new Error(`Failed to get auth URL: ${response.status}`);
      }
      
      const { authUrl } = await response.json();
      console.log('Got auth URL:', authUrl);
      
      // Open YNAB OAuth in new window
      console.log('Opening YNAB OAuth window...');
      const authWindow = window.open(authUrl, 'ynab-auth', 'width=500,height=600');
      
      if (!authWindow) {
        throw new Error('Failed to open authentication window. Please check popup blockers.');
      }
      
      let checkClosedIntervalId = null;
      let messageListenerAttached = false;

      const cleanupAuthProcess = () => {
        if (messageListenerAttached) {
          window.removeEventListener('message', handleMessage);
          messageListenerAttached = false;
          console.log('Message listener removed.');
        }
        if (checkClosedIntervalId) {
          clearInterval(checkClosedIntervalId);
          checkClosedIntervalId = null;
          console.log('Auth window close checker stopped.');
        }
        if (authWindow && !authWindow.closed) {
          authWindow.close();
          console.log('Auth window closed programmatically.');
        }
        setIsConnecting(false);
        setIsProcessingToken(false);
      };

      // Listen for OAuth callback
      const handleMessage = async (event) => {
        console.log('Received message:', event);
        if (event.origin !== window.location.origin) {
          console.log('Ignoring message from different origin:', event.origin);
          return;
        }

        // Process only once
        if (isProcessingToken && event.data.type === 'ynab-auth-success') {
            console.log('Already processing a token or successfully processed, ignoring duplicate success message.');
            return;
        }
        
        if (event.data.type === 'ynab-auth-success' || event.data.type === 'ynab-auth-error') {
          // Immediately perform cleanup to prevent multiple processing
          cleanupAuthProcess(); 

          if (event.data.type === 'ynab-auth-success') {
            setIsProcessingToken(true); // Set processing flag
            console.log('OAuth success, exchanging code for tokens...');
            const { code } = event.data;
            
            try {
              const tokenResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/ynab/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
              });
              
              if (tokenResponse.ok) {
                const { access_token, refresh_token } = await tokenResponse.json();
                console.log('Token exchange successful');
                await onConnect(access_token, refresh_token);
              } else {
                const errorData = await tokenResponse.json().catch(() => ({error: "Unknown error during token exchange"}));
                console.error('Token exchange failed:', errorData);
                setConnectionError(`Authentication failed: ${errorData.error || 'Unknown error'}`);
              }
            } catch (tokenError) {
              console.error('Error during token exchange:', tokenError);
              setConnectionError(`Token exchange error: ${tokenError.message}`);
            } finally {
              // Reset flags after processing is fully complete
              setIsProcessingToken(false); 
              setIsConnecting(false); 
            }
          } else if (event.data.type === 'ynab-auth-error') {
            console.error('OAuth error:', event.data.error);
            setConnectionError(`Authentication error: ${event.data.error}`);
            // Flags are reset by cleanupAuthProcess, but ensure isConnecting is false
            setIsConnecting(false);
          }
        }
      };
      
      window.addEventListener('message', handleMessage);
      messageListenerAttached = true;
      
      // Clean up if window is closed by user
      checkClosedIntervalId = setInterval(() => {
        if (authWindow.closed) {
          console.log('Auth window was closed by user or completed.');
          cleanupAuthProcess(); // Perform full cleanup
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error connecting to YNAB:', error);
      setConnectionError(`Connection error: ${error.message}`);
      // Ensure flags are reset on outer catch
      setIsConnecting(false);
      setIsProcessingToken(false);
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

            {connectionError && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
                <div className="flex items-center">
                  <ExclamationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                  <span>{connectionError}</span>
                </div>
              </div>
            )}
            
            {!connectionError && (
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
            )}
          </>
        )}
      </div>
    </Card>
  );
}
