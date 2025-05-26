import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { usePlaid } from '../../contexts/PlaidDataContext';
import { useCombinedFinanceData } from '../../hooks/useCombinedFinanceData';
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

export default function InvestmentAllocation() {
  const { user } = usePlaid();
  const { accounts, isLoading, isError, error } = useCombinedFinanceData(user?.uid);
  const [tab, setTab] = useState('summary');


  const allAccounts = accounts || [];
  const investmentAccounts = allAccounts.filter(account => account.type === 'investment');
  
  const investmentAllocation = Object.values(investmentAccounts.reduce((acc, account) => {
    const subtype = account.subtype || account.type || 'other';
    const balance = typeof account.balances?.current === 'number' ? account.balances.current : (typeof account.balance === 'number' ? account.balance : 0);
    acc[subtype] = acc[subtype] || { name: subtype.charAt(0).toUpperCase() + subtype.slice(1), value: 0 };
    acc[subtype].value += balance;
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
      <div className="w-full max-w-none space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ChartBarIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white text-left">Investment Allocation</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 text-left">Track your investment portfolio distribution</p>
          {isError && error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 sm:p-4 rounded-lg text-sm sm:text-base mt-4">
              Error: {error?.message || 'Failed to load data'}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex flex-col sm:flex-row gap-2">
          {[
            { id: 'summary', name: 'Summary' },
            { id: 'detail', name: 'Detail (Coming Soon)' }
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

      {tab === 'summary' && (
        <div className="space-y-4 sm:space-y-6 lg:space-y-8">
          {/* Total Investment Value */}
          <Card className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                <ArrowTrendingUpIcon className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
            </div>
            <h2 className="text-base sm:text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">Total Investment Value</h2>
            <p className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              ${totalInvestmentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            <div className="flex items-center justify-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              <span className="mr-2">{investmentAccounts.length}</span>
              <span>investment {investmentAccounts.length === 1 ? 'account' : 'accounts'}</span>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            {/* Investment Allocation Chart */}
            <Card>
              <div className="mb-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Allocation Breakdown</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">By account type</p>
              </div>
              
              {investmentAllocation.length > 0 ? (
                <div className="h-80 sm:h-96 lg:h-[400px] min-h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 20, right: 30, bottom: 60, left: 30 }}>
                      <Pie
                        data={investmentAllocation}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="40%"
                        outerRadius="60%"
                        innerRadius="0%"
                        label={false}
                        stroke="#ffffff"
                        strokeWidth={2}
                      >
                        {investmentAllocation.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`$${value.toLocaleString()}`, 'Value']}
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        wrapperStyle={{ paddingTop: '20px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 sm:h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <BanknotesIcon className="mx-auto h-8 sm:h-12 w-8 sm:w-12 mb-4" />
                    <p className="text-sm sm:text-base">No investment accounts found</p>
                    <p className="text-xs sm:text-sm mt-1">Connect your investment accounts to see allocation</p>
                  </div>
                </div>
              )}
            </Card>

            {/* Investment Accounts List */}
            <Card>
              <div className="mb-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Investment Accounts</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">All connected investment accounts</p>
              </div>
              
              <div className="space-y-2 sm:space-y-3">
                {investmentAccounts.map((account, index) => {
                  const balance = account.balances?.current ?? account.balance ?? 0;
                  const percentage = totalInvestmentValue > 0 ? (balance / totalInvestmentValue) * 100 : 0;
                  
                  return (
                    <div
                      key={account.account_id || account.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/20 transition-colors gap-2 sm:gap-0"
                    >
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mr-3">
                          <ChartBarIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">{account.name}</p>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 capitalize">
                            {account.subtype || 'Investment Account'}
                          </p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-sm sm:text-base font-semibold text-purple-600 dark:text-purple-400">
                          ${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          {percentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  );
                })}
                
                {investmentAccounts.length === 0 && (
                  <div className="text-center py-6 sm:py-8 text-gray-500 dark:text-gray-400">
                    <ChartBarIcon className="mx-auto h-8 sm:h-12 w-8 sm:w-12 mb-4" />
                    <p className="text-sm sm:text-base">No investment accounts connected</p>
                    <p className="text-xs sm:text-sm">Connect your brokerage accounts to track investments</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'detail' && (
        <Card>
          <div className="text-center py-8 sm:py-12">
            <ChartBarIcon className="mx-auto h-8 sm:h-12 w-8 sm:w-12 text-gray-400 mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">Detailed Asset Allocation</h3>
            <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Advanced allocation analysis and rebalancing tools coming soon
            </p>
          </div>
        </Card>
      )}
      </div>
    </PageTransition>
  );
}