import React, { useState, useMemo, useEffect, Fragment, useCallback } from 'react';
import { useYNAB, usePrivacy } from '../../contexts/YNABDataContext';
import PageTransition from '../ui/PageTransition';
import LoadingSpinner from '../ui/LoadingSpinner';
import Card from '../ui/Card';
import { normalizeYNABAccountType } from '../../utils/ynabHelpers';
import { formatCurrency } from '../../utils/formatters';
import { useCategoryProcessor } from '../../hooks/useCategoryProcessor';
import {
  ListBulletIcon,
  CalendarIcon,
  FunnelIcon,
  AdjustmentsHorizontalIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

// Category row component for the simple table
const CategoryRow = React.memo(({ item, monthHeaders, privacyMode, isIncome, isGrouped = false }) => {
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-900 z-10">
        <span className={isGrouped ? 'pl-6' : ''}>
          {item.category}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        {/* Empty for income, show group for expenses */}
        {!isIncome && item.groupName}
      </td>
      {monthHeaders.map(month => {
        const displayVal = isIncome 
          ? (item.monthlyData[month.key]?.income || 0) 
          : (item.monthlyData[month.key]?.expense || 0);
        const valIsZero = Math.abs(displayVal) < 0.01;
        return (
          <td key={`${item.category}-${month.key}`} 
              className={`px-3 py-3 text-sm text-right ${
                valIsZero ? 'text-gray-400 dark:text-gray-600' 
                : (isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')
              } ${privacyMode ? 'privacy-blur' : ''}`}>
            {valIsZero ? '' : formatCurrency(displayVal)}
          </td>
        );
      })}
      <td className={`px-3 py-3 text-sm text-right font-medium ${
        isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
      } ${privacyMode ? 'privacy-blur' : ''}`}>
        {formatCurrency(isIncome ? item.averageIncome : item.averageExpense)}
      </td>
      <td className={`px-3 py-3 text-sm text-right font-bold ${
        isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
      } ${privacyMode ? 'privacy-blur' : ''}`}>
        {formatCurrency(isIncome ? item.totalIncome : item.totalExpense)}
      </td>
    </tr>
  );
});

CategoryRow.displayName = 'CategoryRow';

// Group header row component - styled like regular rows
const GroupHeaderRow = React.memo(({ group, monthHeaders, privacyMode, isIncome, isCollapsed, onToggle }) => {
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-900 z-10">
        <button
          onClick={onToggle}
          className="flex items-center gap-1 w-full text-left"
        >
          {isCollapsed ? (
            <ChevronRightIcon className="w-4 h-4" />
          ) : (
            <ChevronDownIcon className="w-4 h-4" />
          )}
          <span>{group.groupName}</span>
        </button>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        {/* Empty cell */}
      </td>
      {monthHeaders.map(month => {
        const monthTotal = isIncome ? 
          (group.monthlyIncomeTotals?.[month.key] || 0) : 
          (group.monthlyTotals?.[month.key] || 0);
        const valIsZero = Math.abs(monthTotal) < 0.01;
        return (
          <td key={`${group.groupName}-${month.key}`} 
              className={`px-3 py-3 text-sm text-right ${
                valIsZero ? 'text-gray-400 dark:text-gray-600' : 
                (isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')
              } ${privacyMode ? 'privacy-blur' : ''}`}>
            {valIsZero ? '' : formatCurrency(monthTotal)}
          </td>
        );
      })}
      <td className={`px-3 py-3 text-sm text-right ${
        isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
      } ${privacyMode ? 'privacy-blur' : ''}`}>
        {formatCurrency(isIncome ? group.groupAverageIncome : group.groupAverageExpense)}
      </td>
      <td className={`px-3 py-3 text-sm text-right ${
        isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
      } ${privacyMode ? 'privacy-blur' : ''}`}>
        {formatCurrency(isIncome ? group.groupTotalIncome : group.groupTotalExpense)}
      </td>
    </tr>
  );
});

GroupHeaderRow.displayName = 'GroupHeaderRow';

