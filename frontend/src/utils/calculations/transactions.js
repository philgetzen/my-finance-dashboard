/**
 * Transaction utility functions for financial calculations
 * These pure functions can be composed for different calculation needs
 */

import { isWithinRange, getMonthKey } from './dateRanges';
import { isIncomeCategory, shouldSkipTransaction } from './constants';

/**
 * Get the transaction amount in dollars (YNAB stores in milliunits)
 * @param {object} transaction - YNAB transaction object
 * @returns {number} - Amount in dollars (positive = inflow, negative = outflow)
 */
export function getTransactionAmount(transaction) {
  return (transaction.amount || 0) / 1000;
}

/**
 * Filter transactions by date range
 * @param {Array} transactions - Array of transactions
 * @param {Date} startDate - Start of range
 * @param {Date|null} endDate - End of range (null = up to today)
 * @returns {Array} - Filtered transactions
 */
export function filterByDateRange(transactions, startDate, endDate = null) {
  if (!transactions?.length) return [];

  return transactions.filter(txn => {
    const txnDate = new Date(txn.date);
    return isWithinRange(txnDate, startDate, endDate);
  });
}

/**
 * Filter transactions by category name(s)
 * @param {Array} transactions - Array of transactions
 * @param {string|string[]} categories - Category name or array of names
 * @returns {Array} - Filtered transactions
 */
export function filterByCategory(transactions, categories) {
  if (!transactions?.length) return [];

  const categoryList = Array.isArray(categories) ? categories : [categories];
  return transactions.filter(txn => categoryList.includes(txn.category_name));
}

/**
 * Filter transactions by type (income, expense, or all)
 * @param {Array} transactions - Array of transactions
 * @param {'income'|'expense'|'all'} type - Transaction type to filter
 * @returns {Array} - Filtered transactions
 */
export function filterByType(transactions, type) {
  if (!transactions?.length || type === 'all') return transactions || [];

  return transactions.filter(txn => {
    const isIncome = isIncomeCategory(txn.category_name);
    if (type === 'income') return isIncome;
    if (type === 'expense') return !isIncome;
    return true;
  });
}

/**
 * Exclude internal transfers between budget accounts
 * Keeps transfers to/from tracking accounts (like investments)
 * @param {Array} transactions - Array of transactions
 * @param {Set} [investmentAccountIds] - Set of investment/tracking account IDs to preserve
 * @returns {Array} - Transactions without internal transfers
 */
export function excludeTransfers(transactions, investmentAccountIds = new Set()) {
  if (!transactions?.length) return [];

  return transactions.filter(txn => {
    // No transfer account = not a transfer
    if (!txn.transfer_account_id || txn.transfer_account_id === 'null') {
      return true;
    }
    // Keep transfers to/from investment/tracking accounts
    return investmentAccountIds.has(txn.transfer_account_id);
  });
}

/**
 * Exclude transactions from investment accounts
 * @param {Array} transactions - Array of transactions
 * @param {Set} investmentAccountIds - Set of investment account IDs
 * @returns {Array} - Transactions excluding investment accounts
 */
export function excludeInvestmentAccounts(transactions, investmentAccountIds) {
  if (!transactions?.length || !investmentAccountIds?.size) return transactions || [];

  return transactions.filter(txn => !investmentAccountIds.has(txn.account_id));
}

/**
 * Exclude reconciliation and starting balance transactions
 * @param {Array} transactions - Array of transactions
 * @returns {Array} - Filtered transactions
 */
export function excludeSystemTransactions(transactions) {
  if (!transactions?.length) return [];

  return transactions.filter(txn => !shouldSkipTransaction(txn));
}

/**
 * Sum transaction amounts
 * @param {Array} transactions - Array of transactions
 * @returns {number} - Total amount in dollars
 */
export function sumTransactions(transactions) {
  if (!transactions?.length) return 0;

  return transactions.reduce((sum, txn) => {
    return sum + getTransactionAmount(txn);
  }, 0);
}

/**
 * Sum only expense transactions (outflows, excluding income)
 * Handles refunds by subtracting them from expenses
 * @param {Array} transactions - Array of transactions
 * @returns {number} - Total expenses as positive number
 */
export function sumExpenses(transactions) {
  if (!transactions?.length) return 0;

  let total = 0;
  transactions.forEach(txn => {
    const amount = getTransactionAmount(txn);
    const isIncome = isIncomeCategory(txn.category_name);

    if (!isIncome) {
      if (amount < 0) {
        // Normal expense (outflow)
        total += Math.abs(amount);
      } else if (amount > 0) {
        // Refund - reduces expenses
        total -= amount;
      }
    }
  });

  return total;
}

