import React, { useState } from 'react';
import { useYNAB, usePrivacy } from '../../contexts/YNABDataContext';
import { getTransactionAmount, milliunitsToAmount } from '../../utils/ynabHelpers';
import Card from '../ui/Card';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';
import PageTransition from '../ui/PageTransition';
import {
  ListBulletIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

export default function BalanceSheet() {
  const { user, transactions: ynabTransactions, isLoading, error } = useYNAB();
  const { isPrivacyMode } = usePrivacy();
  const isError = !!error;
  const [periodMonths, setPeriodMonths] = useState(12);

  // Helper function for currency formatting
  const formatCurrency = (amount) => {
    return (amount || 0).toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };


  // Process YNAB category data for month-by-month income vs expense report
  const processCategoryData = () => {
    if (!ynabTransactions?.length) return { categories: [], monthHeaders: [] };
    
    const categoryMap = {};
    // Find the earliest transaction date
    const earliestDate = ynabTransactions.reduce((earliest, txn) => {
      const txnDate = new Date(txn.date);
      return !earliest || txnDate < earliest ? txnDate : earliest;
    }, null);
    
    // Set cutoff date - either specified period or earliest available
    let cutoffDate;
    if (periodMonths === 999 && earliestDate) {
      cutoffDate = new Date(earliestDate);
    } else {
      cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - periodMonths);
    }
    
    // Generate month headers - either for specified period or all available data
    const monthHeaders = [];
    const startDate = new Date();
    
    if (periodMonths === 999 && earliestDate) {
      // Use all available data from earliest transaction
      const monthsDiff = Math.ceil((startDate - earliestDate) / (1000 * 60 * 60 * 24 * 30));
      for (let i = monthsDiff - 1; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toISOString().slice(0, 7);
        const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        monthHeaders.push({ key: monthKey, label: monthLabel });
      }
    } else {
      // Use specified period
      for (let i = periodMonths - 1; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toISOString().slice(0, 7);
        const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        monthHeaders.push({ key: monthKey, label: monthLabel });
      }
    }
    
    // Group transactions by category and month
    ynabTransactions.forEach(transaction => {
      const transactionDate = new Date(transaction.date);
      if (transactionDate < cutoffDate) return;
      
      const categoryName = transaction.category_name || 'Uncategorized';
      const monthKey = transactionDate.toISOString().slice(0, 7);
      // Use the helper function to get the properly converted amount
      const amount = getTransactionAmount(transaction);
      
      if (!categoryMap[categoryName]) {
        categoryMap[categoryName] = {
          category: categoryName,
          monthlyData: {},
          total: 0
        };
        // Initialize all months to 0
        monthHeaders.forEach(month => {
          categoryMap[categoryName].monthlyData[month.key] = 0;
        });
      }
      
      // Add transaction amount to the appropriate month
      if (categoryMap[categoryName].monthlyData[monthKey] !== undefined) {
        categoryMap[categoryName].monthlyData[monthKey] += amount;
        categoryMap[categoryName].total += amount;
      }
    });
    
    // Convert to array and calculate averages
    const categories = Object.values(categoryMap)
      .map(category => ({
        ...category,
        average: category.total / periodMonths
      }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
      .filter(category => Math.abs(category.total) > 0.01); // Filter out near-zero categories
    
    return { categories, monthHeaders };
  };
  
  const { categories: categoryData, monthHeaders } = processCategoryData();
  const totalByMonth = monthHeaders.reduce((acc, month) => {
    acc[month.key] = categoryData.reduce((sum, cat) => sum + (cat.monthlyData[month.key] || 0), 0);
    return acc;
  }, {});
  const grandTotal = categoryData.reduce((sum, cat) => sum + cat.total, 0);
  const grandAverage = grandTotal / periodMonths;

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
      <div className="w-full max-w-none space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Error Display */}
      {isError && error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 sm:p-4 rounded-lg text-sm sm:text-base">
          Error: {error?.message || 'Failed to load data'}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <ListBulletIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white text-left">Income vs Expense Report</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 text-left">YNAB category breakdown over time</p>
          </div>
        </div>
        
        {/* Period selector */}
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <select
            value={periodMonths}
            onChange={(e) => setPeriodMonths(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <ListBulletIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total ({periodMonths === 999 ? 'All time' : `${periodMonths} months`})</p>
              <p className={`text-xl sm:text-2xl font-bold ${grandTotal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                ${formatCurrency(grandTotal)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <ListBulletIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Average</p>
              <p className={`text-xl sm:text-2xl font-bold ${grandAverage >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                ${formatCurrency(grandAverage)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <ListBulletIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Categories</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {categoryData.length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Category Table */}
      <Card>
        <div className="mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Category Breakdown</h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            Monthly breakdown by category over the {periodMonths === 999 ? 'entire history' : `last ${periodMonths} months`}
          </p>
        </div>
        
        <div className="overflow-x-auto">
          {categoryData.length > 0 ? (
            <table className="w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-800">
                    Category
                  </th>
                  {monthHeaders.map(month => (
                    <th key={month.key} className="px-2 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[90px]">
                      {month.label.split(' ')[0]}<br/>
                      <span className="text-[10px]">{month.label.split(' ')[1]}</span>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[80px] bg-gray-100 dark:bg-gray-700">
                    Average
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[90px] bg-gray-100 dark:bg-gray-700">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {categoryData.map((category, index) => (
                  <tr key={category.category} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-900 max-w-[150px] truncate">
                      <span title={category.category}>{category.category}</span>
                    </td>
                    {monthHeaders.map(month => {
                      const value = category.monthlyData[month.key] || 0;
                      return (
                        <td key={month.key} className={`px-2 py-2 text-right text-sm font-medium ${
                          value >= 0 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        } ${isPrivacyMode ? 'filter blur' : ''}`}>
                          {Math.abs(value) < 0.01 ? '—' : `${formatCurrency(value)}`}
                        </td>
                      );
                    })}
                    <td className={`px-3 py-2 text-right text-sm font-bold bg-gray-50 dark:bg-gray-800 ${
                      category.average >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    } ${isPrivacyMode ? 'filter blur' : ''}`}>
                      ${formatCurrency(category.average)}
                    </td>
                    <td className={`px-3 py-2 text-right text-sm font-bold bg-gray-50 dark:bg-gray-800 ${
                      category.total >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    } ${isPrivacyMode ? 'filter blur' : ''}`}>
                      ${formatCurrency(category.total)}
                    </td>
                  </tr>
                ))}
                
                {/* Totals row */}
                <tr className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
                  <td className="px-3 py-2 text-sm font-bold text-gray-900 dark:text-white sticky left-0 bg-gray-100 dark:bg-gray-800">
                    TOTAL
                  </td>
                  {monthHeaders.map(month => {
                    const value = totalByMonth[month.key] || 0;
                    return (
                      <td key={month.key} className={`px-2 py-2 text-right text-sm font-bold ${
                        value >= 0 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      } ${isPrivacyMode ? 'filter blur' : ''}`}>
                        ${formatCurrency(value)}
                      </td>
                    );
                  })}
                  <td className={`px-3 py-2 text-right text-sm font-bold bg-gray-200 dark:bg-gray-700 ${
                    grandAverage >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  } ${isPrivacyMode ? 'filter blur' : ''}`}>
                    ${formatCurrency(grandAverage)}
                  </td>
                  <td className={`px-3 py-2 text-right text-sm font-bold bg-gray-200 dark:bg-gray-700 ${
                    grandTotal >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  } ${isPrivacyMode ? 'filter blur' : ''}`}>
                    ${formatCurrency(grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12">
              <ListBulletIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No YNAB data available</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Connect your YNAB account to see category breakdown
              </p>
            </div>
          )}
        </div>
      </Card>
      </div>
    </PageTransition>
  );
}