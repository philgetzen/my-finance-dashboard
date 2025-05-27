import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useYNAB, usePrivacy } from '../../contexts/YNABDataContext';
import { normalizeYNABAccountType } from '../../utils/ynabHelpers';
import Card from '../ui/Card';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';
import PageTransition from '../ui/PageTransition';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';

const COLORS = ['#3B82F6', '#8B5CF6', '#EF4444', '#10B981', '#F59E0B', '#06B6D4'];

// Mobile-friendly Investment Account Card
const InvestmentAccountCard = ({ account, balance, percentage, isPrivacyMode }) => {
  return (
    <div className="bg-purple-50 dark:bg-purple-900/10 rounded-lg p-4 hover:bg-purple-100 dark:hover:bg-purple-900/20 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <ChartBarIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{account.name}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 capitalize mt-1">
              {account.subtype || 'Investment Account'}
            </p>
          </div>
        </div>
        <div className="text-right ml-3">
          <p className={`font-semibold text-purple-600 dark:text-purple-400 text-sm ${isPrivacyMode ? 'filter blur' : ''}`}>
            ${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {percentage.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
};

export default function InvestmentAllocation() {
  const { user, accounts, manualAccounts, isLoading, error } = useYNAB();
  const { isPrivacyMode } = usePrivacy();
  const [tab, setTab] = useState('summary');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Detect mobile screen
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isError = !!error;
  const allAccounts = [...(accounts || []), ...(manualAccounts || [])];
  
  // Filter for investment accounts using normalized account types
  const investmentAccounts = allAccounts.filter(account => {
    const normalizedType = normalizeYNABAccountType(account.type);
    return normalizedType === 'investment';
  });
  
  const investmentAllocation = Object.values(investmentAccounts.reduce((acc, account) => {
    const subtype = account.subtype || 'Investment';
    // Use YNAB balance conversion for YNAB accounts, direct balance for manual accounts
    const balance = account.balance !== undefined ? 
      (typeof account.balance === 'number' ? account.balance / (account.budget_id ? 1000 : 1) : 0) :
      (account.balances?.current || 0);
    
    const displayName = subtype.charAt(0).toUpperCase() + subtype.slice(1);
    acc[subtype] = acc[subtype] || { name: displayName, value: 0 };
    acc[subtype].value += Math.abs(balance); // Use absolute value for investments
    return acc;
  }, {})).filter(item => item.value > 0);

  const totalInvestmentValue = investmentAllocation.reduce((sum, item) => sum + item.value, 0);

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
      <div className="w-full max-w-none space-y-4 pb-4">
        {/* Header - Mobile Optimized */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ChartBarIcon className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 dark:text-purple-400 flex-shrink-0" />
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Investment Allocation</h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Track your portfolio distribution</p>
            </div>
          </div>
          
          {isError && error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm">
              Error: {error?.message || 'Failed to load data'}
            </div>
          )}
        </div>

        {/* Tabs - Mobile Optimized */}
        <div className="border-b border-gray-200 dark:border-gray-700 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[
              { id: 'summary', name: 'Summary' },
              { id: 'detail', name: 'Detail (Coming Soon)' }
            ].map((tabItem) => (
              <button
                key={tabItem.id}
                onClick={() => setTab(tabItem.id)}
                className={`whitespace-nowrap pb-2 px-1 text-sm font-medium transition-colors ${
                  tab === tabItem.id
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tabItem.name}
              </button>
            ))}
          </div>
        </div>

        {tab === 'summary' && (
          <div className="space-y-4">
            {/* Total Investment Value - Mobile Optimized */}
            <Card className="p-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full mb-4">
                  <ArrowTrendingUpIcon className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Investment Value</h2>
                <p className={`text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3 ${isPrivacyMode ? 'filter blur' : ''}`}>
                  ${totalInvestmentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {investmentAccounts.length} investment {investmentAccounts.length === 1 ? 'account' : 'accounts'}
                </p>
              </div>
            </Card>

            {/* Investment Allocation Chart - Mobile Optimized */}
            <Card className="p-4">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Allocation Breakdown</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">By account type</p>
              </div>
              
              {investmentAllocation.length > 0 ? (
                <div className="h-64 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 0, right: 0, bottom: 40, left: 0 }}>
                      <Pie
                        data={investmentAllocation}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        outerRadius={isMobile ? "70%" : "60%"}
                        label={false}
                        stroke="#ffffff"
                        strokeWidth={2}
                      >
                        {investmentAllocation.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => {
                          if (isPrivacyMode) return ['***', 'Value'];
                          return [`$${value.toLocaleString()}`, 'Value'];
                        }}
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <BanknotesIcon className="mx-auto h-10 w-10 mb-3" />
                    <p className="text-sm">No investment accounts found</p>
                    <p className="text-xs mt-1">Connect your investment accounts</p>
                  </div>
                </div>
              )}
            </Card>

            {/* Investment Accounts List - Mobile Optimized */}
            <Card className="p-4">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Investment Accounts</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">All connected investment accounts</p>
              </div>
              
              <div className="space-y-3">
                {investmentAccounts.map((account, index) => {
                  // Use same balance calculation as allocation
                  const balance = account.balance !== undefined ? 
                    (typeof account.balance === 'number' ? Math.abs(account.balance / (account.budget_id ? 1000 : 1)) : 0) :
                    Math.abs(account.balances?.current || 0);
                  const percentage = totalInvestmentValue > 0 ? (balance / totalInvestmentValue) * 100 : 0;
                  
                  return (
                    <InvestmentAccountCard
                      key={account.account_id || account.id}
                      account={account}
                      balance={balance}
                      percentage={percentage}
                      isPrivacyMode={isPrivacyMode}
                    />
                  );
                })}
                
                {investmentAccounts.length === 0 && (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                    <ChartBarIcon className="mx-auto h-10 w-10 mb-3" />
                    <p className="text-sm">No investment accounts connected</p>
                    <p className="text-xs mt-1">Connect your brokerage accounts</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {tab === 'detail' && (
          <Card className="p-6">
            <div className="text-center">
              <ChartBarIcon className="mx-auto h-10 w-10 text-gray-400 mb-3" />
              <h3 className="text-base font-medium text-gray-900 dark:text-white">Detailed Asset Allocation</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Advanced allocation analysis coming soon
              </p>
            </div>
          </Card>
        )}
      </div>
    </PageTransition>
  );
}