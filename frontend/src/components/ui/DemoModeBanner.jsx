import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinanceData } from '../../contexts/ConsolidatedDataContext';
import Button from './Button';
import { 
  XMarkIcon, 
  ArrowRightIcon, 
  SparklesIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

/**
 * Conversion banner for demo mode users
 * Displays at the bottom of all demo pages with "Sign Up Now" CTA
 */
export default function DemoModeBanner() {
  const navigate = useNavigate();
  const { isDemoMode, exitDemoMode } = useFinanceData();
  const [isDismissed, setIsDismissed] = useState(false);

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

  return (
    <div className="fixed bottom-16 lg:bottom-4 left-0 right-0 z-50 bg-gradient-to-r from-emerald-600 to-green-600 border-t border-emerald-500 shadow-lg mb-4 lg:mb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          {/* Left side - Message */}
          <div className="flex items-center space-x-3 flex-1 mr-4">
            <div className="flex-shrink-0">
              <SparklesIcon className="h-6 w-6 text-emerald-100 stroke-current" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm sm:text-base font-medium text-white">
                Ready to track your real finances?
              </p>
              <p className="text-xs sm:text-sm text-emerald-100 hidden sm:block">
                Sign up to connect your accounts and start managing your money
              </p>
            </div>
          </div>

          {/* Center - Features (hidden on mobile) */}
          <div className="hidden lg:flex items-center space-x-6 text-emerald-100 text-sm">
            <div className="flex items-center space-x-1">
              <CheckIcon className="h-4 w-4 stroke-current" />
              <span>Secure banking</span>
            </div>
            <div className="flex items-center space-x-1">
              <CheckIcon className="h-4 w-4 stroke-current" />
              <span>Budget tracking</span>
            </div>
            <div className="flex items-center space-x-1">
              <CheckIcon className="h-4 w-4 stroke-current" />
              <span>Investment insights</span>
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Button
              onClick={handleSignUp}
              variant="secondary"
              size="sm"
              className="bg-white text-emerald-700 hover:bg-emerald-50 border-0 font-medium whitespace-nowrap"
            >
              <span className="hidden sm:inline">Sign Up Now</span>
              <span className="sm:hidden">Sign Up</span>
              <ArrowRightIcon className="h-4 w-4 ml-1 sm:ml-2 stroke-current" />
            </Button>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-lg text-emerald-100 hover:bg-emerald-700 transition-colors bg-transparent border-0"
              aria-label="Dismiss banner"
            >
              <XMarkIcon className="h-5 w-5 stroke-current" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact version for smaller screens or specific placements
 */
export function CompactDemoModeBanner() {
  const navigate = useNavigate();
  const { isDemoMode, exitDemoMode } = useFinanceData();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!isDemoMode || isDismissed) {
    return null;
  }

  const handleSignUp = () => {
    window.open('https://www.ynab.com', '_blank');
  };

  return (
    <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <SparklesIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400 stroke-current" />
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Enjoying the demo?
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Sign up to connect your real accounts
            </p>
          </div>
        </div>
        <Button
          onClick={handleSignUp}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
        >
          Get Started
        </Button>
      </div>
    </div>
  );
}