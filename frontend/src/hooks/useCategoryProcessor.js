import { useMemo } from 'react';
import { getTransactionAmount } from '../utils/ynabHelpers';
import { YNAB_INCOME_CATEGORIES, DEBT_PAYMENT_CATEGORIES } from './useTransactionProcessor';

/**
 * Process transactions into category groups for the Balance Sheet
 */
export function useCategoryProcessor(
  transactions,
  categoryIdToGroupInfoMap,
  investmentAccountIds,
  periodMonths = 12,
  showActiveOnly = true
) {
  return useMemo(() => {
    if (!transactions?.length || !categoryIdToGroupInfoMap?.size) {
      return {
        processedCategoryGroups: [],
        monthHeaders: [],
        grandTotals: { income: 0, expenses: 0, net: 0 },
        monthlySummaryTotals: {}
      };
    }

    // Calculate actual period months
    const actualPeriodMonths = periodMonths === 999 ? 
      Math.max(1, Math.ceil((Date.now() - Math.min(...transactions.map(t => 
        new Date(t.date).getTime()
      ).filter(d => !isNaN(d)))) / (1000 * 60 * 60 * 24 * 30.4375))) 
      : periodMonths;

    // Generate month headers
    const monthHeaders = [];
    const today = new Date();
    for (let i = actualPeriodMonths - 1; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = date.toISOString().slice(0, 7);
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthHeaders.push({ key: monthKey, label: monthLabel });
    }

    // Initialize data structures
    const categoryGroupDataMap = {};
    const monthlySummaryTotals = monthHeaders.reduce((acc, mh) => {
      acc[mh.key] = { income: 0, expenses: 0, net: 0 };
      return acc;
    }, {});

    // Process single transaction
    const processSingleTransaction = (txn, accountId) => {
      // Skip investment accounts
      if (investmentAccountIds?.has(accountId)) return;

      // Skip internal transfers between budget accounts (but keep transfers to/from tracking accounts)
      // This ensures we capture income transfers from tracking investment accounts
      const isInternalTransfer = txn.transfer_account_id && 
        txn.transfer_account_id !== 'null' && 
        !investmentAccountIds?.has(txn.transfer_account_id);
      
      if (isInternalTransfer) return;
      
      // Skip reconciliation transactions
      if (txn.payee_name === 'Reconciliation Balance Adjustment' || 
          txn.payee_name === 'Starting Balance') return;

      // Validate date
      if (!txn.date || isNaN(new Date(txn.date).getTime())) return;

      const transactionDate = new Date(txn.date);
      const monthKey = transactionDate.toISOString().slice(0, 7);

      // Skip if outside period
      if (!monthHeaders.find(mh => mh.key === monthKey)) return;

      const rawAmount = getTransactionAmount(txn);
      const groupInfo = categoryIdToGroupInfoMap.get(txn.category_id);
      const categoryName = groupInfo?.categoryName || txn.category_name || 'Uncategorized';
      let groupName = groupInfo?.groupName;

      // Determine if this is an income transaction
      // In YNAB, income is typically:
      // 1. Categorized as "Inflow: Ready to Assign" or similar
      // 2. Has no category (uncategorized income shows as payee names)
      // 3. Positive amounts to "Ready to Assign" or "To be Budgeted"
      const isIncomeGroup = groupName && (
        groupName.toLowerCase().includes('income') ||
        groupName.toLowerCase().includes('inflow') ||
        groupName === 'Inflow' ||
        groupName === 'Ready to Assign' ||
        groupName === 'To be Budgeted'
      );
      const isIncomeCategory = (
        !categoryName || // No category often means income
        categoryName === 'Uncategorized' ||
        categoryName.toLowerCase().includes('inflow') ||
        categoryName.toLowerCase().includes('ready to assign') ||
        categoryName.toLowerCase().includes('to be budgeted') ||
        categoryName === 'Ready to Assign' ||
        categoryName === 'To be Budgeted' ||
        categoryName === 'Deferred Income SubCategory' ||
        YNAB_INCOME_CATEGORIES.includes(categoryName)
      );
      // Income is positive amount with income category or no category at all
      const isIncome = rawAmount > 0 && (isIncomeGroup || isIncomeCategory);

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

      // Accumulate amounts
      if (isIncome) {
        currentCategory.monthlyData[monthKey].income += rawAmount;
        currentCategory.totalIncome += rawAmount;
        currentGroup.groupMonthlyIncome[monthKey] += rawAmount;
        currentGroup.groupTotalIncome += rawAmount;
        monthlySummaryTotals[monthKey].income += rawAmount;
      } else {
        // For expenses: negative amounts are outflows, positive amounts are refunds
        if (rawAmount < 0) {
          // Normal expense (outflow)
          const expenseAmount = Math.abs(rawAmount);
          currentCategory.monthlyData[monthKey].expense += expenseAmount;
          currentCategory.totalExpense += expenseAmount;
          currentGroup.groupMonthlyExpense[monthKey] += expenseAmount;
          currentGroup.groupTotalExpense += expenseAmount;
          monthlySummaryTotals[monthKey].expenses += expenseAmount;
        } else if (rawAmount > 0) {
          // Refund/return - reduces expenses
          currentCategory.monthlyData[monthKey].expense -= rawAmount;
          currentCategory.totalExpense -= rawAmount;
          currentGroup.groupMonthlyExpense[monthKey] -= rawAmount;
          currentGroup.groupTotalExpense -= rawAmount;
          monthlySummaryTotals[monthKey].expenses -= rawAmount;
        }
      }
    };

    // Process all transactions
    transactions.forEach(transaction => {
      if (transaction.subtransactions?.length > 0) {
        transaction.subtransactions.forEach(subTxn => {
          processSingleTransaction({
            ...subTxn,
            payee_name: subTxn.payee_name || transaction.payee_name,
            date: transaction.date,
            category_id: subTxn.category_id || transaction.category_id,
            category_name: subTxn.category_name || transaction.category_name,
            transfer_account_id: subTxn.transfer_account_id || transaction.transfer_account_id
          }, transaction.account_id);
        });
      } else {
        processSingleTransaction(transaction, transaction.account_id);
      }
    });

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
        grandTotalIncome += group.groupTotalIncome;
        grandTotalExpenses += group.groupTotalExpense;

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
    investmentAccountIds, 
    periodMonths, 
    showActiveOnly
  ]);
}
