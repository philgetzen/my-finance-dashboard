import React, { useState } from 'react';
import { useFinanceData } from '../../contexts/ConsolidatedDataContext';
import Button from './Button';
import { 
  XMarkIcon, 
  ArrowRightIcon, 
  SparklesIcon
} from '@heroicons/react/24/outline';

/**
 * Floating module for demo mode users
 * Displays in bottom-right corner with "Sign Up Now" CTA
 */
export default function DemoModeFloatingModule() {
  const { isDemoMode } = useFinanceData();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Don't show if not in demo mode or if dismissed
  if (!isDemoMode || isDismissed) {
    return null;
  }

  const handleSignUp = () => {
    window.open('https://www.ynab.com', '_blank');
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  const handleToggleMinimized = () => {
    setIsMinimized(!isMinimized);
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={handleToggleMinimized}
          className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-green-600 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group hover:scale-105"
          aria-label="Expand demo mode options"
        >
          <SparklesIcon className="h-6 w-6 group-hover:animate-pulse" style={{ color: 'white' }} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <SparklesIcon className="h-5 w-5" style={{ color: 'white' }} />
              <span className="text-white font-medium text-sm">Demo Mode</span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={handleToggleMinimized}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Minimize"
              >
                <svg className="h-4 w-4" fill="none" stroke="black" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 12H4" />
                </svg>
              </button>
              <button
                onClick={handleDismiss}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Dismiss"
              >
                <XMarkIcon className="h-4 w-4" style={{ color: 'black' }} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-gray-900 dark:text-white font-semibold text-base mb-2">
            Ready for the real thing?
          </h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
            Connect your actual accounts and start managing your finances with YNAB.
          </p>
          
          {/* Features */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></div>
              Secure bank connections
            </div>
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></div>
              Real-time budget tracking
            </div>
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></div>
              Investment insights
            </div>
          </div>

          {/* CTA Button */}
          <Button
            onClick={handleSignUp}
            variant="primary"
            size="sm"
            className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white border-0 font-medium"
          >
            Sign Up with YNAB
            <ArrowRightIcon className="h-4 w-4 ml-2" style={{ color: 'white' }} />
          </Button>
        </div>
      </div>
    </div>
  );
}