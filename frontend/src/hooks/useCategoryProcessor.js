import { useMemo } from 'react';
import { classifyTransactions, toMonthKey } from '../utils/calculations/cashflow';

// Investing moves money into your own accounts. It's shown for reference but
// isn't counted as an expense.
export const INVESTING_GROUP_NAME = 'Investing & Saving (not spending)';

/**
 * Process transactions into category groups for the Balance Sheet
 * Income and spending follow the shared rules in utils/calculations/cashflow.js.
 * @param {Object} [options] - { accounts, categories, cspSettings } for classification
 */
export function useCategoryProcessor(
  transactions,
  categoryIdToGroupInfoMap,
  investmentAccountIds,
  periodMonths = 12,
  showActiveOnly = true,
  options = {}
) {
  const { accounts = [], categories = null, cspSettings = null } = options;

  return useMemo(() => {
    if (!transactions?.length || !categoryIdToGroupInfoMap?.size) {
      return {
        processedCategoryGroups: [],
        monthHeaders: [],
        grandTotals: { income: 0, expenses: 0, net: 0 },
        monthlySummaryTotals: {}
      };
    }

    const lines = classifyTransactions(transactions, {
      accounts,
      categories,
      cspSettings: cspSettings || {}
    }).filter(line => ['income', 'spending', 'investing', 'saving', 'uncategorized'].includes(line.kind));

    const accountNames = new Map(accounts.map(acc => [acc.id, acc.name]));

    // Calendar months from the selected start (or first transaction) through this month
    const today = new Date();
    const firstDate = lines.reduce((min, line) => (line.date && line.date < min ? line.date : min), toMonthKey(today));
    const firstMonthIndex = Number(firstDate.slice(0, 4)) * 12 + Number(firstDate.slice(5, 7)) - 1;
    const currentMonthIndex = today.getFullYear() * 12 + today.getMonth();
    const monthsOfData = Math.max(1, currentMonthIndex - firstMonthIndex + 1);
    const actualPeriodMonths = periodMonths === 999 ? monthsOfData : Math.min(periodMonths, monthsOfData);

    // Generate month headers
    const monthHeaders = [];
    for (let i = actualPeriodMonths - 1; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = toMonthKey(date);
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthHeaders.push({ key: monthKey, label: monthLabel });
    }
    const monthKeys = new Set(monthHeaders.map(mh => mh.key));

    // Initialize data structures
    const categoryGroupDataMap = {};
    const monthlySummaryTotals = monthHeaders.reduce((acc, mh) => {
      acc[mh.key] = { income: 0, expenses: 0, net: 0 };
      return acc;
    }, {});

    // Process single classified line
    const processSingleTransaction = (txn) => {
      const monthKey = txn.monthKey;
      if (!monthKeys.has(monthKey)) return;

      const groupInfo = categoryIdToGroupInfoMap.get(txn.category_id);
      const isIncome = txn.kind === 'income';
      const isInvesting = txn.kind === 'investing' || txn.kind === 'saving';
      // A payroll contribution is an inflow to the investment account itself
      const isPayrollContribution = txn.kind === 'investing' && txn.payroll;
      const rawAmount = isPayrollContribution ? -txn.amountDollars : txn.amountDollars;
      const categoryName = isPayrollContribution
        ? `${accountNames.get(txn.account_id) || 'Payroll'} contributions`
        : groupInfo?.categoryName || txn.category_name || (isInvesting && txn.payee_name) || 'Uncategorized';
      let groupName = isInvesting
        ? INVESTING_GROUP_NAME
        : txn.kind === 'uncategorized' ? 'Uncategorized' : groupInfo?.groupName;

      // For income transactions, use payee name to show individual sources
      let displayCategoryName = categoryName;
      if (isIncome && rawAmount > 0) {
        // For income, always prefer payee name for better visibility
        // This matches how YNAB shows income sources in their report
        displayCategoryName = txn.payee_name || categoryName || 'Other Income';
        
        // Clean up common payee name patterns
        if (displayCategoryName.includes(' ACH ')) {
          displayCategoryName = displayCategoryName.replace(/ ACH /g, ' ');
        }
        if (displayCategoryName.includes(' Deposit')) {
          displayCategoryName = displayCategoryName.replace(/ Deposit/g, '');
        }
      }
      
      // Create a unique key for storing in the categories map
      // For income, use payee name to ensure each source gets its own line
      const categoryKey = isIncome ? displayCategoryName : categoryName;

      // Assign group name
      if (!groupName) {
        groupName = isIncome ? 'Income Sources' : 'Uncategorized Expenses';
      }

      // Initialize group if needed
      if (!categoryGroupDataMap[groupName]) {
        categoryGroupDataMap[groupName] = {
          groupName,
          categories: {},
          groupMonthlyIncome: monthHeaders.reduce((acc, mh) => ({...acc, [mh.key]: 0}), {}),
          groupMonthlyExpense: monthHeaders.reduce((acc, mh) => ({...acc, [mh.key]: 0}), {}),
          groupTotalIncome: 0,
          groupTotalExpense: 0,
        };
      }
      
      const currentGroup = categoryGroupDataMap[groupName];

      // Initialize category if needed
      if (!currentGroup.categories[categoryKey]) {
        currentGroup.categories[categoryKey] = {
          category: displayCategoryName,
          monthlyData: monthHeaders.reduce((acc, mh) => ({
            ...acc, 
            [mh.key]: { income: 0, expense: 0 }
          }), {}),
          totalIncome: 0,
          totalExpense: 0,
          type: isIncome ? 'income' : 'expense'
        };
      }

      const currentCategory = currentGroup.categories[categoryKey];

      // Accumulate amounts. Income is signed (a clawback reduces it); for
      // expenses, outflows add and refunds subtract.
      const countsAsExpense = !isIncome && txn.kind === 'spending';
      if (isIncome) {
        currentCategory.monthlyData[monthKey].income += rawAmount;
        currentCategory.totalIncome += rawAmount;
        currentGroup.groupMonthlyIncome[monthKey] += rawAmount;
        currentGroup.groupTotalIncome += rawAmount;
        monthlySummaryTotals[monthKey].income += rawAmount;
      } else {
        const expenseAmount = -rawAmount;
        currentCategory.monthlyData[monthKey].expense += expenseAmount;
        currentCategory.totalExpense += expenseAmount;
        currentGroup.groupMonthlyExpense[monthKey] += expenseAmount;
        currentGroup.groupTotalExpense += expenseAmount;
        if (countsAsExpense) {
          monthlySummaryTotals[monthKey].expenses += expenseAmount;
        }
      }
    };

    lines.forEach(processSingleTransaction);

    // Calculate totals and prepare final data
    let grandTotalIncome = 0;
    let grandTotalExpenses = 0;

    const finalCategoryGroups = Object.values(categoryGroupDataMap)
      .map(group => {
        // Process categories
        const categories = Object.values(group.categories).map(cat => {
          const catTotalNet = cat.totalIncome - cat.totalExpense;
          return {
            ...cat,
            totalNet: catTotalNet,
            averageIncome: cat.totalIncome / actualPeriodMonths,
            averageExpense: cat.totalExpense / actualPeriodMonths,
            averageNet: catTotalNet / actualPeriodMonths,
          };
        }).filter(cat => !showActiveOnly || 
          (Math.abs(cat.totalIncome) >= 0.01 || Math.abs(cat.totalExpense) >= 0.01));

        const groupTotalNet = group.groupTotalIncome - group.groupTotalExpense;
        const isExcludedGroup = group.groupName === INVESTING_GROUP_NAME || group.groupName === 'Uncategorized';
        grandTotalIncome += group.groupTotalIncome;
        if (!isExcludedGroup) grandTotalExpenses += group.groupTotalExpense;

        const isIncomeGroup = group.groupTotalIncome > 0.01 &&
          group.groupTotalIncome > group.groupTotalExpense * 0.9; // More lenient check for income groups

        return {
          ...group,
          categories,
          groupTotalNet,
          groupAverageIncome: group.groupTotalIncome / actualPeriodMonths,
          groupAverageExpense: group.groupTotalExpense / actualPeriodMonths,
          groupAverageNet: groupTotalNet / actualPeriodMonths,
          isIncomeGroup,
        };
      })
      .filter(group => group.categories.length > 0 || 
        (!showActiveOnly || (Math.abs(group.groupTotalIncome) >= 0.01 || 
          Math.abs(group.groupTotalExpense) >= 0.01)))
      .sort((a, b) => {
        if (a.isIncomeGroup && !b.isIncomeGroup) return -1;
        if (b.isIncomeGroup && !a.isIncomeGroup) return 1;
        return a.groupName.localeCompare(b.groupName);
      });

    // Calculate net for each month
    monthHeaders.forEach(mh => {
      monthlySummaryTotals[mh.key].net = 
        monthlySummaryTotals[mh.key].income - monthlySummaryTotals[mh.key].expenses;
    });

    // Debug logging for totals (kept active to help diagnose calculation issues)
    if (monthHeaders.length > 0) {
      console.log('=== YNAB Income vs Expense Debug ===');
      console.log('Period:', monthHeaders[0]?.label, 'to', monthHeaders[monthHeaders.length - 1]?.label);
      console.log('\nMonthly Totals:');
      monthHeaders.forEach(mh => {
        console.log(`  ${mh.label}: Income: ${monthlySummaryTotals[mh.key].income.toFixed(2)}, Expenses: -${monthlySummaryTotals[mh.key].expenses.toFixed(2)}`);
      });
      console.log(`\nGrand Totals - Income: ${grandTotalIncome.toFixed(2)}, Expenses: -${grandTotalExpenses.toFixed(2)}`);
      console.log('===================================');
    }

    return {
      processedCategoryGroups: finalCategoryGroups,
      monthHeaders,
      grandTotals: {
        income: grandTotalIncome,
        expenses: grandTotalExpenses,
        net: grandTotalIncome - grandTotalExpenses
      },
      monthlySummaryTotals
    };
  }, [
    transactions,
    categoryIdToGroupInfoMap,
    periodMonths,
    showActiveOnly,
    accounts,
    categories,
    cspSettings
  ]);
}