export default function IncomeVsExpenseReport() {
  const {
    accounts: ynabAccounts,
    transactions: ynabTransactions,
    categories,
    isLoading: isYnabLoading,
    error: ynabError
  } = useYNAB();
  const { privacyMode } = usePrivacy();

  // State
  const [periodMonths, setPeriodMonths] = useState(6); // Default to 6 months to match the CSV data
  const [sortBy, setSortBy] = useState('amount');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('total');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [incomeCollapsed, setIncomeCollapsed] = useState(false);

  // Toggle group collapse state
  const toggleGroupCollapse = useCallback((groupName) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  }, []);

  // Memoized accounts and investment IDs
  const allAccounts = useMemo(() => [...(ynabAccounts || [])], [ynabAccounts]);
  
  const investmentAccountIds = useMemo(() => new Set(
    allAccounts
      .filter(acc => normalizeYNABAccountType(acc.type) === 'investment')
      .map(acc => acc.id || acc.account_id)
      .filter(id => id)
  ), [allAccounts]);

  // Category mapping
  const categoryIdToGroupInfoMap = useMemo(() => {
    const map = new Map();
    if (categories?.category_groups) {
      categories.category_groups.forEach(group => {
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
  }, [categories]);

  // Use the category processor hook
  const { 
    processedCategoryGroups, 
    monthHeaders, 
    grandTotals,
    monthlySummaryTotals 
  } = useCategoryProcessor(
    ynabTransactions,
    categoryIdToGroupInfoMap,
    investmentAccountIds,
    periodMonths,
    showActiveOnly
  );

  // Organize income as a group and expense categories by group
  const { incomeGroup, expenseGroups } = useMemo(() => {
    const income = [];
    const expenseByGroup = {};
    
    processedCategoryGroups.forEach(group => {
      if (group.isIncomeGroup) {
        // Collect all income categories
        group.categories.forEach(category => {
          income.push({ ...category, groupName: group.groupName });
        });
      } else {
        // For expenses, maintain grouping structure
        if (!expenseByGroup[group.groupName]) {
          expenseByGroup[group.groupName] = {
            groupName: group.groupName,
            categories: [],
            groupTotalExpense: 0,
            groupAverageExpense: 0,
            monthlyTotals: {}
          };
        }
        
        group.categories.forEach(category => {
          expenseByGroup[group.groupName].categories.push(category);
        });
        
        // Calculate group totals
        expenseByGroup[group.groupName].groupTotalExpense = group.groupTotalExpense;
        expenseByGroup[group.groupName].groupAverageExpense = group.groupAverageExpense;
        
        // Calculate monthly totals for the group
        monthHeaders.forEach(month => {
          const monthTotal = group.categories.reduce((sum, cat) => 
            sum + (cat.monthlyData[month.key]?.expense || 0), 0
          );
          expenseByGroup[group.groupName].monthlyTotals[month.key] = monthTotal;
        });
      }
    });

    // Create income group structure
    let totalIncome = 0;
    const monthlyIncomeTotals = monthHeaders.reduce((acc, mh) => ({...acc, [mh.key]: 0}), {});
    
    income.forEach(cat => {
      totalIncome += cat.totalIncome;
      monthHeaders.forEach(mh => {
        monthlyIncomeTotals[mh.key] += cat.monthlyData[mh.key]?.income || 0;
      });
    });
    
    const incomeGroup = income.length > 0 ? {
      groupName: 'All Income Sources',
      categories: income,
      groupTotalIncome: totalIncome,
      groupAverageIncome: totalIncome / (monthHeaders.length || 1),
      monthlyIncomeTotals: monthlyIncomeTotals,
      isIncomeGroup: true
    } : null;

    // Don't sort - maintain API order
    const expenseGroupsList = Object.values(expenseByGroup);

    return {
      incomeGroup,
      expenseGroups: expenseGroupsList
    };
  }, [processedCategoryGroups, monthHeaders]);

  // Filter categories based on search
  const filteredData = useMemo(() => {
    if (!searchQuery) {
      return { incomeGroup, expenseGroups };
    }
    
    const query = searchQuery.toLowerCase();
    
    // Filter income group
    let filteredIncomeGroup = null;
    if (incomeGroup) {
      const filteredCategories = incomeGroup.categories.filter(cat => 
        cat.category.toLowerCase().includes(query)
      );
      
      if (filteredCategories.length > 0 || incomeGroup.groupName.toLowerCase().includes(query)) {
        filteredIncomeGroup = {
          ...incomeGroup,
          categories: filteredCategories.length > 0 ? filteredCategories : incomeGroup.categories
        };
      }
    }
    
    // Filter expense groups
    const filteredExpenseGroups = expenseGroups.map(group => {
      const filteredCategories = group.categories.filter(cat => 
        cat.category.toLowerCase().includes(query) || 
        group.groupName.toLowerCase().includes(query)
      );
      
      if (filteredCategories.length === 0 && !group.groupName.toLowerCase().includes(query)) {
        return null;
      }
      
      return {
        ...group,
        categories: filteredCategories.length > 0 ? filteredCategories : group.categories
      };
    }).filter(Boolean);
    
    return {
      incomeGroup: filteredIncomeGroup,
      expenseGroups: filteredExpenseGroups
    };
  }, [incomeGroup, expenseGroups, searchQuery]);

  // Loading state
  if (isYnabLoading && !ynabTransactions?.length) {
    return (
      <PageTransition>
        <div className="w-full max-w-none space-y-6 pb-4">
          <Card className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-left">Income vs Expense Report</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400 text-left">Track your income and expenses by category over time</p>
          </Card>
          <div className="animate-pulse space-y-4">
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="w-full max-w-none space-y-6 pb-4">
        {/* Header */}
        <Card className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-left">Income vs Expense Report</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400 text-left">
          {ynabError ? (
          <span className="text-red-600 dark:text-red-400">Error: {ynabError.message}</span>
          ) : (
          <>
          Track your income and expenses by category over time
          {ynabTransactions?.length > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-500 ml-2">
          ({ynabTransactions.length.toLocaleString()} transactions)
          </span>
          )}
          </>
          )}
          </p>
        </Card>

        {/* Controls */}
        <Card className="p-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 items-center">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search categories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {/* Period Selector */}
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <select
                  value={periodMonths}
                  onChange={(e) => setPeriodMonths(Number(e.target.value))}
                  className="text-sm rounded-lg px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value={3}>Last 3 months</option>
                  <option value={6}>Last 6 months</option>
                  <option value={12}>Last 12 months</option>
                  <option value={24}>Last 24 months</option>
                  <option value={999}>All time</option>
                </select>
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-2">
                <FunnelIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-sm rounded-lg px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="amount">Sort by Amount</option>
                  <option value="alphabetical">Sort Alphabetically</option>
                </select>
              </div>

              {/* Column Selector for Amount Sort */}
              {sortBy === 'amount' && (
                <div className="flex items-center gap-2">
                  <AdjustmentsHorizontalIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="text-sm rounded-lg px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="total">Total</option>
                    <option value="average">Average</option>
                    {monthHeaders.map(month => (
                      <option key={month.key} value={month.key}>{month.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Active Only Toggle and Collapse All */}
            <div className="flex items-center gap-4 py-1">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showActiveOnly}
                  onChange={(e) => setShowActiveOnly(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                Active categories only
              </label>
              
              <div className="flex items-center gap-2">
                {filteredData.incomeGroup && (
                  <button
                    onClick={() => setIncomeCollapsed(!incomeCollapsed)}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                  >
                    {incomeCollapsed ? 'Show Income' : 'Hide Income'}
                  </button>
                )}
                {filteredData.expenseGroups.length > 0 && (
                  <button
                    onClick={() => {
                      if (collapsedGroups.size === filteredData.expenseGroups.length) {
                        // All collapsed, so expand all
                        setCollapsedGroups(new Set());
                      } else {
                        // Some expanded, so collapse all
                        setCollapsedGroups(new Set(filteredData.expenseGroups.map(g => g.groupName)));
                      }
                    }}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                  >
                    {collapsedGroups.size === filteredData.expenseGroups.length ? 'Expand All Groups' : 'Collapse All Groups'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Income vs Expense Table */}
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-20">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-800 z-30">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Group
                  </th>
                  {monthHeaders.map(month => (
                    <th key={month.key} className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {month.label.split(' ')[0]}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Average
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {/* Income Section */}
                {filteredData.incomeGroup && (
                  <>
                    {/* Income header row */}
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-900 z-10">
                        <span className="uppercase text-xs tracking-wider">Income</span>
                      </td>
                      <td colSpan={monthHeaders.length + 3} className="px-4 py-3"></td>
                    </tr>
                    <GroupHeaderRow 
                      group={filteredData.incomeGroup}
                      monthHeaders={monthHeaders}
                      privacyMode={privacyMode}
                      isIncome={true}
                      isCollapsed={incomeCollapsed}
                      onToggle={() => setIncomeCollapsed(!incomeCollapsed)}
                    />
                    {!incomeCollapsed && filteredData.incomeGroup.categories.map((item, index) => (
                      <CategoryRow 
                        key={`income-${item.category}-${index}`}
                        item={item}
                        monthHeaders={monthHeaders}
                        privacyMode={privacyMode}
                        isIncome={true}
                        isGrouped={true}
                      />
                    ))}
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-900 z-10">Total Income</td>
                      <td className="px-4 py-3"></td>
                      {monthHeaders.map(month => (
                        <td key={`income-total-${month.key}`} className={`px-3 py-3 text-sm text-right font-medium text-green-600 dark:text-green-400 ${privacyMode ? 'privacy-blur' : ''}`}>
                          {formatCurrency(filteredData.incomeGroup.monthlyIncomeTotals[month.key] || 0)}
                        </td>
                      ))}
                      <td className={`px-3 py-3 text-sm text-right font-medium text-green-600 dark:text-green-400 ${privacyMode ? 'privacy-blur' : ''}`}>
                        {formatCurrency(filteredData.incomeGroup.groupAverageIncome)}
                      </td>
                      <td className={`px-3 py-3 text-sm text-right font-medium text-green-600 dark:text-green-400 ${privacyMode ? 'privacy-blur' : ''}`}>
                        {formatCurrency(filteredData.incomeGroup.groupTotalIncome)}
                      </td>
                    </tr>
                  </>
                )}
                
                {/* Spacer row between income and expenses */}
                {filteredData.incomeGroup && filteredData.expenseGroups.length > 0 && (
                  <tr className="h-4">
                    <td colSpan={monthHeaders.length + 4}></td>
                  </tr>
                )}
                
                {/* Expense Section */}
                {filteredData.expenseGroups.length > 0 && (
                  <>
                    {/* Expense header row */}
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-900 z-10">
                        <span className="uppercase text-xs tracking-wider">Expenses</span>
                      </td>
                      <td colSpan={monthHeaders.length + 3} className="px-4 py-3"></td>
                    </tr>
                    {filteredData.expenseGroups.map((group, groupIndex) => {
                      const isCollapsed = collapsedGroups.has(group.groupName);
                      return (
                        <Fragment key={`expense-group-${group.groupName}`}>
                          <GroupHeaderRow 
                            group={group}
                            monthHeaders={monthHeaders}
                            privacyMode={privacyMode}
                            isIncome={false}
                            isCollapsed={isCollapsed}
                            onToggle={() => toggleGroupCollapse(group.groupName)}
                          />
                          {!isCollapsed && group.categories.map((item, index) => (
                            <CategoryRow 
                              key={`expense-${group.groupName}-${item.category}-${index}`}
                              item={item}
                              monthHeaders={monthHeaders}
                              privacyMode={privacyMode}
                              isIncome={false}
                            />
                          ))}
                          {/* Add spacing between groups */}
                          {groupIndex < filteredData.expenseGroups.length - 1 && (
                            <tr className="h-2">
                              <td colSpan={monthHeaders.length + 4}></td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </>
                )}

                {!filteredData.incomeGroup && filteredData.expenseGroups.length === 0 && (
                  <tr>
                    <td colSpan={monthHeaders.length + 4} className="px-4 py-8 text-center">
                      <div className="text-gray-500 dark:text-gray-400">
                        <ListBulletIcon className="mx-auto h-12 w-12 mb-4" />
                        <p className="text-sm">
                          {searchQuery ? "No categories match your search" : "No category data available"}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Grand Totals - integrated into the main table */}
                {(filteredData.incomeGroup || filteredData.expenseGroups.length > 0) && (
                  <>
                    {/* Separator before totals */}
                    <tr className="h-8">
                      <td colSpan={monthHeaders.length + 4}></td>
                    </tr>
                    
                    {/* Total Inflows */}
                    <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-900 z-10">
                        Total Inflows
                      </td>
                      <td className="px-4 py-3"></td>
                      {monthHeaders.map(month => (
                        <td key={`income-total-${month.key}`} className={`px-3 py-3 text-sm text-right font-medium text-green-600 dark:text-green-400 ${privacyMode ? 'privacy-blur' : ''}`}>
                          {formatCurrency(monthlySummaryTotals[month.key]?.income || 0)}
                        </td>
                      ))}
                      <td className={`px-3 py-3 text-sm text-right font-medium text-green-600 dark:text-green-400 ${privacyMode ? 'privacy-blur' : ''}`}>
                        {formatCurrency(grandTotals.income / (monthHeaders.length || 1))}
                      </td>
                      <td className={`px-3 py-3 text-sm text-right font-medium text-green-600 dark:text-green-400 ${privacyMode ? 'privacy-blur' : ''}`}>
                        {formatCurrency(grandTotals.income)}
                      </td>
                    </tr>
                    
                    {/* Total Outflows */}
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-900 z-10">
                        Total Outflows
                      </td>
                      <td className="px-4 py-3"></td>
                      {monthHeaders.map(month => (
                        <td key={`expense-total-${month.key}`} className={`px-3 py-3 text-sm text-right font-medium text-red-600 dark:text-red-400 ${privacyMode ? 'privacy-blur' : ''}`}>
                          {formatCurrency(monthlySummaryTotals[month.key]?.expenses || 0)}
                        </td>
                      ))}
                      <td className={`px-3 py-3 text-sm text-right font-medium text-red-600 dark:text-red-400 ${privacyMode ? 'privacy-blur' : ''}`}>
                        {formatCurrency(grandTotals.expenses / (monthHeaders.length || 1))}
                      </td>
                      <td className={`px-3 py-3 text-sm text-right font-medium text-red-600 dark:text-red-400 ${privacyMode ? 'privacy-blur' : ''}`}>
                        {formatCurrency(grandTotals.expenses)}
                      </td>
                    </tr>
                    
                    {/* Net Income */}
                    <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                      <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-900 z-10">
                        Net Income
                      </td>
                      <td className="px-4 py-3"></td>
                      {monthHeaders.map(month => {
                        const netValue = monthlySummaryTotals[month.key]?.net || 0;
                        return (
                          <td key={`net-total-${month.key}`} className={`px-3 py-3 text-sm text-right font-bold ${
                            netValue >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          } ${privacyMode ? 'privacy-blur' : ''}`}>
                            {formatCurrency(netValue)}
                          </td>
                        );
                      })}
                      <td className={`px-3 py-3 text-sm text-right font-bold ${
                        grandTotals.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      } ${privacyMode ? 'privacy-blur' : ''}`}>
                        {formatCurrency(grandTotals.net / (monthHeaders.length || 1))}
                      </td>
                      <td className={`px-3 py-3 text-sm text-right font-bold ${
                        grandTotals.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      } ${privacyMode ? 'privacy-blur' : ''}`}>
                        {formatCurrency(grandTotals.net)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </Card>


      </div>
    </PageTransition>
  );
}
