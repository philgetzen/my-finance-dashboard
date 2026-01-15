import React, { useState, useMemo, useCallback, Fragment } from 'react';
import { useFinanceData } from '../../contexts/ConsolidatedDataContext';
import { usePrivacy } from '../../contexts/ConsolidatedDataContext';
import PageTransition from '../ui/PageTransition';
import Card from '../ui/Card';
import { normalizeYNABAccountType } from '../../utils/ynabHelpers';
import { formatCurrency } from '../../utils/formatters';
import { useCategoryProcessor } from '../../hooks/useCategoryProcessor';
import {
  ListBulletIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';

// Summary metric card component
const MetricCard = ({ title, value, subtitle, icon: Icon, colorClass, privacyMode }) => (
  <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
    <div className={`p-3 rounded-lg ${colorClass}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <p className={`text-xl font-bold text-gray-900 dark:text-white ${privacyMode ? 'privacy-blur' : ''}`}>
        ${formatCurrency(value)}
      </p>
      {subtitle && (
        <p className={`text-xs text-gray-500 dark:text-gray-400 ${privacyMode ? 'privacy-blur' : ''}`}>
          {subtitle}
        </p>
      )}
    </div>
  </div>
);

// Category row component - cleaner design
const CategoryRow = React.memo(({ item, monthHeaders, privacyMode, isIncome, depth = 0 }) => {
  const displayValue = isIncome ? item.totalIncome : item.totalExpense;
  const avgValue = isIncome ? item.averageIncome : item.averageExpense;

  return (
    <tr className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <td className="py-2.5 pl-4 pr-4 sm:sticky sm:left-0 bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800/50 transition-colors sm:z-10 min-w-[140px] sm:min-w-[180px]">
        <span
          className="text-sm text-gray-700 dark:text-gray-300"
          style={{ paddingLeft: `${depth * 16}px` }}
        >
          {item.category}
        </span>
      </td>
      {monthHeaders.map(month => {
        const val = isIncome
          ? (item.monthlyData[month.key]?.income || 0)
          : (item.monthlyData[month.key]?.expense || 0);
        const isEmpty = Math.abs(val) < 0.01;
        return (
          <td
            key={month.key}
            className={`py-2.5 px-2 text-right text-sm tabular-nums ${
              isEmpty ? 'text-gray-300 dark:text-gray-700'
              : isIncome ? 'text-green-600 dark:text-green-400'
              : 'text-gray-600 dark:text-gray-400'
            } ${privacyMode ? 'privacy-blur' : ''}`}
          >
            {isEmpty ? '-' : formatCurrency(val)}
          </td>
        );
      })}
      <td className={`py-2.5 px-2 text-right text-sm tabular-nums font-medium ${
        isIncome ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'
      } ${privacyMode ? 'privacy-blur' : ''}`}>
        {formatCurrency(avgValue)}
      </td>
      <td className={`py-2.5 px-4 text-right text-sm tabular-nums font-semibold ${
        isIncome ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'
      } ${privacyMode ? 'privacy-blur' : ''}`}>
        {formatCurrency(displayValue)}
      </td>
    </tr>
  );
});

CategoryRow.displayName = 'CategoryRow';

// Group header row - more prominent styling
const GroupHeaderRow = React.memo(({ group, monthHeaders, privacyMode, isIncome, isCollapsed, onToggle }) => {
  const totalValue = isIncome ? group.groupTotalIncome : group.groupTotalExpense;
  const avgValue = isIncome ? group.groupAverageIncome : group.groupAverageExpense;
  const monthlyTotals = isIncome ? group.monthlyIncomeTotals : group.monthlyTotals;

  return (
    <tr
      className={`cursor-pointer transition-colors ${
        isIncome
          ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
          : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-150 dark:hover:bg-gray-750'
      }`}
      onClick={onToggle}
    >
      <td className={`py-3 pl-4 pr-4 sm:sticky sm:left-0 sm:z-10 min-w-[140px] sm:min-w-[180px] ${
        isIncome
          ? 'bg-green-50 dark:bg-green-900/20'
          : 'bg-gray-100 dark:bg-gray-800'
      }`}>
        <div className="flex items-center gap-2">
          {isCollapsed ? (
            <ChevronRightIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
          )}
          <span className={`text-sm font-semibold ${
            isIncome ? 'text-green-800 dark:text-green-300' : 'text-gray-800 dark:text-gray-200'
          }`}>
            {group.groupName}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-500">
            ({group.categories?.length || 0})
          </span>
        </div>
      </td>
      {monthHeaders.map(month => {
        const val = monthlyTotals?.[month.key] || 0;
        const isEmpty = Math.abs(val) < 0.01;
        return (
          <td
            key={month.key}
            className={`py-3 px-2 text-right text-sm tabular-nums font-medium ${
              isEmpty ? 'text-gray-400 dark:text-gray-600'
              : isIncome ? 'text-green-700 dark:text-green-400'
              : 'text-gray-700 dark:text-gray-300'
            } ${privacyMode ? 'privacy-blur' : ''}`}
          >
            {isEmpty ? '-' : formatCurrency(val)}
          </td>
        );
      })}
      <td className={`py-3 px-2 text-right text-sm tabular-nums font-semibold ${
        isIncome ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'
      } ${privacyMode ? 'privacy-blur' : ''}`}>
        {formatCurrency(avgValue)}
      </td>
      <td className={`py-3 px-4 text-right text-sm tabular-nums font-bold ${
        isIncome ? 'text-green-700 dark:text-green-400' : 'text-gray-800 dark:text-gray-200'
      } ${privacyMode ? 'privacy-blur' : ''}`}>
        {formatCurrency(totalValue)}
      </td>
    </tr>
  );
});

GroupHeaderRow.displayName = 'GroupHeaderRow';

// Section header component
const SectionHeader = ({ title, icon: Icon, colorClass }) => (
  <tr>
    <td colSpan={100} className="pt-6 pb-2 pl-4">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded ${colorClass}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          {title}
        </span>
      </div>
    </td>
  </tr>
);

// Summary row component
const SummaryRow = ({ label, monthHeaders, monthlyData, avgValue, totalValue, colorClass, isBold, privacyMode }) => (
  <tr className={isBold ? 'border-t-2 border-gray-300 dark:border-gray-600' : ''}>
    <td className={`py-3 pl-4 pr-4 sm:sticky sm:left-0 bg-white dark:bg-gray-900 sm:z-10 min-w-[140px] sm:min-w-[180px] ${
      isBold ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'
    }`}>
      <span className="text-sm">{label}</span>
    </td>
    {monthHeaders.map(month => {
      const val = monthlyData?.[month.key] || 0;
      return (
        <td
          key={month.key}
          className={`py-3 px-2 text-right text-sm tabular-nums ${isBold ? 'font-bold' : 'font-semibold'} ${colorClass} ${privacyMode ? 'privacy-blur' : ''}`}
        >
          {formatCurrency(val)}
        </td>
      );
    })}
    <td className={`py-3 px-2 text-right text-sm tabular-nums ${isBold ? 'font-bold' : 'font-semibold'} ${colorClass} ${privacyMode ? 'privacy-blur' : ''}`}>
      {formatCurrency(avgValue)}
    </td>
    <td className={`py-3 px-4 text-right text-sm tabular-nums ${isBold ? 'font-bold' : 'font-semibold'} ${colorClass} ${privacyMode ? 'privacy-blur' : ''}`}>
      {formatCurrency(totalValue)}
    </td>
  </tr>
);

export default function CashFlow() {
  const {
    accounts: ynabAccounts,
    transactions: ynabTransactions,
    categories,
    isLoading: isYnabLoading,
    error: ynabError
  } = useFinanceData();

  const { privacyMode } = usePrivacy();

  // State
  const [periodMonths, setPeriodMonths] = useState(6);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [incomeExpanded, setIncomeExpanded] = useState(true);

  // Toggle group collapse
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

  // Memoized data
  const allAccounts = useMemo(() => [...(ynabAccounts || [])], [ynabAccounts]);

  const investmentAccountIds = useMemo(() => new Set(
    allAccounts
      .filter(acc => normalizeYNABAccountType(acc.type) === 'investment')
      .map(acc => acc.id || acc.account_id)
      .filter(id => id)
  ), [allAccounts]);

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

  // Organize data
  const { incomeGroup, expenseGroups } = useMemo(() => {
    const income = [];
    const expenseByGroup = {};

    processedCategoryGroups.forEach(group => {
      if (group.isIncomeGroup) {
        group.categories.forEach(category => {
          income.push({ ...category, groupName: group.groupName });
        });
      } else {
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

        expenseByGroup[group.groupName].groupTotalExpense = group.groupTotalExpense;
        expenseByGroup[group.groupName].groupAverageExpense = group.groupAverageExpense;

        monthHeaders.forEach(month => {
          const monthTotal = group.categories.reduce((sum, cat) =>
            sum + (cat.monthlyData[month.key]?.expense || 0), 0
          );
          expenseByGroup[group.groupName].monthlyTotals[month.key] = monthTotal;
        });
      }
    });

    let totalIncome = 0;
    const monthlyIncomeTotals = monthHeaders.reduce((acc, mh) => ({...acc, [mh.key]: 0}), {});

    income.forEach(cat => {
      totalIncome += cat.totalIncome;
      monthHeaders.forEach(mh => {
        monthlyIncomeTotals[mh.key] += cat.monthlyData[mh.key]?.income || 0;
      });
    });

    const incomeGroup = income.length > 0 ? {
      groupName: 'Income Sources',
      categories: income,
      groupTotalIncome: totalIncome,
      groupAverageIncome: totalIncome / (monthHeaders.length || 1),
      monthlyIncomeTotals,
      isIncomeGroup: true
    } : null;

    return {
      incomeGroup,
      expenseGroups: Object.values(expenseByGroup)
    };
  }, [processedCategoryGroups, monthHeaders]);

  // Filter by search
  const filteredData = useMemo(() => {
    if (!searchQuery) return { incomeGroup, expenseGroups };

    const query = searchQuery.toLowerCase();

    let filteredIncomeGroup = null;
    if (incomeGroup) {
      const filtered = incomeGroup.categories.filter(cat =>
        cat.category.toLowerCase().includes(query)
      );
      if (filtered.length > 0 || incomeGroup.groupName.toLowerCase().includes(query)) {
        filteredIncomeGroup = { ...incomeGroup, categories: filtered.length > 0 ? filtered : incomeGroup.categories };
      }
    }

    const filteredExpenseGroups = expenseGroups.map(group => {
      const filtered = group.categories.filter(cat =>
        cat.category.toLowerCase().includes(query) ||
        group.groupName.toLowerCase().includes(query)
      );
      if (filtered.length === 0 && !group.groupName.toLowerCase().includes(query)) return null;
      return { ...group, categories: filtered.length > 0 ? filtered : group.categories };
    }).filter(Boolean);

    return { incomeGroup: filteredIncomeGroup, expenseGroups: filteredExpenseGroups };
  }, [incomeGroup, expenseGroups, searchQuery]);

  // Monthly summary data for charts
  const monthlyIncomeData = useMemo(() => {
    const data = {};
    monthHeaders.forEach(m => { data[m.key] = monthlySummaryTotals[m.key]?.income || 0; });
    return data;
  }, [monthHeaders, monthlySummaryTotals]);

  const monthlyExpenseData = useMemo(() => {
    const data = {};
    monthHeaders.forEach(m => { data[m.key] = monthlySummaryTotals[m.key]?.expenses || 0; });
    return data;
  }, [monthHeaders, monthlySummaryTotals]);

  const monthlyNetData = useMemo(() => {
    const data = {};
    monthHeaders.forEach(m => { data[m.key] = monthlySummaryTotals[m.key]?.net || 0; });
    return data;
  }, [monthHeaders, monthlySummaryTotals]);

  // Loading state
  if (isYnabLoading && !ynabTransactions?.length) {
    return (
      <PageTransition>
        <div className="w-full max-w-none space-y-6 pb-4">
          <div className="animate-pulse space-y-4">
            <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
              <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
              <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            </div>
            <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
          </div>
        </div>
      </PageTransition>
    );
  }

  const numMonths = monthHeaders.length || 1;

  return (
    <PageTransition>
      <div className="w-full max-w-none space-y-5 pb-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Spending</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {ynabError ? (
                <span className="text-red-600">Error: {ynabError.message}</span>
              ) : (
                <>Income and expenses by category</>
              )}
            </p>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-5 w-5 text-gray-400" />
            <select
              value={periodMonths}
              onChange={(e) => setPeriodMonths(Number(e.target.value))}
              className="text-sm rounded-lg px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value={3}>Last 3 Months</option>
              <option value={6}>Last 6 Months</option>
              <option value={12}>Last 12 Months</option>
              <option value={24}>Last 24 Months</option>
              <option value={999}>All Time</option>
            </select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            title="Total Income"
            value={grandTotals.income}
            subtitle={`$${formatCurrency(grandTotals.income / numMonths)} avg/mo`}
            icon={ArrowTrendingUpIcon}
            colorClass="bg-green-500"
            privacyMode={privacyMode}
          />
          <MetricCard
            title="Total Expenses"
            value={grandTotals.expenses}
            subtitle={`$${formatCurrency(grandTotals.expenses / numMonths)} avg/mo`}
            icon={ArrowTrendingDownIcon}
            colorClass="bg-red-500"
            privacyMode={privacyMode}
          />
          <MetricCard
            title="Net Savings"
            value={grandTotals.net}
            subtitle={`$${formatCurrency(grandTotals.net / numMonths)} avg/mo`}
            icon={BanknotesIcon}
            colorClass={grandTotals.net >= 0 ? 'bg-blue-500' : 'bg-orange-500'}
            privacyMode={privacyMode}
          />
        </div>

        {/* Controls */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px] max-w-md">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Toggles */}
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Active only
            </label>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const allExpenseCollapsed = collapsedGroups.size === filteredData.expenseGroups.length;
                  const allCollapsed = allExpenseCollapsed && !incomeExpanded;

                  if (allCollapsed) {
                    // Expand all
                    setCollapsedGroups(new Set());
                    setIncomeExpanded(true);
                  } else {
                    // Collapse all
                    setCollapsedGroups(new Set(filteredData.expenseGroups.map(g => g.groupName)));
                    setIncomeExpanded(false);
                  }
                }}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {collapsedGroups.size === filteredData.expenseGroups.length && !incomeExpanded ? 'Expand All' : 'Collapse All'}
              </button>
            </div>
          </div>
        </Card>

        {/* Main Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <th className="py-3 pl-4 pr-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider sm:sticky sm:left-0 bg-gray-50 dark:bg-gray-800/50 sm:z-20 min-w-[140px] sm:min-w-[180px]">
                    Category
                  </th>
                  {monthHeaders.map(month => (
                    <th key={month.key} className="py-3 px-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {month.label.split(' ')[0]}
                    </th>
                  ))}
                  <th className="py-3 px-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Avg
                  </th>
                  <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900">
                {/* Income Section */}
                {filteredData.incomeGroup && (
                  <>
                    <SectionHeader
                      title="Income"
                      icon={ArrowTrendingUpIcon}
                      colorClass="bg-green-500"
                    />
                    <GroupHeaderRow
                      group={filteredData.incomeGroup}
                      monthHeaders={monthHeaders}
                      privacyMode={privacyMode}
                      isIncome={true}
                      isCollapsed={!incomeExpanded}
                      onToggle={() => setIncomeExpanded(!incomeExpanded)}
                    />
                    {incomeExpanded && filteredData.incomeGroup.categories.map((item, idx) => (
                      <CategoryRow
                        key={`income-${item.category}-${idx}`}
                        item={item}
                        monthHeaders={monthHeaders}
                        privacyMode={privacyMode}
                        isIncome={true}
                        depth={1}
                      />
                    ))}
                  </>
                )}

                {/* Expenses Section */}
                {filteredData.expenseGroups.length > 0 && (
                  <>
                    <SectionHeader
                      title="Expenses"
                      icon={ArrowTrendingDownIcon}
                      colorClass="bg-red-500"
                    />
                    {filteredData.expenseGroups.map((group) => {
                      const isCollapsed = collapsedGroups.has(group.groupName);
                      return (
                        <Fragment key={group.groupName}>
                          <GroupHeaderRow
                            group={group}
                            monthHeaders={monthHeaders}
                            privacyMode={privacyMode}
                            isIncome={false}
                            isCollapsed={isCollapsed}
                            onToggle={() => toggleGroupCollapse(group.groupName)}
                          />
                          {!isCollapsed && group.categories.map((item, idx) => (
                            <CategoryRow
                              key={`expense-${group.groupName}-${item.category}-${idx}`}
                              item={item}
                              monthHeaders={monthHeaders}
                              privacyMode={privacyMode}
                              isIncome={false}
                              depth={1}
                            />
                          ))}
                        </Fragment>
                      );
                    })}
                  </>
                )}

                {/* Empty state */}
                {!filteredData.incomeGroup && filteredData.expenseGroups.length === 0 && (
                  <tr>
                    <td colSpan={monthHeaders.length + 3} className="py-12 text-center">
                      <ListBulletIcon className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {searchQuery ? 'No categories match your search' : 'No data available'}
                      </p>
                    </td>
                  </tr>
                )}

                {/* Summary Section */}
                {(filteredData.incomeGroup || filteredData.expenseGroups.length > 0) && (
                  <>
                    <tr>
                      <td colSpan={monthHeaders.length + 3} className="py-4"></td>
                    </tr>
                    <SummaryRow
                      label="Total Income"
                      monthHeaders={monthHeaders}
                      monthlyData={monthlyIncomeData}
                      avgValue={grandTotals.income / numMonths}
                      totalValue={grandTotals.income}
                      colorClass="text-green-600 dark:text-green-400"
                      privacyMode={privacyMode}
                    />
                    <SummaryRow
                      label="Total Expenses"
                      monthHeaders={monthHeaders}
                      monthlyData={monthlyExpenseData}
                      avgValue={grandTotals.expenses / numMonths}
                      totalValue={grandTotals.expenses}
                      colorClass="text-red-600 dark:text-red-400"
                      privacyMode={privacyMode}
                    />
                    <SummaryRow
                      label="Net Savings"
                      monthHeaders={monthHeaders}
                      monthlyData={monthlyNetData}
                      avgValue={grandTotals.net / numMonths}
                      totalValue={grandTotals.net}
                      colorClass={grandTotals.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
                      isBold={true}
                      privacyMode={privacyMode}
                    />
                  </>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Transaction count footer */}
        {ynabTransactions?.length > 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
            Based on {ynabTransactions.length.toLocaleString()} transactions
          </p>
        )}
      </div>
    </PageTransition>
  );
}
