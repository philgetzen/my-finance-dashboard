import React, { useState } from 'react';
import { useYNAB, usePrivacy } from '../../contexts/YNABDataContext';
import { getTransactionAmount } from '../../utils/ynabHelpers';
import Card from '../ui/Card';
import LoadingSpinner from '../ui/LoadingSpinner';
import PageTransition from '../ui/PageTransition';
import {
  ListBulletIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

// Mobile Category Card Component
const CategoryCard = ({ category, monthHeaders, isPrivacyMode }) => {
  const [expanded, setExpanded] = useState(false);
  
  const formatCurrency = (amount) => {
    return (amount || 0).toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex-1 text-left">
          <h4 className="font-medium text-gray-900 dark:text-white text-sm">{category.category}</h4>
          <div className="flex items-center gap-4 mt-1">
            <span className={`text-xs ${category.average >= 0 ? 'text-green-600' : 'text-red-600'} ${isPrivacyMode ? 'filter blur' : ''}`}>
              Avg: ${formatCurrency(category.average)}
            </span>
            <span className={`text-xs font-semibold ${category.total >= 0 ? 'text-green-600' : 'text-red-600'} ${isPrivacyMode ? 'filter blur' : ''}`}>
              Total: ${formatCurrency(category.total)}
            </span>
          </div>
        </div>
        {expanded ? <ChevronUpIcon className="h-5 w-5 text-gray-400" /> : <ChevronDownIcon className="h-5 w-5 text-gray-400" />}
      </button>
      
      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="grid grid-cols-3 gap-2 text-xs">
            {monthHeaders.slice(-6).map(month => {
              const value = category.monthlyData[month.key] || 0;
              return (
                <div key={month.key} className="text-center">
                  <p className="text-gray-500 dark:text-gray-400 mb-1">{month.label.split(' ')[0]}</p>
                  <p className={`font-medium ${value >= 0 ? 'text-green-600' : 'text-red-600'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                    ${formatCurrency(value)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default function BalanceSheet() {
  const { user, transactions: ynabTransactions, isLoading, error } = useYNAB();
  const { isPrivacyMode } = usePrivacy();
  const isError = !!error;
  const [periodMonths, setPeriodMonths] = useState(12);
  const [showMobileTable, setShowMobileTable] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Detect mobile screen
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const formatCurrency = (amount) => {
    return (amount || 0).toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  // Process YNAB category data
  const processCategoryData = () => {
    if (!ynabTransactions?.length) return { categories: [], monthHeaders: [] };
    
    const categoryMap = {};
    const earliestDate = ynabTransactions.reduce((earliest, txn) => {
      const txnDate = new Date(txn.date);
      return !earliest || txnDate < earliest ? txnDate : earliest;
    }, null);
    
    let cutoffDate;
    if (periodMonths === 999 && earliestDate) {
      cutoffDate = new Date(earliestDate);
    } else {
      cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - periodMonths);
    }
    
    const monthHeaders = [];
    const startDate = new Date();
    
    if (periodMonths === 999 && earliestDate) {
      const monthsDiff = Math.ceil((startDate - earliestDate) / (1000 * 60 * 60 * 24 * 30));
      for (let i = monthsDiff - 1; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toISOString().slice(0, 7);
        const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        monthHeaders.push({ key: monthKey, label: monthLabel });
      }
    } else {
      for (let i = periodMonths - 1; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toISOString().slice(0, 7);
        const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        monthHeaders.push({ key: monthKey, label: monthLabel });
      }
    }
    
    ynabTransactions.forEach(transaction => {
      const transactionDate = new Date(transaction.date);
      if (transactionDate < cutoffDate) return;
      
      const categoryName = transaction.category_name || 'Uncategorized';
      const monthKey = transactionDate.toISOString().slice(0, 7);
      const amount = getTransactionAmount(transaction);
      
      if (!categoryMap[categoryName]) {
        categoryMap[categoryName] = {
          category: categoryName,
          monthlyData: {},
          total: 0
        };
        monthHeaders.forEach(month => {
          categoryMap[categoryName].monthlyData[month.key] = 0;
        });
      }
      
      if (categoryMap[categoryName].monthlyData[monthKey] !== undefined) {
        categoryMap[categoryName].monthlyData[monthKey] += amount;
        categoryMap[categoryName].total += amount;
      }
    });
    
    const categories = Object.values(categoryMap)
      .map(category => ({
        ...category,
        average: category.total / monthHeaders.length
      }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
      .filter(category => Math.abs(category.total) > 0.01);
    
    return { categories, monthHeaders };
  };
  
  const { categories: categoryData, monthHeaders } = processCategoryData();
  const totalByMonth = monthHeaders.reduce((acc, month) => {
    acc[month.key] = categoryData.reduce((sum, cat) => sum + (cat.monthlyData[month.key] || 0), 0);
    return acc;
  }, {});
  const grandTotal = categoryData.reduce((sum, cat) => sum + cat.total, 0);
  const grandAverage = grandTotal / (monthHeaders.length || 1);

  if (isLoading && !ynabTransactions && !isError) {
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
        {/* Error Display */}
        {isError && error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm">
            Error: {error?.message || 'Failed to load data'}
          </div>
        )}

        {/* Header - Mobile Optimized */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ListBulletIcon className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Income vs Expense</h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">YNAB category breakdown</p>
            </div>
          </div>
          
          {/* Period selector - Mobile Optimized */}
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <select
              value={periodMonths}
              onChange={(e) => setPeriodMonths(Number(e.target.value))}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
              <option value={24}>Last 24 months</option>
              <option value={60}>Last 5 years</option>
              <option value={999}>All available data</option>
            </select>
          </div>
        </div>

        {/* Summary Cards - Mobile Optimized */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Total {periodMonths === 999 ? '(All time)' : `(${periodMonths}mo)`}
                </p>
                <p className={`text-lg sm:text-xl font-bold mt-1 ${grandTotal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                  ${formatCurrency(grandTotal)}
                </p>
              </div>
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <ListBulletIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Monthly Average</p>
                <p className={`text-lg sm:text-xl font-bold mt-1 ${grandAverage >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                  ${formatCurrency(grandAverage)}
                </p>
              </div>
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <ListBulletIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Categories</p>
                <p className="text-lg sm:text-xl font-bold mt-1 text-gray-900 dark:text-white">
                  {categoryData.length}
                </p>
              </div>
              <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <ListBulletIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
          </Card>
        </div>

        {/* Category Breakdown - Mobile Optimized */}
        <Card className="p-4">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Category Breakdown</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {periodMonths === 999 ? 'Entire history' : `Last ${periodMonths} months`}
            </p>
          </div>
          
          {categoryData.length > 0 ? (
            <>
              {/* Mobile View: Cards */}
              {isMobile && !showMobileTable ? (
                <div className="space-y-3">
                  {categoryData.slice(0, 10).map((category) => (
                    <CategoryCard 
                      key={category.category}
                      category={category}
                      monthHeaders={monthHeaders}
                      isPrivacyMode={isPrivacyMode}
                    />
                  ))}
                  
                  {categoryData.length > 10 && (
                    <button
                      onClick={() => setShowMobileTable(true)}
                      className="w-full py-3 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      View full table ({categoryData.length - 10} more categories)
                    </button>
                  )}
                  
                  {/* Mobile Summary */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-900 dark:text-white">Total</span>
                      <div className="text-right">
                        <p className={`text-xs ${grandAverage >= 0 ? 'text-green-600' : 'text-red-600'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                          Avg: ${formatCurrency(grandAverage)}
                        </p>
                        <p className={`text-sm font-bold ${grandTotal >= 0 ? 'text-green-600' : 'text-red-600'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                          Total: ${formatCurrency(grandTotal)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Desktop View or Full Mobile Table */
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="min-w-[800px]">
                    <table className="w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs sm:text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase sticky left-0 bg-gray-50 dark:bg-gray-800 z-10">
                            Category
                          </th>
                          {monthHeaders.map(month => (
                            <th key={month.key} className="px-1 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">
                              <span className="hidden sm:inline">{month.label}</span>
                              <span className="sm:hidden">{month.label.split(' ')[0]}</span>
                            </th>
                          ))}
                          <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-700">
                            Avg
                          </th>
                          <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-700">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {categoryData.map((category) => (
                          <tr key={category.category} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="px-2 py-2 text-xs sm:text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-900 z-10">
                              <span className="block truncate max-w-[120px] sm:max-w-none" title={category.category}>
                                {category.category}
                              </span>
                            </td>
                            {monthHeaders.map(month => {
                              const value = category.monthlyData[month.key] || 0;
                              return (
                                <td key={month.key} className={`px-1 py-2 text-right text-xs sm:text-sm ${
                                  value >= 0 ? 'text-green-600' : 'text-red-600'
                                } ${isPrivacyMode ? 'filter blur' : ''}`}>
                                  {Math.abs(value) < 0.01 ? '—' : `$${formatCurrency(value)}`}
                                </td>
                              );
                            })}
                            <td className={`px-2 py-2 text-right text-xs sm:text-sm font-semibold bg-gray-50 dark:bg-gray-800 ${
                              category.average >= 0 ? 'text-green-600' : 'text-red-600'
                            } ${isPrivacyMode ? 'filter blur' : ''}`}>
                              ${formatCurrency(category.average)}
                            </td>
                            <td className={`px-2 py-2 text-right text-xs sm:text-sm font-semibold bg-gray-50 dark:bg-gray-800 ${
                              category.total >= 0 ? 'text-green-600' : 'text-red-600'
                            } ${isPrivacyMode ? 'filter blur' : ''}`}>
                              ${formatCurrency(category.total)}
                            </td>
                          </tr>
                        ))}
                        
                        {/* Totals row */}
                        <tr className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
                          <td className="px-2 py-2 text-xs sm:text-sm font-bold text-gray-900 dark:text-white sticky left-0 bg-gray-100 dark:bg-gray-800 z-10">
                            TOTAL
                          </td>
                          {monthHeaders.map(month => {
                            const value = totalByMonth[month.key] || 0;
                            return (
                              <td key={month.key} className={`px-1 py-2 text-right text-xs sm:text-sm font-bold ${
                                value >= 0 ? 'text-green-600' : 'text-red-600'
                              } ${isPrivacyMode ? 'filter blur' : ''}`}>
                                ${formatCurrency(value)}
                              </td>
                            );
                          })}
                          <td className={`px-2 py-2 text-right text-xs sm:text-sm font-bold bg-gray-200 dark:bg-gray-700 ${
                            grandAverage >= 0 ? 'text-green-600' : 'text-red-600'
                          } ${isPrivacyMode ? 'filter blur' : ''}`}>
                            ${formatCurrency(grandAverage)}
                          </td>
                          <td className={`px-2 py-2 text-right text-xs sm:text-sm font-bold bg-gray-200 dark:bg-gray-700 ${
                            grandTotal >= 0 ? 'text-green-600' : 'text-red-600'
                          } ${isPrivacyMode ? 'filter blur' : ''}`}>
                            ${formatCurrency(grandTotal)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  {isMobile && showMobileTable && (
                    <button
                      onClick={() => setShowMobileTable(false)}
                      className="w-full mt-3 py-2 text-sm text-blue-600 dark:text-blue-400"
                    >
                      Show compact view
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <ListBulletIcon className="mx-auto h-10 w-10 text-gray-400 mb-3" />
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">No YNAB data available</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Connect your YNAB account to see category breakdown
              </p>
            </div>
          )}
        </Card>
      </div>
    </PageTransition>
  );
}