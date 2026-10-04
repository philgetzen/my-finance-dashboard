import { useMemo } from 'react';
import {
  INCOME_CATEGORIES,
  DEBT_PAYMENT_CATEGORIES,
  SAVINGS_INVESTMENT_CATEGORIES,
} from '../utils/calculations/constants';
import { classifyTransactions, summarizeLines, toMonthKey } from '../utils/calculations/cashflow';

// Re-export for backward compatibility (aliased to match old name)
export const YNAB_INCOME_CATEGORIES = INCOME_CATEGORIES;
export { DEBT_PAYMENT_CATEGORIES, SAVINGS_INVESTMENT_CATEGORIES };

// Line kinds that represent cash flow worth showing
const CASH_FLOW_KINDS = new Set(['income', 'spending', 'investing', 'saving', 'uncategorized']);

/**
 * Custom hook for processing transaction data
 * Centralizes all transaction processing logic to avoid duplication.
 *
 * Income and spending follow the shared rules in utils/calculations/cashflow.js:
 * investing is tracked separately (it is not spending), debt payments count as
 * spending, tracking-account activity and uncategorized transactions are not
 * counted, and refunds reduce spending.
 *
 * @param {Array} transactions - YNAB transactions
 * @param {Array} accounts - Accounts (needs id, type, on_budget)
 * @param {Set} _investmentAccountIds - Unused; investment accounts are detected from `accounts`
 * @param {Object} [options] - { categories, cspSettings } for CSP bucket mappings and exclusions
 */
export function useTransactionProcessor(transactions, accounts, _investmentAccountIds, options = {}) {
  const { categories = null, cspSettings = null } = options;
  const {
    categoryMappings,
    excludedPayees,
    excludedCategories,
    excludedExpenseCategories,
    settings
  } = cspSettings || {};

  return useMemo(() => {
    if (!transactions?.length) {
      return {
        processedTransactions: [],
        monthlyData: {},
        totals: { income: 0, expenses: 0, net: 0, investing: 0 }
      };
    }

    const lines = classifyTransactions(transactions, {
      accounts: accounts || [],
      categories,
      cspSettings: { categoryMappings, excludedPayees, excludedCategories, excludedExpenseCategories, settings }
    });

    const processedTransactions = lines
      .filter(line => CASH_FLOW_KINDS.has(line.kind))
      .map(line => ({
        ...line,
        processedAmount: line.amountDollars,
        isIncome: line.kind === 'income'
      }));

    // Group by month, then summarize each month
    const linesByMonth = new Map();
    processedTransactions.forEach(line => {
      if (!linesByMonth.has(line.monthKey)) linesByMonth.set(line.monthKey, []);
      linesByMonth.get(line.monthKey).push(line);
    });

    const monthlyData = {};
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalInvesting = 0;

    linesByMonth.forEach((monthLines, monthKey) => {
      const summary = summarizeLines(monthLines);
      const byBucket = { fixedCosts: 0, savings: 0, guiltFree: 0 };
      summary.byCategory.forEach(cat => {
        // Spending lines are fixedCosts, savings or guiltFree; a null bucket
        // (no category info) defaults to guilt-free like everywhere else
        const bucket = cat.bucket in byBucket ? cat.bucket : 'guiltFree';
        byBucket[bucket] += cat.amount;
      });
      monthlyData[monthKey] = {
        income: summary.income,
        expenses: summary.spending,
        expensesByBucket: byBucket,
        investing: summary.investing + summary.saving,
        uncategorized: summary.uncategorized.outflow,
        net: summary.net
      };
      totalIncome += summary.income;
      totalExpenses += summary.spending;
      totalInvesting += summary.investing + summary.saving;
    });

    return {
      processedTransactions,
      monthlyData,
      totals: {
        income: totalIncome,
        expenses: totalExpenses,
        net: totalIncome - totalExpenses,
        investing: totalInvesting
      }
    };
  }, [transactions, accounts, categories, categoryMappings, excludedPayees, excludedCategories, excludedExpenseCategories, settings]);
}

/**
 * Get monthly summary data for a specific time range
 * @param {Object} monthlyData - Map of 'YYYY-MM' -> { income, expenses, net }
 * @param {number} months - Number of months, ending with the current month
 * @param {Object} [options] - { completeOnly: true } to end with last month instead
 */
export function getMonthlyRangeData(monthlyData, months = 6, { completeOnly = false } = {}) {
  const result = [];
  const today = new Date();
  const offset = completeOnly ? 1 : 0;

  for (let i = months - 1 + offset; i >= offset; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthKey = toMonthKey(date);
    const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    result.push({
      monthKey,
      monthName,
      ...(monthlyData[monthKey] || { income: 0, expenses: 0, net: 0 })
    });
  }

  return result;
}
