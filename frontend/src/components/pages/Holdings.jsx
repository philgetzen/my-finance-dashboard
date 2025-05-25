import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { usePlaid } from '../../contexts/PlaidDataContext';
import { useCombinedFinanceData } from '../../hooks/useCombinedFinanceData';
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

export default function Holdings() {
  const { user } = usePlaid();
  const { accounts, holdings, isLoading, isError, error } = useCombinedFinanceData(user?.uid);

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
      <div className="w-full max-w-none space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <TrophyIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Holdings</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Detailed view of your investment holdings</p>
        </div>
      </div>

      {/* Error Display */}
      {isError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 sm:p-4 rounded-lg text-sm sm:text-base">
          Error: {error?.message || 'Failed to load data'}
        </div>
      )}

      {user && (
        <>
          {/* Portfolio Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <Card>
              <div className="text-center">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Holdings</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {holdings.length}
                </p>
              </div>
            </Card>

            <Card>
              <div className="text-center">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Market Value</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                  ${totalMarketValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
            </Card>

            <Card>
              <div className="text-center">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Cost Basis</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-600 dark:text-gray-400">
                  ${totalCostBasis.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
            </Card>

            <Card>
              <div className="text-center">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Gain/Loss</p>
                <div className="flex items-center justify-center">
                  {totalGainLoss > 0 ? (
                    <ArrowUpIcon className="h-5 w-5 text-green-500 mr-1" />
                  ) : totalGainLoss < 0 ? (
                    <ArrowDownIcon className="h-5 w-5 text-red-500 mr-1" />
                  ) : (
                    <MinusIcon className="h-5 w-5 text-gray-500 mr-1" />
                  )}
                  <div className={`text-lg sm:text-xl font-bold ${totalGainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    ${Math.abs(totalGainLoss).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <p className={`text-sm ${totalGainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  ({totalGainLossPercent >= 0 ? '+' : ''}{totalGainLossPercent.toFixed(2)}%)
                </p>
              </div>
            </Card>
          </div>

          {/* Holdings Table */}
          <Card>
            <div className="mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">All Holdings</h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">Detailed breakdown of your investment positions</p>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="min-w-full">
                <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Security
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                      Account
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                      Quantity
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                      Cost Basis
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Market Value
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Performance
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {holdings.length > 0 ? (
                    holdings.map(holding => {
                      const gainLoss = (holding.market_value || 0) - (holding.cost_basis || 0);
                      const gainLossPercent = holding.cost_basis > 0 ? (gainLoss / holding.cost_basis) * 100 : 0;
                      
                      return (
                        <tr key={`holding-${holding.account_id}-${holding.security_id}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-3 sm:px-6 py-4">
                            <div>
                              <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">
                                {holding.security?.name || 'Unknown Security'}
                              </p>
                              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                {holding.security?.ticker_symbol || 'N/A'}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 sm:hidden">
                                {accountIdToName[holding.account_id] || holding.account_id}
                              </p>
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white hidden sm:table-cell">
                            {accountIdToName[holding.account_id] || holding.account_id}
                          </td>
                          <td className="px-3 sm:px-6 py-4 text-right text-xs sm:text-sm text-gray-900 dark:text-white hidden lg:table-cell">
                            {(holding.quantity || 0).toLocaleString()}
                          </td>
                          <td className="px-3 sm:px-6 py-4 text-right text-xs sm:text-sm text-gray-900 dark:text-white hidden md:table-cell">
                            ${(holding.cost_basis || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 sm:px-6 py-4 text-right text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            ${(holding.market_value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 sm:px-6 py-4 text-center">
                            <div className="flex items-center justify-center">
                              {gainLoss > 0 ? (
                                <ArrowUpIcon className="h-4 w-4 text-green-500 mr-1" />
                              ) : gainLoss < 0 ? (
                                <ArrowDownIcon className="h-4 w-4 text-red-500 mr-1" />
                              ) : (
                                <MinusIcon className="h-4 w-4 text-gray-500 mr-1" />
                              )}
                              <span className={`text-xs sm:text-sm font-medium ${gainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {gainLossPercent >= 0 ? '+' : ''}{gainLossPercent.toFixed(2)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-3 sm:px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                        <TrophyIcon className="mx-auto h-12 w-12 mb-4" />
                        <p className="text-base sm:text-lg">No holdings data available</p>
                        <p className="text-xs sm:text-sm mt-1">Connect your investment accounts to view holdings</p>
                      </td>
                    </tr>
                  )}
                </tbody>
                </table>
              </div>
            </div>
          </Card>

          {/* Asset Allocation Chart */}
          <Card>
            <div className="mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Asset Allocation</h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">Top holdings by market value</p>
            </div>
            {assetAllocation.length > 0 ? (
              <div className="h-48 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={assetAllocation}
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                      labelLine={false}
                    >
                      {assetAllocation.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name, props) => [
                        `$${value.toLocaleString()}`,
                        props.payload.security
                      ]}
                      contentStyle={{
                        backgroundColor: 'var(--tooltip-bg)',
                        border: '1px solid var(--tooltip-border)',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value, entry) => entry.payload.security}
                      wrapperStyle={{ fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 sm:h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-center">
                  <ChartBarIcon className="mx-auto h-8 sm:h-12 w-8 sm:w-12 text-gray-400 mb-4" />
                  <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">No holdings data available</p>
                  <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-1">
                    Connect investment accounts to see asset allocation
                  </p>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {!user && !isLoading && (
        <Card>
          <div className="text-center py-12">
            <TrophyIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">Please log in</h3>
            <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Sign in to view your investment holdings
            </p>
          </div>
        </Card>
      )}
      </div>
    </PageTransition>
  );
}