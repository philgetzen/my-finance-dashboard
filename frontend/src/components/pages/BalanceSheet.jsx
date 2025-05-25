import React, { useState } from 'react';
import { usePlaid } from '../../contexts/PlaidDataContext';
import { useCombinedFinanceData } from '../../hooks/useCombinedFinanceData';
import Card from '../ui/Card';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';
import PageTransition from '../ui/PageTransition';
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ScaleIcon,
} from '@heroicons/react/24/outline';

export default function BalanceSheet() {
  const { user } = usePlaid();
  const { accounts, isLoading, isError, error } = useCombinedFinanceData(user?.uid);
  const [tab, setTab] = useState('current');


  const allAccounts = accounts || [];
  const liabilityTypes = ['credit', 'loan', 'mortgage', 'credit_card', 'creditCard'];
  
  // Helper function to check if an account is a liability
  const isLiability = (account) => {
    const type = account.type?.toLowerCase();
    const subtype = account.subtype?.toLowerCase();
    const name = account.name?.toLowerCase();
    
    // Check for credit card indicators in various fields
    return (
      liabilityTypes.some(liability => type?.includes(liability)) ||
      liabilityTypes.some(liability => subtype?.includes(liability)) ||
      name?.includes('credit') ||
      name?.includes('card') ||
      type === 'credit' ||
      subtype === 'credit_card'
    );
  };
  
  const totalAssets = allAccounts.reduce((sum, acc) => {
    const bal = acc.balances?.current ?? acc.balance ?? 0;
    return !isLiability(acc) ? sum + bal : sum;
  }, 0);

  const totalLiabilities = allAccounts.reduce((sum, acc) => {
    const bal = acc.balances?.current ?? acc.balance ?? 0;
    return isLiability(acc) ? sum + Math.abs(bal) : sum;
  }, 0);

  const netWorth = totalAssets - totalLiabilities;

  const assets = allAccounts.filter(acc => !isLiability(acc));
  const liabilities = allAccounts.filter(acc => isLiability(acc));

  if (isLoading && !accounts && !isError) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="w-full max-w-none space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Error Display */}
      {isError && error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 sm:p-4 rounded-lg text-sm sm:text-base">
          Error: {error?.message || 'Failed to load data'}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <ScaleIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Balance Sheet</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Complete overview of your financial position</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex flex-col sm:flex-row gap-2">
          {[
            { id: 'current', name: 'Current' },
            { id: 'details', name: 'Details (Coming Soon)' },
            { id: 'historical', name: 'Historical (Coming Soon)' }
          ].map((tabItem) => (
            <Button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              variant={tab === tabItem.id ? 'primary' : 'outline'}
              size="sm"
            >
              {tabItem.name}
            </Button>
          ))}
        </div>
      </div>

      {tab === 'current' && (
        <div className="space-y-4 sm:space-y-6 lg:space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                    <ArrowTrendingUpIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Assets</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                    ${totalAssets.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                    <ArrowTrendingDownIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Liabilities</p>
                  <p className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">
                    ${totalLiabilities.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                    <ScaleIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Net Worth</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                    ${netWorth.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Assets and Liabilities Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            {/* Assets */}
            <Card>
              <div className="mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Assets</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  ${totalAssets.toLocaleString(undefined, { maximumFractionDigits: 2 })} total
                </p>
              </div>
              <div className="space-y-2 sm:space-y-3">
                {assets.map(account => (
                  <div
                    key={account.account_id || account.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 bg-green-50 dark:bg-green-900/10 rounded-lg gap-1 sm:gap-0"
                  >
                    <div>
                      <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">{account.name}</p>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {account.subtype || account.type || 'Account'}
                      </p>
                    </div>
                    <p className="text-sm sm:text-base font-semibold text-green-600 dark:text-green-400">
                      ${(account.balances?.current ?? account.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
                {assets.length === 0 && (
                  <div className="text-center py-3 sm:py-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    No assets found
                  </div>
                )}
              </div>
            </Card>

            {/* Liabilities */}
            <Card>
              <div className="mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Liabilities</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  ${totalLiabilities.toLocaleString(undefined, { maximumFractionDigits: 2 })} total
                </p>
              </div>
              <div className="space-y-2 sm:space-y-3">
                {liabilities.map(account => (
                  <div
                    key={account.account_id || account.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 bg-red-50 dark:bg-red-900/10 rounded-lg gap-1 sm:gap-0"
                  >
                    <div>
                      <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">{account.name}</p>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {account.subtype || account.type || 'Account'}
                      </p>
                    </div>
                    <p className="text-sm sm:text-base font-semibold text-red-600 dark:text-red-400">
                      ${Math.abs(account.balances?.current ?? account.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
                {liabilities.length === 0 && (
                  <div className="text-center py-3 sm:py-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    No liabilities found
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'details' && (
        <Card>
          <div className="text-center py-8 sm:py-12">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">Detailed Balance Sheet</h3>
            <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Advanced balance sheet features coming soon
            </p>
          </div>
        </Card>
      )}

      {tab === 'historical' && (
        <Card>
          <div className="text-center py-8 sm:py-12">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">Historical Balance Sheet</h3>
            <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Historical tracking and trends coming soon
            </p>
          </div>
        </Card>
      )}
      </div>
    </PageTransition>
  );
}