/**
 * Sum only income transactions
 * @param {Array} transactions - Array of transactions
 * @returns {number} - Total income as positive number
 */
export function sumIncome(transactions) {
  if (!transactions?.length) return 0;

  return transactions
    .filter(txn => isIncomeCategory(txn.category_name))
    .reduce((sum, txn) => sum + getTransactionAmount(txn), 0);
}

/**
 * Group transactions by category
 * @param {Array} transactions - Array of transactions
 * @returns {Object} - Map of category_name -> array of transactions
 */
export function groupByCategory(transactions) {
  if (!transactions?.length) return {};

  return transactions.reduce((groups, txn) => {
    const category = txn.category_name || 'Uncategorized';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(txn);
    return groups;
  }, {});
}

/**
 * Group transactions by month
 * @param {Array} transactions - Array of transactions
 * @returns {Object} - Map of YYYY-MM -> array of transactions
 */
export function groupByMonth(transactions) {
  if (!transactions?.length) return {};

  return transactions.reduce((groups, txn) => {
    const monthKey = getMonthKey(txn.date);
    if (!groups[monthKey]) {
      groups[monthKey] = [];
    }
    groups[monthKey].push(txn);
    return groups;
  }, {});
}

/**
 * Get monthly totals for income and expenses
 * @param {Array} transactions - Array of transactions
 * @returns {Object} - Map of YYYY-MM -> { income, expenses, net }
 */
export function getMonthlyTotals(transactions) {
  if (!transactions?.length) return {};

  const grouped = groupByMonth(transactions);
  const totals = {};

  Object.entries(grouped).forEach(([monthKey, monthTxns]) => {
    const income = sumIncome(monthTxns);
    const expenses = sumExpenses(monthTxns);
    totals[monthKey] = {
      income,
      expenses,
      net: income - expenses
    };
  });

  return totals;
}

/**
 * Get category totals with transaction details
 * @param {Array} transactions - Array of transactions
 * @returns {Object} - Map of category_name -> { total, count, transactions }
 */
export function getCategoryTotals(transactions) {
  if (!transactions?.length) return {};

  const grouped = groupByCategory(transactions);
  const totals = {};

  Object.entries(grouped).forEach(([category, categoryTxns]) => {
    totals[category] = {
      total: sumTransactions(categoryTxns),
      count: categoryTxns.length,
      transactions: categoryTxns
    };
  });

  return totals;
}

/**
 * Flatten transactions with subtransactions
 * Expands split transactions into individual line items
 * @param {Array} transactions - Array of transactions (may include subtransactions)
 * @returns {Array} - Flattened array with subtransactions expanded
 */
export function flattenSubtransactions(transactions) {
  if (!transactions?.length) return [];

  const flattened = [];

  transactions.forEach(txn => {
    if (txn.subtransactions?.length > 0) {
      txn.subtransactions.forEach(subTxn => {
        flattened.push({
          ...subTxn,
          payee_name: subTxn.payee_name || txn.payee_name,
          date: txn.date,
          account_id: txn.account_id,
          category_id: subTxn.category_id || txn.category_id,
          category_name: subTxn.category_name || txn.category_name,
          transfer_account_id: subTxn.transfer_account_id || txn.transfer_account_id,
          _parentId: txn.id
        });
      });
    } else {
      flattened.push(txn);
    }
  });

  return flattened;
}

/**
 * Process transactions for standard financial reporting
 * Combines common filtering operations used across the app
 * @param {Array} transactions - Raw transactions from YNAB
 * @param {Object} options - Processing options
 * @param {Set} [options.investmentAccountIds] - Investment account IDs to exclude
 * @param {Date} [options.startDate] - Start of date range
 * @param {Date|null} [options.endDate] - End of date range
 * @param {boolean} [options.flattenSplits=true] - Whether to expand subtransactions
 * @returns {Array} - Processed transactions ready for calculations
 */
export function processTransactions(transactions, options = {}) {
  const {
    investmentAccountIds = new Set(),
    startDate,
    endDate,
    flattenSplits = true
  } = options;

  let result = transactions || [];

  // Flatten subtransactions first if requested
  if (flattenSplits) {
    result = flattenSubtransactions(result);
  }

  // Exclude investment account transactions
  result = excludeInvestmentAccounts(result, investmentAccountIds);

  // Exclude internal transfers (keep transfers to/from tracking accounts)
  result = excludeTransfers(result, investmentAccountIds);

  // Exclude system transactions (reconciliation, starting balance)
  result = excludeSystemTransactions(result);

  // Filter by date range if specified
  if (startDate) {
    result = filterByDateRange(result, startDate, endDate);
  }

  return result;
}
