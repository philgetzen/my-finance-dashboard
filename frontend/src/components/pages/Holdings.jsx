import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useYNAB, usePrivacy } from '../../contexts/YNABDataContext';
import Card from '../ui/Card';
import { HoldingsSkeleton } from '../ui/Skeleton';
import PageTransition from '../ui/PageTransition';
import {
  TrophyIcon,
  ChartBarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';

const COLORS = ['#3B82F6', '#8B5CF6', '#EF4444', '#10B981', '#F59E0B', '#06B6D4', '#EC4899', '#6366F1'];

// Mobile-friendly Holding Card
const HoldingCard = ({ holding, accountName, isPrivacyMode }) => {
  const gainLoss = (holding.market_value || 0) - (holding.cost_basis || 0);
  const gainLossPercent = holding.cost_basis > 0 ? (gainLoss / holding.cost_basis) * 100 : 0;
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
            {holding.security?.name || 'Unknown Security'}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {holding.security?.ticker_symbol || 'N/A'} • {accountName || holding.account_id}
          </p>
        </div>
        <div className="flex items-center ml-3">
          {gainLoss > 0 ? (
            <ArrowUpIcon className="h-4 w-4 text-green-500 mr-1" />
          ) : gainLoss < 0 ? (
            <ArrowDownIcon className="h-4 w-4 text-red-500 mr-1" />
          ) : (
            <MinusIcon className="h-4 w-4 text-gray-500 mr-1" />
          )}
          <span className={`text-sm font-medium ${gainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {gainLossPercent >= 0 ? '+' : ''}{gainLossPercent.toFixed(2)}%
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-gray-500 dark:text-gray-400">Quantity</p>
          <p className="font-medium text-gray-900 dark:text-white mt-1">
            {(holding.quantity || 0).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">Cost Basis</p>
          <p className={`font-medium text-gray-900 dark:text-white mt-1 ${isPrivacyMode ? 'filter blur' : ''}`}>
            ${(holding.cost_basis || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">Market Value</p>
          <p className={`font-medium text-gray-900 dark:text-white mt-1 ${isPrivacyMode ? 'filter blur' : ''}`}>
            ${(holding.market_value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default function Holdings() {
  const { user, accounts, isLoading, error } = useYNAB();
  const { isPrivacyMode } = usePrivacy();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Detect mobile screen
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // For now, Holdings will show a placeholder since YNAB doesn't provide investment holdings
  // This would typically come from Plaid investment accounts
  const holdings = [];
  const isError = !!error;

  // Helper functions
  const normalizeAccountType = (type) => {
    if (!type) return 'other';
    const lowerType = type.toLowerCase();
    if (lowerType === 'otherasset') return 'investment';
    if (lowerType === 'creditcard') return 'credit';
    return lowerType;
  };

  const getDisplayAccountType = (type) => {
    const normalizedType = normalizeAccountType(type);
    switch (normalizedType) {
      case 'investment': return 'Investment';
      case 'credit': return 'Credit Card';
      case 'checking': return 'Checking';
      case 'savings': return 'Savings';
      case 'loan': return 'Loan';
      case 'mortgage': return 'Mortgage';
      default: return type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Other';
    }
  };

  const formatCurrency = (amount) => {
    return `${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const allAccountsForNaming = accounts || [];
  const accountIdToName = Object.fromEntries(allAccountsForNaming.map(acc => [acc.account_id || acc.id, acc.name]));

  const totalMarketValue = holdings.reduce((sum, holding) => sum + (holding.market_value || 0), 0);
  const totalCostBasis = holdings.reduce((sum, holding) => sum + (holding.cost_basis || 0), 0);
  const totalGainLoss = totalMarketValue - totalCostBasis;
  const totalGainLossPercent = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;

  // Process asset allocation data
  const assetAllocation = holdings.reduce((acc, holding) => {
    const ticker = holding.security?.ticker_symbol || 'Unknown';
    const value = holding.market_value || 0;
    
    if (value > 0) {
      acc.push({
        name: ticker,
        value: value,
        security: holding.security?.name || ticker
      });
    }
    return acc;
  }, []).sort((a, b) => b.value - a.value).slice(0, 10); // Top 10 holdings

  if (isLoading) {
    return (
      <PageTransition>
        <HoldingsSkeleton />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="w-full max-w-none space-y-4 pb-4">
        {/* Header - Mobile Optimized */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <TrophyIcon className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Holdings</h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Your investment holdings</p>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {isError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm">
            Error: {error?.message || 'Failed to load data'}
          </div>
        )}

        {user && (
          <>
            {/* Portfolio Summary - Mobile Optimized */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="p-4">
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Holdings</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mt-1">
                    {holdings.length}
                  </p>
                </div>
              </Card>

              <Card className="p-4">
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Market Value</p>
                  <p className={`text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400 mt-1 ${isPrivacyMode ? 'filter blur' : ''}`}>
                    ${formatCurrency(totalMarketValue)}
                  </p>
                </div>
              </Card>

              <Card className="p-4">
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Cost Basis</p>
                  <p className={`text-lg sm:text-xl font-bold text-gray-600 dark:text-gray-400 mt-1 ${isPrivacyMode ? 'filter blur' : ''}`}>
                    ${formatCurrency(totalCostBasis)}
                  </p>
                </div>
              </Card>

              <Card className="p-4">
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Gain/Loss</p>
                  <div className="flex items-center justify-center mt-1">
                    {totalGainLoss > 0 ? (
                      <ArrowUpIcon className="h-4 w-4 text-green-500 mr-1" />
                    ) : totalGainLoss < 0 ? (
                      <ArrowDownIcon className="h-4 w-4 text-red-500 mr-1" />
                    ) : (
                      <MinusIcon className="h-4 w-4 text-gray-500 mr-1" />
                    )}
                    <div className={`text-base sm:text-lg font-bold ${totalGainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                      ${formatCurrency(Math.abs(totalGainLoss))}
                    </div>
                  </div>
                  <p className={`text-xs ${totalGainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    ({totalGainLossPercent >= 0 ? '+' : ''}{totalGainLossPercent.toFixed(2)}%)
                  </p>
                </div>
              </Card>
            </div>

            {/* Holdings List/Table - Mobile Optimized */}
            <Card className="p-4">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">All Holdings</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Your investment positions</p>
              </div>

              {holdings.length > 0 ? (
                isMobile ? (
                  // Mobile: Card Layout
                  <div className="space-y-3">
                    {holdings.map(holding => (
                      <HoldingCard
                        key={`holding-${holding.account_id}-${holding.security_id}`}
                        holding={holding}
                        accountName={accountIdToName[holding.account_id]}
                        isPrivacyMode={isPrivacyMode}
                      />
                    ))}
                  </div>
                ) : (
                  // Desktop: Table Layout
                  <div className="overflow-x-auto">
                    <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Security</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Account</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Quantity</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cost Basis</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Market Value</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Performance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {holdings.map(holding => {
                          const gainLoss = (holding.market_value || 0) - (holding.cost_basis || 0);
                          const gainLossPercent = holding.cost_basis > 0 ? (gainLoss / holding.cost_basis) * 100 : 0;
                          
                          return (
                            <tr key={`holding-${holding.account_id}-${holding.security_id}`}>
                              <td className="px-4 py-3">
                                <div>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {holding.security?.name || 'Unknown Security'}
                                  </p>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    {holding.security?.ticker_symbol || 'N/A'}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                {accountIdToName[holding.account_id] || holding.account_id}
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-white">
                                {(holding.quantity || 0).toLocaleString()}
                              </td>
                              <td className={`px-4 py-3 text-right text-sm text-gray-900 dark:text-white ${isPrivacyMode ? 'filter blur' : ''}`}>
                                ${formatCurrency(holding.cost_basis || 0)}
                              </td>
                              <td className={`px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white ${isPrivacyMode ? 'filter blur' : ''}`}>
                                ${formatCurrency(holding.market_value || 0)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center">
                                  {gainLoss > 0 ? (
                                    <ArrowUpIcon className="h-4 w-4 text-green-500 mr-1" />
                                  ) : gainLoss < 0 ? (
                                    <ArrowDownIcon className="h-4 w-4 text-red-500 mr-1" />
                                  ) : (
                                    <MinusIcon className="h-4 w-4 text-gray-500 mr-1" />
                                  )}
                                  <span className={`text-sm font-medium ${gainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {gainLossPercent >= 0 ? '+' : ''}{gainLossPercent.toFixed(2)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <div className="text-center py-8">
                  <TrophyIcon className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No holdings data available</p>
                  <p className="text-xs mt-1">Connect your investment accounts to view holdings</p>
                </div>
              )}
            </Card>

            {/* Asset Allocation Chart - Mobile Optimized */}
            <Card className="p-4">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Asset Allocation</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Top holdings by market value</p>
              </div>
              {assetAllocation.length > 0 ? (
                <div className="h-48 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 0, right: 0, bottom: 40, left: 0 }}>
                      <Pie
                        data={assetAllocation}
                        cx="50%"
                        cy="45%"
                        outerRadius={isMobile ? 60 : 70}
                        fill="#8884d8"
                        dataKey="value"
                        label={false}
                      >
                        {assetAllocation.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value, name, props) => {
                          if (isPrivacyMode) return ['***', props.payload.security];
                          return [`$${value.toLocaleString()}`, props.payload.security];
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
                        formatter={(value, entry) => entry.payload.security}
                        wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-center">
                    <ChartBarIcon className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No holdings data available</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Connect investment accounts
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </>
        )}

        {!user && !isLoading && (
          <Card className="p-8">
            <div className="text-center">
              <TrophyIcon className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-600 mb-3" />
              <h3 className="text-base font-medium text-gray-900 dark:text-white">Please log in</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Sign in to view your investment holdings
              </p>
            </div>
          </Card>
        )}
      </div>
    </PageTransition>
  );
}