import React, { useState, useMemo } from 'react';
import { useYNAB, usePrivacy } from '../../contexts/YNABDataContext';
import { getTransactionAmount, normalizeYNABAccountType } from '../../utils/ynabHelpers';
import Card from '../ui/Card';
import LoadingSpinner from '../ui/LoadingSpinner';
import PageTransition from '../ui/PageTransition';
import {
  ListBulletIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon, // For modal close
  LinkIcon, // For category links
} from '@heroicons/react/24/outline';

// Mobile Category Card Component - NOTE: This will need refactoring for grouped data
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
  const { 
    user, 
    accounts: ynabAccounts, 
    manualAccounts, 
    transactions: ynabTransactions, 
    isLoading, 
    error 
  } = useYNAB();
  const { isPrivacyMode } = usePrivacy();
  const isError = !!error;
  const [periodMonths, setPeriodMonths] = useState(12);
  const [showMobileTable, setShowMobileTable] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showCategoryListModal, setShowCategoryListModal] = useState(false);

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

  const allAccounts = useMemo(() => [...(ynabAccounts || []), ...(manualAccounts || [])], [ynabAccounts, manualAccounts]);

  const investmentAccountIds = useMemo(() => new Set(
    allAccounts
      .filter(acc => normalizeYNABAccountType(acc.type) === 'investment')
      .map(acc => acc.id || acc.account_id)
      .filter(id => id)
  ), [allAccounts]);

  const ynabReportIncomeCategories = useMemo(() => [
    "Inflow: Ready to Assign", "Adjustment", "Amazon", "Apple", "Bank of America Mobile", "Barry Getzen",
    "Deposit Mobile Banking", "Disney", "eCheck Deposit", "Gemini", "Interest Income", "Interest Paid", 
    "Merrill Lynch Funds Transfer", "Mspbna Transfer", "Nanoleaf", "Next Brick Prope", "Next Brick Prope Sigonfile",
    "Paid Leave Wa Future Amount Tran Ddir", "Venmo"
  ], []);

  const debtPaymentCategoriesNamedAsTransfers = useMemo(() => ["8331 Mortgage", "Kia Loan"], []);

  const processCategoryData = () => {
    if (!ynabTransactions?.length) return { categoryGroups: [], monthHeaders: [], totalIncome: 0, totalExpenses: 0 };
    
    const categoryGroupMap = {};
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
    const currentProcessingDate = new Date();
    
    if (periodMonths === 999 && earliestDate) {
      const monthsDiff = Math.max(0, Math.ceil((currentProcessingDate - earliestDate) / (1000 * 60 * 60 * 24 * 30)));
      for (let i = monthsDiff -1; i >= 0; i--) {
        const date = new Date(currentProcessingDate.getFullYear(), currentProcessingDate.getMonth() - i, 1);
        const monthKey = date.toISOString().slice(0, 7);
        const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        monthHeaders.push({ key: monthKey, label: monthLabel });
      }
    } else {
      for (let i = periodMonths - 1; i >= 0; i--) {
        const date = new Date(currentProcessingDate.getFullYear(), currentProcessingDate.getMonth() - i, 1);
        const monthKey = date.toISOString().slice(0, 7);
        const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        monthHeaders.push({ key: monthKey, label: monthLabel });
      }
    }
    
    const processSingleTxnForCategory = (txn, accountId, effectiveMonthHeaders) => {
      if (investmentAccountIds.has(accountId)) return;
      
      const isPayeeIndicatedTransfer = txn.payee_name && txn.payee_name.toLowerCase().startsWith("transfer :");
      const isCategorizedDebtPayment = debtPaymentCategoriesNamedAsTransfers.includes(txn.category_name);

      if (txn.transfer_account_id || (isPayeeIndicatedTransfer && !isCategorizedDebtPayment)) return;
      if (txn.payee_name === 'Reconciliation Balance Adjustment' || txn.payee_name === 'Starting Balance') return;

      const transactionDate = new Date(txn.date);
      if (transactionDate < cutoffDate) return;

      const amount = getTransactionAmount(txn);
      let effectiveCategoryName = txn.category_name || 'Uncategorized';
      let categoryGroupName = txn.category_group_name;

      if (txn.category_name === "Inflow: Ready to Assign") {
        effectiveCategoryName = `Inflow: ${txn.payee_name || 'Unspecified Source'}`;
        categoryGroupName = "Inflow";
      } else if (!categoryGroupName) {
        categoryGroupName = amount >= 0 ? 'Other Income Sources' : 'Other Expenses';
      }
      
      const monthKey = transactionDate.toISOString().slice(0, 7);

      if (!categoryGroupMap[categoryGroupName]) {
        categoryGroupMap[categoryGroupName] = {
          groupName: categoryGroupName,
          categories: {},
          monthlyData: Object.fromEntries(effectiveMonthHeaders.map(mh => [mh.key, 0])),
          total: 0,
        };
      }

      const currentGroup = categoryGroupMap[categoryGroupName];
      if (!currentGroup.categories[effectiveCategoryName]) {
        currentGroup.categories[effectiveCategoryName] = {
          category: effectiveCategoryName,
          monthlyData: Object.fromEntries(effectiveMonthHeaders.map(mh => [mh.key, 0])),
          total: 0,
        };
      }
      
      const currentCategoryData = currentGroup.categories[effectiveCategoryName];
      
      if (currentCategoryData.monthlyData[monthKey] !== undefined) {
        currentCategoryData.monthlyData[monthKey] += amount;
        currentCategoryData.total += amount;
        currentGroup.monthlyData[monthKey] += amount;
        currentGroup.total += amount;
      }
    };

    ynabTransactions.forEach(transaction => {
      if (transaction.subtransactions && transaction.subtransactions.length > 0) {
        transaction.subtransactions.forEach(subTxn => {
          const accountId = subTxn.account_id || transaction.account_id;
          const subTransactionForProcessing = { 
            ...subTxn, 
            date: subTxn.date || transaction.date,
            payee_name: subTxn.payee_name || transaction.payee_name,
            category_group_name: subTxn.category_group_name || transaction.category_group_name,
            category_name: subTxn.category_name || transaction.category_name, // Ensure category_name is present
            transfer_account_id: subTxn.transfer_account_id || transaction.transfer_account_id, // Ensure transfer_account_id is present
          };
          processSingleTxnForCategory(subTransactionForProcessing, accountId, monthHeaders);
        });
      } else {
        processSingleTxnForCategory(transaction, transaction.account_id, monthHeaders);
      }
    });
    
    let totalIncome = 0;
    let totalExpenses = 0;

    const categoryGroups = Object.values(categoryGroupMap)
      .map(group => {
        const isEssentiallyIncomeGroup = group.total >= 0 || group.groupName === "Inflow" || ynabReportIncomeCategories.some(rc => group.groupName.includes(rc) && group.total >=0);
        
        const categoriesInGroup = Object.values(group.categories)
          .map(category => {
            const isIncomeCategory = category.total >= 0 || ynabReportIncomeCategories.includes(category.category);
            return {
              ...category,
              average: category.total / (monthHeaders.length || 1),
              isIncome: isIncomeCategory
            };
          })
          .sort((a, b) => {
            if (a.isIncome && !b.isIncome) return -1;
            if (!a.isIncome && b.isIncome) return 1;
            if (a.isIncome) return b.total - a.total;
            return Math.abs(b.total) - Math.abs(a.total);
          })
          .filter(category => Math.abs(category.total) > 0.01);

        if (categoriesInGroup.length === 0 && Math.abs(group.total) < 0.01) return null;
        
        if (isEssentiallyIncomeGroup) totalIncome += group.total;
        else totalExpenses += group.total; // Expenses are negative

        return {
          ...group,
          categories: categoriesInGroup,
          average: group.total / (monthHeaders.length || 1),
          isIncomeGroup: isEssentiallyIncomeGroup
        };
      })
      .filter(group => group !== null)
      .sort((a, b) => {
        if (a.isIncomeGroup && !b.isIncomeGroup) return -1;
        if (!a.isIncomeGroup && b.isIncomeGroup) return 1;
        return a.groupName.localeCompare(b.groupName);
      });
    
    return { categoryGroups, monthHeaders, totalIncome, totalExpenses };
  };
  
  const { categoryGroups: categoryData, monthHeaders, totalIncome, totalExpenses } = useMemo(processCategoryData, [ynabTransactions, periodMonths, investmentAccountIds, ynabReportIncomeCategories, debtPaymentCategoriesNamedAsTransfers]);
  
  const netTotalByMonth = monthHeaders.reduce((acc, month) => {
    acc[month.key] = categoryData.reduce((sum, group) => sum + (group.monthlyData[month.key] || 0), 0);
    return acc;
  }, {});
  const grandNetTotal = categoryData.reduce((sum, group) => sum + group.total, 0);
  const grandNetAverage = grandNetTotal / (monthHeaders.length || 1);
  const totalCategoriesCount = categoryData.reduce((sum, group) => sum + group.categories.length, 0);


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
        {isError && error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm">
            Error: {error?.message || 'Failed to load data'}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ListBulletIcon className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Balance Sheet</h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">YNAB category group and category breakdown</p>
            </div>
          </div>
          
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Net Total {periodMonths === 999 ? '(All time)' : `(${periodMonths}mo)`}</p>
                <p className={`text-lg sm:text-xl font-bold mt-1 ${grandNetTotal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                  ${formatCurrency(grandNetTotal)}
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
                <p className="text-xs text-gray-600 dark:text-gray-400">Net Monthly Average</p>
                <p className={`text-lg sm:text-xl font-bold mt-1 ${grandNetAverage >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                  ${formatCurrency(grandNetAverage)}
                </p>
              </div>
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <ListBulletIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </Card>
          <Card className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" onClick={() => setShowCategoryListModal(true)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Categories</p>
                <p className="text-lg sm:text-xl font-bold mt-1 text-gray-900 dark:text-white">{totalCategoriesCount}</p>
              </div>
              <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <ListBulletIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
          </Card>
        </div>

        {showCategoryListModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md max-h-[80vh] overflow-y-auto p-0">
              <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">All Categories</h3>
                <button onClick={() => setShowCategoryListModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                {categoryData.map(group => (
                  <div key={`modal-group-${group.groupName}`}>
                    <h4 className={`text-md font-semibold mb-2 ${group.isIncomeGroup ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {group.groupName}
                    </h4>
                    <ul className="space-y-1 pl-2">
                      {group.categories.map(category => (
                        <li key={`modal-cat-${category.category}`} className="text-sm">
                          <a 
                            href={`#category-${(group.groupName + '-' + category.category).replace(/\s+/g, '-').replace(/[^\w-]+/g, '')}`} 
                            onClick={() => setShowCategoryListModal(false)}
                            className="text-blue-600 hover:underline dark:text-blue-400 flex items-center"
                          >
                            <LinkIcon className="h-3 w-3 mr-1.5 flex-shrink-0" />
                            {category.category}
                          </a>
                        </li>
                      ))}
                      {group.categories.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-400">No categories in this group.</p>}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        <Card className="p-4">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Category Breakdown</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {periodMonths === 999 ? 'Entire history' : `Last ${periodMonths} months`}
            </p>
          </div>
          
          {categoryData.length > 0 ? (
            <>
              {isMobile && !showMobileTable ? (
                <div className="space-y-3">
                  {/* Mobile view needs significant update for groups - showing first 10 categories for now */}
                  {categoryData.flatMap(g => g.categories).slice(0, 10).map((category) => (
                    <CategoryCard 
                      key={category.category}
                      category={category}
                      monthHeaders={monthHeaders}
                      isPrivacyMode={isPrivacyMode}
                    />
                  ))}
                  {categoryData.flatMap(g => g.categories).length > 10 && (
                    <button
                      onClick={() => setShowMobileTable(true)}
                      className="w-full py-3 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      View full table ({categoryData.flatMap(g => g.categories).length - 10} more categories)
                    </button>
                  )}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-gray-900 dark:text-white">Total Income</span>
                      <p className={`text-sm font-bold text-green-600 dark:text-green-400 ${isPrivacyMode ? 'filter blur' : ''}`}>${formatCurrency(totalIncome)}</p>
                    </div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-gray-900 dark:text-white">Total Expenses</span>
                      <p className={`text-sm font-bold text-red-600 dark:text-red-400 ${isPrivacyMode ? 'filter blur' : ''}`}>${formatCurrency(totalExpenses)}</p>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-900 dark:text-white">Net Total</span>
                      <p className={`text-sm font-bold ${grandNetTotal >= 0 ? 'text-green-600' : 'text-red-600'} ${isPrivacyMode ? 'filter blur' : ''}`}>${formatCurrency(grandNetTotal)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="min-w-[800px]">
                    <table className="w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs sm:text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-20">
                        <tr>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase sticky left-0 bg-gray-50 dark:bg-gray-800 z-30"> {/* Increased z-index for corner */}
                            Category Group / Category
                          </th>
                          {monthHeaders.map(month => (
                            <th key={month.key} className="px-1 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">
                              <span className="hidden sm:inline">{month.label}</span>
                              <span className="sm:hidden">{month.label.split(' ')[0]}</span>
                            </th>
                          ))}
                          <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-700 z-10">Avg</th>
                          <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-700 z-10">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {categoryData.map((group) => (
                          <React.Fragment key={group.groupName}>
                            <tr className={`font-semibold ${group.isIncomeGroup ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                              <td className="px-2 py-2 text-xs sm:text-sm text-gray-900 dark:text-white sticky left-0 bg-opacity-75 backdrop-blur-sm z-10">
                                {group.groupName}
                              </td>
                              {monthHeaders.map(month => (
                                <td key={`${group.groupName}-${month.key}-group`} className={`px-1 py-2 text-right text-xs sm:text-sm ${group.monthlyData[month.key] >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                                  {Math.abs(group.monthlyData[month.key] || 0) < 0.01 ? '—' : `$${formatCurrency(group.monthlyData[month.key])}`}
                                </td>
                              ))}
                              <td className={`px-2 py-2 text-right text-xs sm:text-sm ${group.average >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                                ${formatCurrency(group.average)}
                              </td>
                              <td className={`px-2 py-2 text-right text-xs sm:text-sm ${group.total >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                                ${formatCurrency(group.total)}
                              </td>
                            </tr>
                            {group.categories.map((category) => (
                              <tr 
                                key={category.category} 
                                id={`category-${(group.groupName + '-' + category.category).replace(/\s+/g, '-').replace(/[^\w-]+/g, '')}`}
                                className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                              >
                                <td className="pl-6 pr-2 py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 sticky left-0 bg-opacity-75 backdrop-blur-sm z-10">
                                  <span className="block truncate max-w-[120px] sm:max-w-none" title={category.category}>
                                    {category.category.startsWith('Inflow: ') ? category.category.substring(8) : category.category}
                                  </span>
                                </td>
                                {monthHeaders.map(month => {
                                  const value = category.monthlyData[month.key] || 0;
                                  return (
                                    <td key={`${category.category}-${month.key}`} className={`px-1 py-2 text-right text-xs sm:text-sm ${value >= 0 ? 'text-green-600' : 'text-red-600'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                                      {Math.abs(value) < 0.01 ? '—' : `$${formatCurrency(value)}`}
                                    </td>
                                  );
                                })}
                                <td className={`px-2 py-2 text-right text-xs sm:text-sm font-semibold ${category.average >= 0 ? 'text-green-600' : 'text-red-600'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                                  ${formatCurrency(category.average)}
                                </td>
                                <td className={`px-2 py-2 text-right text-xs sm:text-sm font-semibold ${category.total >= 0 ? 'text-green-600' : 'text-red-600'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                                  ${formatCurrency(category.total)}
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                        
                        {/* Total Income Row */}
                        <tr className="bg-green-200 dark:bg-green-800/50 border-t-2 border-gray-300 dark:border-gray-600 font-bold">
                          <td className="px-2 py-2 text-xs sm:text-sm text-gray-900 dark:text-white sticky left-0 bg-opacity-75 backdrop-blur-sm z-10">TOTAL INCOME</td>
                          {monthHeaders.map(month => {
                            const incomeForMonth = categoryData.reduce((sum, group) => sum + (group.isIncomeGroup ? (group.monthlyData[month.key] || 0) : 0), 0);
                            return (
                              <td key={`total-income-${month.key}`} className={`px-1 py-2 text-right text-xs sm:text-sm text-green-700 dark:text-green-300 ${isPrivacyMode ? 'filter blur' : ''}`}>
                                ${formatCurrency(incomeForMonth)}
                              </td>
                            );
                          })}
                          <td className={`px-2 py-2 text-right text-xs sm:text-sm text-green-700 dark:text-green-300 ${isPrivacyMode ? 'filter blur' : ''}`}>
                            ${formatCurrency(totalIncome / (monthHeaders.length || 1))}
                          </td>
                          <td className={`px-2 py-2 text-right text-xs sm:text-sm text-green-700 dark:text-green-300 ${isPrivacyMode ? 'filter blur' : ''}`}>
                            ${formatCurrency(totalIncome)}
                          </td>
                        </tr>

                        {/* Total Expense Row */}
                        <tr className="bg-red-200 dark:bg-red-800/50 font-bold">
                          <td className="px-2 py-2 text-xs sm:text-sm text-gray-900 dark:text-white sticky left-0 bg-opacity-75 backdrop-blur-sm z-10">TOTAL EXPENSE</td>
                          {monthHeaders.map(month => {
                            const expenseForMonth = categoryData.reduce((sum, group) => sum + (!group.isIncomeGroup ? (group.monthlyData[month.key] || 0) : 0), 0);
                            return (
                              <td key={`total-expense-${month.key}`} className={`px-1 py-2 text-right text-xs sm:text-sm text-red-700 dark:text-red-300 ${isPrivacyMode ? 'filter blur' : ''}`}>
                                ${formatCurrency(expenseForMonth)}
                              </td>
                            );
                          })}
                          <td className={`px-2 py-2 text-right text-xs sm:text-sm text-red-700 dark:text-red-300 ${isPrivacyMode ? 'filter blur' : ''}`}>
                            ${formatCurrency(totalExpenses / (monthHeaders.length || 1))}
                          </td>
                          <td className={`px-2 py-2 text-right text-xs sm:text-sm text-red-700 dark:text-red-300 ${isPrivacyMode ? 'filter blur' : ''}`}>
                            ${formatCurrency(totalExpenses)}
                          </td>
                        </tr>
                        
                        {/* Net Totals row */}
                        <tr className="bg-gray-200 dark:bg-gray-700 border-t-2 border-gray-400 dark:border-gray-500 font-bold">
                          <td className="px-2 py-2 text-xs sm:text-sm text-gray-900 dark:text-white sticky left-0 bg-opacity-75 backdrop-blur-sm z-10">NET TOTAL</td>
                          {monthHeaders.map(month => {
                            const value = netTotalByMonth[month.key] || 0;
                            return (
                              <td key={`net-total-${month.key}`} className={`px-1 py-2 text-right text-xs sm:text-sm ${value >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                                ${formatCurrency(value)}
                              </td>
                            );
                          })}
                          <td className={`px-2 py-2 text-right text-xs sm:text-sm ${grandNetAverage >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                            ${formatCurrency(grandNetAverage)}
                          </td>
                          <td className={`px-2 py-2 text-right text-xs sm:text-sm ${grandNetTotal >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                            ${formatCurrency(grandNetTotal)}
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
