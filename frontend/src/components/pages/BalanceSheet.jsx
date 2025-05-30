import React, { useState, useMemo, useEffect } from 'react';
import { useYNAB, usePrivacy } from '../../contexts/YNABDataContext';
import PageTransition from '../ui/PageTransition';
import LoadingSpinner from '../ui/LoadingSpinner';
import Card from '../ui/Card'; // Keep Card for basic layout
import { getTransactionAmount, normalizeYNABAccountType } from '../../utils/ynabHelpers'; // Added back
import { formatCurrency as formatCurrencyUtil } from '../../utils/formatters'; // Added back, aliased
import {
  ListBulletIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
  LinkIcon,
  FunnelIcon,
  AdjustmentsHorizontalIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline'; // Added back Heroicons

// Define income categories and debt payment categories
const ynabReportIncomeCategories = [
  "Inflow: Ready to Assign", "Adjustment", "Amazon", "Apple", "Bank of America Mobile", "Barry Getzen",
  "Deposit Mobile Banking", "Disney", "eCheck Deposit", "Gemini", "Interest Income", "Interest Paid",
  "Merrill Lynch Funds Transfer", "Mspbna Transfer", "Nanoleaf", "Next Brick Prope", 
  "Next Brick Prope Sigonfile", "Paid Leave Wa Future Amount Tran Ddir", "Venmo"
];
const debtPaymentCategoriesNamedAsTransfers = ["8331 Mortgage", "Kia Loan"];

// CategoryCard component for mobile view
const CategoryCard = ({ categoryItem, selectedMonthKey, isPrivacyMode }) => {
  let displayValue;
  if (selectedMonthKey === 'total') {
    displayValue = categoryItem.totalNet; 
  } else if (selectedMonthKey === 'average') {
    displayValue = categoryItem.averageNet; 
  } else {
    const monthVal = categoryItem.monthlyData[selectedMonthKey];
    displayValue = monthVal ? (monthVal.income || 0) - (monthVal.expense || 0) : 0;
  }
  
  const type = categoryItem.type || (displayValue >= 0 ? 'income' : 'expense');

  return (
    <div className="glass-card p-3 mb-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate pr-2">{categoryItem.category}</span>
        <span className={`text-sm font-semibold ${displayValue >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} ${isPrivacyMode ? 'filter blur' : ''}`}>
          {formatCurrencyUtil(type === 'expense' ? Math.abs(displayValue) : displayValue)}
        </span>
      </div>
    </div>
  );
};

export default function BalanceSheetIncomeExpense() {
  const { 
    accounts: ynabAccounts, 
    transactions: ynabTransactions, 
    rawCategories,
    isLoading: isYnabLoading, 
    error: ynabError 
  } = useYNAB();
  const { isPrivacyMode } = usePrivacy();

  // State for UI controls
  const [periodMonths, setPeriodMonths] = useState(12); 
  const [sortBy, setSortBy] = useState('amount'); 
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('total'); // For sorting by amount column
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [showCategoryListModal, setShowCategoryListModal] = useState(false); // Added back for modal

  const [message, setMessage] = useState("Balance Sheet Page - Initializing...");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const formatCurrency = formatCurrencyUtil; // Use the imported utility

  const allAccounts = useMemo(() => [...(ynabAccounts || [])], [ynabAccounts]);
  
  const investmentAccountIds = useMemo(() => new Set(
    allAccounts
      .filter(acc => normalizeYNABAccountType(acc.type) === 'investment')
      .map(acc => acc.id || acc.account_id)
      .filter(id => id)
  ), [allAccounts]);

  const categoryIdToGroupInfoMap = useMemo(() => {
    const map = new Map();
    if (rawCategories && rawCategories.data && rawCategories.data.category_groups) {
      rawCategories.data.category_groups.forEach(group => {
        if (group.categories) {
          group.categories.forEach(category => {
            map.set(category.id, { 
              groupId: group.id, 
              groupName: group.name, 
              categoryName: category.name 
            });
          });
        }
      });
    }
    return map;
  }, [rawCategories]);

  useEffect(() => {
    if (isYnabLoading) {
      setMessage("Loading YNAB Data...");
    } else if (ynabError) {
      setMessage(`Error loading YNAB Data: ${ynabError.message}`);
    } else if (ynabTransactions?.length) {
      setMessage(`Successfully loaded ${ynabTransactions.length} transactions. Accounts: ${ynabAccounts?.length || 0}. Category Groups: ${rawCategories?.data?.category_groups?.length || 0}. Categories Mapped: ${categoryIdToGroupInfoMap.size}`);
    } else {
      setMessage("No YNAB data loaded or available. Connect YNAB if you haven't.");
    }
  }, [isYnabLoading, ynabError, ynabTransactions, ynabAccounts, rawCategories, categoryIdToGroupInfoMap]);

  // Main data processing hook
  const { 
    processedCategoryGroups, 
    monthHeaders, 
    grandTotalIncome, 
    grandTotalExpenses, 
    grandNetTotal,
    monthlySummaryTotals 
  } = useMemo(() => {
    // Initial check, same as before
    if (!ynabTransactions?.length || !allAccounts?.length || categoryIdToGroupInfoMap.size === 0) {
      return { 
        processedCategoryGroups: [], 
        monthHeaders: [], 
        grandTotalIncome: 0, 
        grandTotalExpenses: 0, 
        grandNetTotal: 0, 
        monthlySummaryTotals: {} 
      };
    }

    // Calculate actualPeriodMonths (full logic)
    const actualPeriodMonths = periodMonths === 999 ? 
      (ynabTransactions.length > 0 ? 
        Math.max(1, Math.ceil((new Date() - new Date(ynabTransactions.reduce((min, t) => {
          if (!t.date) return min; 
          const tDate = new Date(t.date);
          return isNaN(tDate.getTime()) ? min : Math.min(min, tDate.getTime());
        }, Date.now()))) / (1000 * 60 * 60 * 24 * 30.4375))) 
        : 12) 
      : periodMonths;

    // Calculate currentMonthHeaders
    const currentMonthHeaders = [];
    const today = new Date();
    for (let i = actualPeriodMonths - 1; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = date.toISOString().slice(0, 7); 
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      currentMonthHeaders.push({ key: monthKey, label: monthLabel });
    }
    
    const categoryGroupDataMap = {}; // Will hold aggregated data
    
    // Placeholder for monthly summary totals, calculated based on headers
    const currentMonthlySummaryTotals = currentMonthHeaders.reduce((acc, mh) => {
      acc[mh.key] = { income: 0, expenses: 0, net: 0 };
      return acc;
    }, {});

    const processSingleTxn = (txn, accountId) => {
      if (investmentAccountIds.has(accountId)) return;
      
      const isPayeeTransfer = txn.payee_name && txn.payee_name.toLowerCase().startsWith("transfer : ");
      const isCategorizedDebtPayment = debtPaymentCategoriesNamedAsTransfers.includes(txn.category_name);
      if (txn.transfer_account_id || (isPayeeTransfer && !isCategorizedDebtPayment)) return;
      
      if (txn.payee_name === 'Reconciliation Balance Adjustment' || txn.payee_name === 'Starting Balance') return;

      if (!txn.date || isNaN(new Date(txn.date).getTime())) {
        // console.warn('Skipping transaction due to invalid or missing date:', txn); // Keep console logs minimal for now
        return; 
      }
      const transactionDate = new Date(txn.date);
      const monthKey = transactionDate.toISOString().slice(0, 7);

      if (!currentMonthHeaders.find(mh => mh.key === monthKey)) return; 

      const rawAmount = getTransactionAmount(txn); // This will be used in the next step
      const groupInfo = categoryIdToGroupInfoMap.get(txn.category_id);
      const categoryName = groupInfo?.categoryName || txn.category_name || 'Uncategorized';
      let groupName = groupInfo?.groupName;

      if (!groupName) {
        groupName = (rawAmount >= 0 && ynabReportIncomeCategories.includes(categoryName)) ? 'Other Income Sources' : 'Uncategorized Expenses';
      }
      
      if (!categoryGroupDataMap[groupName]) {
        categoryGroupDataMap[groupName] = {
          groupName: groupName,
          categories: {},
          // Initialize monthly data structures for the group - amounts will be added later
          groupMonthlyIncome: currentMonthHeaders.reduce((acc, mh) => ({...acc, [mh.key]: 0}), {}),
          groupMonthlyExpense: currentMonthHeaders.reduce((acc, mh) => ({...acc, [mh.key]: 0}), {}),
          groupTotalIncome: 0,
          groupTotalExpense: 0,
        };
      }
      const currentGroup = categoryGroupDataMap[groupName];
      
      if (!currentGroup.categories[categoryName]) {
        currentGroup.categories[categoryName] = {
          category: categoryName,
          // Initialize monthly data structures for the category - amounts will be added later
          monthlyData: currentMonthHeaders.reduce((acc, mh) => ({...acc, [mh.key]: {income: 0, expense: 0}}), {}),
          totalIncome: 0,
          totalExpense: 0,
          type: ynabReportIncomeCategories.includes(categoryName) ? 'income' : 'expense'
        };
      }
      const currentCategory = currentGroup.categories[categoryName];

      // Accumulate amounts
      if (currentCategory.type === 'income') {
        currentCategory.monthlyData[monthKey].income += rawAmount;
        currentCategory.totalIncome += rawAmount;
        currentGroup.groupMonthlyIncome[monthKey] += rawAmount;
        currentGroup.groupTotalIncome += rawAmount;
        currentMonthlySummaryTotals[monthKey].income += rawAmount;
      } else { // Expense type
        if (rawAmount < 0) { // Outflow
          currentCategory.monthlyData[monthKey].expense += Math.abs(rawAmount);
          currentCategory.totalExpense += Math.abs(rawAmount);
          currentGroup.groupMonthlyExpense[monthKey] += Math.abs(rawAmount);
          currentGroup.groupTotalExpense += Math.abs(rawAmount);
          currentMonthlySummaryTotals[monthKey].expenses += Math.abs(rawAmount);
        } else { // Inflow to expense category (refund)
          currentCategory.monthlyData[monthKey].expense -= rawAmount; // Reduce expense
          currentCategory.totalExpense -= rawAmount;
          currentGroup.groupMonthlyExpense[monthKey] -= rawAmount;
          currentGroup.groupTotalExpense -= rawAmount;
          currentMonthlySummaryTotals[monthKey].expenses -= rawAmount;
        }
      }
    };

    (ynabTransactions || []).forEach(transaction => {
      if (transaction.subtransactions && transaction.subtransactions.length > 0) {
        transaction.subtransactions.forEach(subTxn => {
          const effectivePayeeName = subTxn.payee_name || transaction.payee_name;
          const subTxnWithInheritance = { 
            ...subTxn, 
            payee_name: effectivePayeeName, 
            date: transaction.date, 
            category_id: subTxn.category_id || transaction.category_id,
            category_name: subTxn.category_name || transaction.category_name,
            transfer_account_id: subTxn.transfer_account_id || transaction.transfer_account_id
          };
          processSingleTxn(subTxnWithInheritance, transaction.account_id);
        });
      } else {
        processSingleTxn(transaction, transaction.account_id);
      }
    });
    
    let finalGrandTotalIncome = 0;
    let finalGrandTotalExpenses = 0;

    const finalCategoryGroups = Object.values(categoryGroupDataMap).map(group => {
      const categories = Object.values(group.categories).map(cat => {
        const catTotalNet = cat.totalIncome - cat.totalExpense;
        return {
          ...cat,
          totalNet: catTotalNet,
          averageIncome: cat.totalIncome / actualPeriodMonths,
          averageExpense: cat.totalExpense / actualPeriodMonths,
          averageNet: catTotalNet / actualPeriodMonths,
        };
      }).filter(cat => showActiveOnly ? (Math.abs(cat.totalIncome) >= 0.01 || Math.abs(cat.totalExpense) >= 0.01) : true);

      if (sortBy === 'amount') {
        categories.sort((a,b) => {
            const valA = selectedMonth === 'total' ? Math.abs(a.totalNet) : 
                         selectedMonth === 'average' ? Math.abs(a.averageNet) :
                         Math.abs((a.monthlyData[selectedMonth]?.income || 0) - (a.monthlyData[selectedMonth]?.expense || 0));
            const valB = selectedMonth === 'total' ? Math.abs(b.totalNet) :
                         selectedMonth === 'average' ? Math.abs(b.averageNet) :
                         Math.abs((b.monthlyData[selectedMonth]?.income || 0) - (b.monthlyData[selectedMonth]?.expense || 0));
            return valB - valA;
        });
      } else { 
        categories.sort((a,b) => a.category.localeCompare(b.category));
      }
      
      const groupTotalNet = group.groupTotalIncome - group.groupTotalExpense;
      finalGrandTotalIncome += group.groupTotalIncome;
      finalGrandTotalExpenses += group.groupTotalExpense;
      
      // Determine if group is income type based on its aggregated content
      const isActuallyIncomeGroup = group.groupTotalIncome > 0.005 && group.groupTotalIncome > group.groupTotalExpense;


      return {
        ...group,
        categories: categories,
        groupTotalNet: groupTotalNet,
        groupAverageIncome: group.groupTotalIncome / actualPeriodMonths,
        groupAverageExpense: group.groupTotalExpense / actualPeriodMonths,
        groupAverageNet: groupTotalNet / actualPeriodMonths,
        isIncomeGroup: isActuallyIncomeGroup, 
      };
    }).filter(group => group.categories.length > 0 || (showActiveOnly ? (Math.abs(group.groupTotalIncome) >=0.01 || Math.abs(group.groupTotalExpense) >=0.01) : true))
    .sort((a,b) => {
        if (a.isIncomeGroup && !b.isIncomeGroup) return -1;
        if (b.isIncomeGroup && !a.isIncomeGroup) return 1; 
        return a.groupName.localeCompare(b.groupName);
    });
    
    currentMonthHeaders.forEach(mh => {
      currentMonthlySummaryTotals[mh.key].net = currentMonthlySummaryTotals[mh.key].income - currentMonthlySummaryTotals[mh.key].expenses;
    });

    return { 
      processedCategoryGroups: finalCategoryGroups, 
      monthHeaders: currentMonthHeaders, 
      grandTotalIncome: finalGrandTotalIncome, 
      grandTotalExpenses: finalGrandTotalExpenses, 
      grandNetTotal: finalGrandTotalIncome - finalGrandTotalExpenses,
      monthlySummaryTotals: currentMonthlySummaryTotals
    };
  }, [ynabTransactions, ynabAccounts, periodMonths, investmentAccountIds, categoryIdToGroupInfoMap, allAccounts, showActiveOnly, sortBy, selectedMonth]); // Added showActiveOnly, sortBy, selectedMonth to deps


  if (isYnabLoading && (!processedCategoryGroups || processedCategoryGroups.length === 0) && !ynabError) { // Adjusted loading check
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
      <div className="w-full max-w-none space-y-6 pb-4">
        <Card className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Balance Sheet (Controls Added)</h1>
          <p className="mt-2 text-gray-700 dark:text-gray-300">{message}</p>
          {ynabError && (
            <p className="mt-2 text-red-500">Error details: {JSON.stringify(ynabError)}</p>
          )}
        </Card>

        {/* UI Controls Placeholder */}
        <Card className="glass-card p-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 items-center">
              {/* Period Selector */}
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <select 
                  value={periodMonths} 
                  onChange={(e) => setPeriodMonths(Number(e.target.value))} 
                  className="glass-input px-3 py-1 text-sm rounded-lg text-gray-900 dark:text-white bg-white/20 dark:bg-black/20 border border-white/30 dark:border-black/30 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={3}>Last 3 months</option>
                  <option value={6}>Last 6 months</option>
                  <option value={12}>Last 12 months</option>
                  <option value={24}>Last 24 months</option>
                  <option value={999}>All time</option>
                </select>
              </div>

              {/* Sort By Selector */}
              <div className="flex items-center gap-2">
                <FunnelIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)} 
                  className="glass-input px-3 py-1 text-sm rounded-lg text-gray-900 dark:text-white bg-white/20 dark:bg-black/20 border border-white/30 dark:border-black/30 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="amount">Sort by Amount</option>
                  <option value="alphabetical">Sort Alphabetically</option>
                </select>
              </div>

              {/* Selected Month for Amount Sort (Conditional) */}
              {sortBy === 'amount' && (
                <div className="flex items-center gap-2">
                  <AdjustmentsHorizontalIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  <select 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(e.target.value)} 
                    className="glass-input px-3 py-1 text-sm rounded-lg text-gray-900 dark:text-white bg-white/20 dark:bg-black/20 border border-white/30 dark:border-black/30 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="total">Total</option>
                    <option value="average">Average</option>
                    {/* Populate month options from calculated monthHeaders */}
                    {monthHeaders.map(month => (<option key={month.key} value={month.key}>{month.label}</option>))}
                  </select>
                </div>
              )}
            </div>
            
            {/* Show Active Only Checkbox */}
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showActiveOnly} 
                onChange={(e) => setShowActiveOnly(e.target.checked)} 
                className="rounded text-blue-600 focus:ring-blue-500 bg-white/30 dark:bg-black/30 border-white/50 dark:border-black/50"
              />
              Active categories only
            </label>
          </div>
        </Card>

        {/* Category List Modal */}
        {showCategoryListModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md max-h-[80vh] overflow-y-auto p-0 glass-card">
              <div className="flex justify-between items-center p-4 border-b border-white/10 dark:border-black/20 sticky top-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm z-10">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">All Categories</h3>
                <button onClick={() => setShowCategoryListModal(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                {processedCategoryGroups.map(group => (
                  <div key={`modal-group-${group.groupName}`}>
                    <h4 className={`text-md font-semibold mb-1.5 ${group.isIncomeGroup ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {group.groupName}
                    </h4>
                    <ul className="space-y-1 pl-2">
                      {group.categories.map(category => (
                        <li key={`modal-cat-${category.category}`} className="text-sm">
                          <a 
                            href={`#category-${(group.groupName + '-' + category.category).replace(/\s+/g, '-').replace(/[^\w-]+/g, '')}`} 
                            onClick={() => setShowCategoryListModal(false)}
                            className="text-blue-600 hover:underline dark:text-blue-400 flex items-center gap-1.5"
                          >
                            <LinkIcon className="h-3.5 w-3.5 flex-shrink-0" />
                            {category.category}
                          </a>
                        </li>
                      ))}
                      {group.categories.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-400 italic">No categories in this group for the selected period.</p>}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Main Category Breakdown Display */}
        <div className="space-y-4">
          {processedCategoryGroups.length > 0 ? (
            processedCategoryGroups.map(group => (
              <Card key={group.groupName} className="glass-card overflow-hidden p-0">
                <button 
                  onClick={() => toggleGroupExpansion(group.groupName)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 dark:hover:bg-black/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expandedGroups.has(group.groupName) ? <ChevronUpIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" /> : <ChevronDownIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />}
                    <div className={`w-3 h-3 rounded-full ${group.isIncomeGroup ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <h3 className="text-md sm:text-lg font-semibold text-gray-900 dark:text-white">{group.groupName} ({group.categories.length})</h3>
                  </div>
                  <div className="text-right">
                     <p className={`text-sm sm:text-base font-bold ${group.isIncomeGroup ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                       {formatCurrency(group.isIncomeGroup ? group.groupTotalIncome : group.groupTotalExpense)}
                     </p>
                     <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                       Avg: {formatCurrency(group.isIncomeGroup ? group.groupAverageIncome : group.groupAverageExpense)}
                     </p>
                  </div>
                </button>

                {expandedGroups.has(group.groupName) && (
                  <div className="border-t border-white/10 dark:border-black/20">
                    {isMobile ? (
                      <div className="p-2 space-y-2">
                        {group.categories.map(item => (
                          <CategoryCard 
                            key={item.category} 
                            categoryItem={{...item, type: group.isIncomeGroup ? 'income' : 'expense'}} // Pass type for CategoryCard
                            selectedMonthKey={selectedMonth} // Pass selectedMonth for consistent display logic
                            isPrivacyMode={isPrivacyMode} 
                          />
                        ))}
                        {group.categories.length === 0 && <p className="text-xs text-center py-2 text-gray-500 dark:text-gray-400">No active categories in this group.</p>}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs sm:text-sm">
                          <thead className="bg-white/5 dark:bg-black/10">
                            <tr>
                              <th className="pl-6 pr-2 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 sticky left-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm z-10">Category</th>
                              {monthHeaders.map(month => (
                                <th key={month.key} className="px-1.5 py-2 text-right font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{month.label.split(' ')[0]}</th>
                              ))}
                              <th className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300 sticky right-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm z-10 w-24">Avg</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300 sticky right-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm z-10 w-24 mr-2">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/10 dark:divide-black/20">
                            {group.categories.map(item => (
                              <tr key={item.category} className="hover:bg-white/5 dark:hover:bg-black/10 transition-colors" id={`category-${(group.groupName + '-' + item.category).replace(/\s+/g, '-').replace(/[^\w-]+/g, '')}`}>
                                <td className="pl-6 pr-2 py-1.5 font-medium text-gray-800 dark:text-gray-200 sticky left-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm whitespace-nowrap truncate max-w-[150px] sm:max-w-xs" title={item.category}>
                                  {item.category}
                                </td>
                                {monthHeaders.map(month => {
                                  const displayVal = group.isIncomeGroup ? (item.monthlyData[month.key]?.income || 0) : (item.monthlyData[month.key]?.expense || 0);
                                  const valIsZero = Math.abs(displayVal) < 0.01;
                                  return (
                                    <td key={`${item.category}-${month.key}`} className={`px-1.5 py-1.5 text-right ${valIsZero ? 'text-gray-400 dark:text-gray-600' : (group.isIncomeGroup ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')} ${isPrivacyMode ? 'filter blur' : ''}`}>
                                      {valIsZero ? '-' : formatCurrency(displayVal)}
                                    </td>
                                  );
                                })}
                                <td className={`px-3 py-1.5 text-right font-medium sticky right-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm ${group.isIncomeGroup ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                                  {formatCurrency(group.isIncomeGroup ? item.averageIncome : item.averageExpense)}
                                </td>
                                <td className={`px-3 py-1.5 text-right font-bold sticky right-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm mr-2 ${group.isIncomeGroup ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                                  {formatCurrency(group.isIncomeGroup ? item.totalIncome : item.totalExpense)}
                                </td>
                              </tr>
                            ))}
                            {group.categories.length === 0 && (
                              <tr><td colSpan={monthHeaders.length + 3} className="text-center py-3 text-sm text-gray-500 dark:text-gray-400 italic">No active categories in this group for the selected period.</td></tr>
                            )}
                            {/* Group Subtotal Row */}
                            <tr className="bg-white/5 dark:bg-black/10 font-semibold border-t-2 border-white/20 dark:border-black/30">
                                <td className="pl-6 pr-2 py-2 text-gray-800 dark:text-gray-100 sticky left-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">Subtotal: {group.groupName}</td>
                                {monthHeaders.map(month => (
                                    <td key={`${month.key}-group-subtotal`} className={`px-1.5 py-2 text-right ${group.isIncomeGroup ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                                        {formatCurrency(group.isIncomeGroup ? group.groupMonthlyIncome[month.key] : group.groupMonthlyExpense[month.key])}
                                    </td>
                                ))}
                                <td className={`px-3 py-2 text-right sticky right-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm ${group.isIncomeGroup ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                                    {formatCurrency(group.isIncomeGroup ? group.groupAverageIncome : group.groupAverageExpense)}
                                </td>
                                <td className={`px-3 py-2 text-right sticky right-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm mr-2 ${group.isIncomeGroup ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                                    {formatCurrency(group.isIncomeGroup ? group.groupTotalIncome : group.groupTotalExpense)}
                                </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))
          ) : (
            <Card className="glass-card p-4">
              <div className="text-center py-8">
                <ListBulletIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
                <h3 className="text-md font-medium text-gray-800 dark:text-gray-200">
                  {isYnabLoading ? "Processing data..." : "No Category Data"}
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {isYnabLoading ? "Please wait while we fetch and calculate." : "There's no data to display for the selected period or filters."}
                </p>
              </div>
            </Card>
          )}
        </div>

        {/* Grand Total Rows Table */}
        {processedCategoryGroups.length > 0 && (
          <Card className="glass-card overflow-hidden p-0 mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-white/5 dark:bg-black/10">
                  <tr>
                    <th className="pl-6 pr-2 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 sticky left-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm z-10">Summary Totals</th>
                    {monthHeaders.map(month => (
                      <th key={`grand-total-header-${month.key}`} className="px-1.5 py-2 text-right font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{month.label.split(' ')[0]}</th>
                    ))}
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300 sticky right-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm z-10 w-24">Avg</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300 sticky right-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm z-10 w-24 mr-2">Total</th>
                  </tr>
                </thead>
                <tbody className="font-bold divide-y divide-white/10 dark:divide-black/20">
                  {/* GRAND TOTAL INCOME ROW */}
                  <tr className="bg-green-100/50 dark:bg-green-900/30">
                    <td className="pl-6 pr-2 py-2 text-gray-800 dark:text-gray-100 sticky left-0 bg-green-100/80 dark:bg-green-900/80 backdrop-blur-sm">GRAND TOTAL INCOME</td>
                    {monthHeaders.map(month => (
                      <td key={`grand-total-income-${month.key}`} className={`px-1.5 py-2 text-right text-green-700 dark:text-green-300 ${isPrivacyMode ? 'filter blur' : ''}`}>
                        {formatCurrency(monthlySummaryTotals[month.key]?.income || 0)}
                      </td>
                    ))}
                    <td className={`px-3 py-2 text-right text-green-700 dark:text-green-300 sticky right-0 bg-green-100/80 dark:bg-green-900/80 backdrop-blur-sm ${isPrivacyMode ? 'filter blur' : ''}`}>
                      {formatCurrency(grandTotalIncome / (monthHeaders.length || 1))}
                    </td>
                    <td className={`px-3 py-2 text-right text-green-700 dark:text-green-300 sticky right-0 bg-green-100/80 dark:bg-green-900/80 backdrop-blur-sm mr-2 ${isPrivacyMode ? 'filter blur' : ''}`}>
                      {formatCurrency(grandTotalIncome)}
                    </td>
                  </tr>
                  {/* GRAND TOTAL EXPENSE ROW */}
                  <tr className="bg-red-100/50 dark:bg-red-900/30">
                    <td className="pl-6 pr-2 py-2 text-gray-800 dark:text-gray-100 sticky left-0 bg-red-100/80 dark:bg-red-900/80 backdrop-blur-sm">GRAND TOTAL EXPENSE</td>
                    {monthHeaders.map(month => (
                      <td key={`grand-total-expense-${month.key}`} className={`px-1.5 py-2 text-right text-red-700 dark:text-red-300 ${isPrivacyMode ? 'filter blur' : ''}`}>
                        {formatCurrency(monthlySummaryTotals[month.key]?.expenses || 0)}
                      </td>
                    ))}
                    <td className={`px-3 py-2 text-right text-red-700 dark:text-red-300 sticky right-0 bg-red-100/80 dark:bg-red-900/80 backdrop-blur-sm ${isPrivacyMode ? 'filter blur' : ''}`}>
                      {formatCurrency(grandTotalExpenses / (monthHeaders.length || 1))}
                    </td>
                    <td className={`px-3 py-2 text-right text-red-700 dark:text-red-300 sticky right-0 bg-red-100/80 dark:bg-red-900/80 backdrop-blur-sm mr-2 ${isPrivacyMode ? 'filter blur' : ''}`}>
                      {formatCurrency(grandTotalExpenses)}
                    </td>
                  </tr>
                  {/* NET TOTAL ROW */}
                  <tr className="bg-gray-200/50 dark:bg-gray-700/30 border-t-2 border-gray-400/50 dark:border-gray-500/50">
                    <td className="pl-6 pr-2 py-2 text-gray-800 dark:text-gray-100 sticky left-0 bg-gray-200/80 dark:bg-gray-700/80 backdrop-blur-sm">NET TOTAL</td>
                    {monthHeaders.map(month => {
                      const netValue = monthlySummaryTotals[month.key]?.net || 0;
                      return (
                        <td key={`grand-net-total-${month.key}`} className={`px-1.5 py-2 text-right ${netValue >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                          {formatCurrency(netValue)}
                        </td>
                      );
                    })}
                    <td className={`px-3 py-2 text-right sticky right-0 bg-gray-200/80 dark:bg-gray-700/80 backdrop-blur-sm ${(grandNetTotal / (monthHeaders.length || 1)) >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                      {formatCurrency(grandNetTotal / (monthHeaders.length || 1))}
                    </td>
                    <td className={`px-3 py-2 text-right sticky right-0 bg-gray-200/80 dark:bg-gray-700/80 backdrop-blur-sm mr-2 ${(grandNetTotal) >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'} ${isPrivacyMode ? 'filter blur' : ''}`}>
                      {formatCurrency(grandNetTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </PageTransition>
  );
}
