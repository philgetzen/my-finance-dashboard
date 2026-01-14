/**
 * Newsletter Helper Functions
 * YNAB utilities and date helpers for the newsletter system
 */

// ============================================
// YNAB Currency Conversion
// ============================================

/**
 * Convert YNAB milliunits to dollars
 * YNAB stores amounts in milliunits where $1.00 = 1000 milliunits
 * @param {number} milliunits - Amount in milliunits from YNAB
 * @returns {number} - Amount in dollars
 */
function milliunitsToAmount(milliunits) {
  if (typeof milliunits !== 'number') return 0;
  return milliunits / 1000;
}

/**
 * Format currency amount with USD formatting
 * @param {number} amount - Amount in dollars
 * @param {object} options - Formatting options
 * @returns {string} - Formatted currency string
 */
function formatCurrency(amount, options = {}) {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    ...options
  });
}

/**
 * Format currency with cents
 * @param {number} amount - Amount in dollars
 * @returns {string} - Formatted currency string
 */
function formatCurrencyWithCents(amount) {
  return formatCurrency(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format percentage
 * @param {number} value - Percentage value (0-100 or decimal)
 * @param {boolean} isDecimal - True if value is 0-1, false if 0-100
 * @returns {string} - Formatted percentage string
 */
function formatPercent(value, isDecimal = false) {
  const percent = isDecimal ? value * 100 : value;
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
}

// ============================================
// YNAB Data Helpers
// ============================================

/**
 * Get transaction amount from YNAB transaction
 * @param {object} transaction - YNAB transaction object
 * @returns {number} - Amount in dollars
 */
function getTransactionAmount(transaction) {
  if (!transaction) return 0;
  return milliunitsToAmount(transaction.amount || 0);
}

/**
 * Get account balance from YNAB account
 * @param {object} account - YNAB account object
 * @returns {number} - Balance in dollars
 */
function getAccountBalance(account) {
  if (!account) return 0;
  return milliunitsToAmount(account.balance || 0);
}

/**
 * Normalize YNAB account type to standard types
 * @param {string} type - Raw account type from YNAB
 * @returns {string} - Normalized account type
 */
function normalizeAccountType(type) {
  if (!type) return 'other';
  const lowerType = type.toLowerCase();

  // YNAB specific mappings
  if (lowerType === 'otherasset') return 'investment';
  if (lowerType === 'creditcard') return 'credit';
  if (lowerType === 'otherliability') return 'loan';

  return lowerType;
}

// Income categories from YNAB
const YNAB_INCOME_CATEGORIES = [
  "Inflow: Ready to Assign",
  "Ready to Assign",
  "To be Budgeted",
  "Deferred Income SubCategory"
];

// Debt payment categories that should NOT be excluded even if they are transfers
// These are real expenses (mortgage, car loans) that happen to be transfers to tracking accounts
const DEBT_PAYMENT_CATEGORIES = [
  "8331 Mortgage",
  "2563 Mortgage",
  "Kia Loan"
];

/**
 * Check if a category is an income category
 * @param {string} categoryName - Category name from YNAB
 * @returns {boolean}
 */
function isIncomeCategory(categoryName) {
  return YNAB_INCOME_CATEGORIES.includes(categoryName);
}

/**
 * Check if a category is a debt payment category
 * @param {string} categoryName - Category name from YNAB
 * @returns {boolean}
 */
function isDebtPaymentCategory(categoryName) {
  return DEBT_PAYMENT_CATEGORIES.includes(categoryName);
}

/**
 * Check if transaction should be excluded from calculations
 * @param {object} transaction - YNAB transaction
 * @returns {boolean}
 */
function shouldExcludeTransaction(transaction) {
  // Skip reconciliation transactions
  const payee = transaction.payee_name || '';
  if (payee === 'Reconciliation Balance Adjustment' ||
      payee === 'Starting Balance') {
    return true;
  }

  // Check if this is a debt payment (these should NOT be excluded)
  const isCategorizedDebtPayment = isDebtPaymentCategory(transaction.category_name);

  // DEBUG: Log potential mortgage/loan exclusions
  const catName = (transaction.category_name || '').toLowerCase();
  if (catName.includes('mortgage') || catName.includes('loan') || catName.includes('2563') || catName.includes('8331')) {
    console.log(`[EXCLUDE DEBUG] Category: "${transaction.category_name}", isDebtPayment: ${isCategorizedDebtPayment}, hasTransferAccount: ${!!transaction.transfer_account_id}, payee: "${payee}"`);
  }

  // Skip transfers UNLESS they are categorized debt payments
  if (transaction.transfer_account_id && !isCategorizedDebtPayment) {
    return true;
  }

  // Skip transfer payees UNLESS they are categorized debt payments
  if (payee.toLowerCase().startsWith('transfer :') && !isCategorizedDebtPayment) {
    return true;
  }

  return false;
}

// ============================================
// Date Helpers
// ============================================

/**
 * Get the start of a given week (Sunday)
 * @param {Date} date - Reference date
 * @returns {Date}
 */
function getStartOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of a given week (Saturday)
 * @param {Date} date - Reference date
 * @returns {Date}
 */
function getEndOfWeek(date = new Date()) {
  const d = getStartOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Get the start of a given month
 * @param {Date} date - Reference date
 * @returns {Date}
 */
function getStartOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of a given month
 * @param {Date} date - Reference date
 * @returns {Date}
 */
function getEndOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Get the start of a given year
 * @param {Date} date - Reference date
 * @returns {Date}
 */
function getStartOfYear(date = new Date()) {
  const d = new Date(date);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get a date N months ago
 * @param {number} months - Number of months back
 * @param {Date} fromDate - Reference date
 * @returns {Date}
 */
function getMonthsAgo(months, fromDate = new Date()) {
  const d = new Date(fromDate);
  d.setMonth(d.getMonth() - months);
  return d;
}

/**
 * Get the same month from last year
 * @param {Date} date - Reference date
 * @returns {Date}
 */
function getSameMonthLastYear(date = new Date()) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() - 1);
  return d;
}

/**
 * Get month key in YYYY-MM format
 * @param {Date} date - Date object
 * @returns {string}
 */
function getMonthKey(date) {
  return date.toISOString().slice(0, 7);
}

/**
 * Get week key in YYYY-WW format
 * @param {Date} date - Date object
 * @returns {string}
 */
function getWeekKey(date) {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

/**
 * Format date for display (e.g., "January 10, 2026")
 * @param {Date} date - Date object
 * @returns {string}
 */
function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Format date for short display (e.g., "Jan 10")
 * @param {Date} date - Date object
 * @returns {string}
 */
function formatDateShort(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format month for display (e.g., "January 2026")
 * @param {Date} date - Date object
 * @returns {string}
 */
function formatMonth(date) {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Format month short (e.g., "Jan '26")
 * @param {Date} date - Date object
 * @returns {string}
 */
function formatMonthShort(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit'
  });
}

/**
 * Check if date is within a range
 * @param {Date} date - Date to check
 * @param {Date} start - Start of range
 * @param {Date} end - End of range
 * @returns {boolean}
 */
function isWithinRange(date, start, end) {
  return date >= start && date <= end;
}

/**
 * Get monthly summary data for a specific time range
 * @param {Object} monthlyData - Monthly data object with monthKey keys
 * @param {number} months - Number of months to retrieve
 * @returns {Array} - Array of monthly data objects
 */
function getMonthlyRangeData(monthlyData, months = 6) {
  const result = [];
  const today = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthKey = getMonthKey(date);
    const monthName = formatMonthShort(date);

    result.push({
      monthKey,
      monthName,
      date,
      ...(monthlyData[monthKey] || { income: 0, expenses: 0, net: 0 })
    });
  }

  return result;
}

/**
 * Get the next Saturday at 9am in the given timezone
 * @param {string} timezone - Timezone string (e.g., 'America/Los_Angeles')
 * @returns {Date}
 */
function getNextSaturday9am(timezone = 'America/Los_Angeles') {
  const now = new Date();
  const daysUntilSaturday = (6 - now.getDay() + 7) % 7 || 7;
  const nextSaturday = new Date(now);
  nextSaturday.setDate(now.getDate() + daysUntilSaturday);
  nextSaturday.setHours(9, 0, 0, 0);
  return nextSaturday;
}

// ============================================
// Transaction Processing
// ============================================

/**
 * Process YNAB transactions into monthly summaries
 * @param {Array} transactions - YNAB transactions array
 * @param {Set} investmentAccountIds - Set of investment account IDs to exclude
 * @returns {Object} - { monthlyData, totals }
 */
function processTransactions(transactions, investmentAccountIds = new Set()) {
  const monthlyData = {};
  let totalIncome = 0;
  let totalExpenses = 0;

  if (!transactions?.length) {
    return {
      monthlyData,
      totals: { income: 0, expenses: 0, net: 0 }
    };
  }

  const processTransaction = (txn, accountId) => {
    // Skip investment account transactions
    if (investmentAccountIds.has(accountId)) return;

    // Skip excluded transactions
    if (shouldExcludeTransaction(txn)) return;

    const amount = getTransactionAmount(txn);
    const date = new Date(txn.date);
    const monthKey = getMonthKey(date);

    // Initialize month data if needed
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { income: 0, expenses: 0, net: 0, transactions: [] };
    }

    // Categorize as income or expense
    const isIncome = isIncomeCategory(txn.category_name);

    if (isIncome) {
      monthlyData[monthKey].income += amount;
      totalIncome += amount;
    } else if (amount < 0) {
      // Only count actual expenses (negative amounts = outflows)
      // Positive amounts in non-income categories (refunds) are ignored
      monthlyData[monthKey].expenses += Math.abs(amount);
      totalExpenses += Math.abs(amount);
    }

    monthlyData[monthKey].transactions.push({
      ...txn,
      processedAmount: amount,
      isIncome
    });
  };

  // Process all transactions including subtransactions
  transactions.forEach(transaction => {
    if (transaction.subtransactions?.length > 0) {
      transaction.subtransactions.forEach(subTxn => {
        processTransaction({
          ...subTxn,
          payee_name: subTxn.payee_name || transaction.payee_name,
          date: transaction.date,
          category_id: subTxn.category_id || transaction.category_id,
          category_name: subTxn.category_name || transaction.category_name,
          transfer_account_id: subTxn.transfer_account_id || transaction.transfer_account_id
        }, transaction.account_id);
      });
    } else {
      processTransaction(transaction, transaction.account_id);
    }
  });

  // Calculate net for each month
  Object.keys(monthlyData).forEach(monthKey => {
    monthlyData[monthKey].net = monthlyData[monthKey].income - monthlyData[monthKey].expenses;
  });

  return {
    monthlyData,
    totals: {
      income: totalIncome,
      expenses: totalExpenses,
      net: totalIncome - totalExpenses
    }
  };
}

/**
 * Get transactions for a specific month
 * @param {Array} transactions - All YNAB transactions
 * @param {Date} monthDate - Date within the target month
 * @returns {Array} - Filtered transactions
 */
function getTransactionsForMonth(transactions, monthDate) {
  const start = getStartOfMonth(monthDate);
  const end = getEndOfMonth(monthDate);

  return transactions.filter(txn => {
    const txnDate = new Date(txn.date);
    return isWithinRange(txnDate, start, end);
  });
}

/**
 * Get transactions for a date range
 * @param {Array} transactions - All YNAB transactions
 * @param {Date} startDate - Start of range
 * @param {Date} endDate - End of range
 * @returns {Array} - Filtered transactions
 */
function getTransactionsForRange(transactions, startDate, endDate) {
  return transactions.filter(txn => {
    const txnDate = new Date(txn.date);
    return isWithinRange(txnDate, startDate, endDate);
  });
}

/**
 * Aggregate spending by category
 * @param {Array} transactions - Processed transactions
 * @returns {Object} - { categoryName: totalAmount }
 */
function aggregateByCategory(transactions) {
  const categories = {};

  transactions.forEach(txn => {
    if (txn.isIncome || shouldExcludeTransaction(txn)) return;

    const category = txn.category_name || 'Uncategorized';
    const amount = Math.abs(getTransactionAmount(txn));

    categories[category] = (categories[category] || 0) + amount;
  });

  return categories;
}

/**
 * Get top spending categories
 * @param {Object} categorySpending - { categoryName: amount }
 * @param {number} limit - Number of categories to return
 * @returns {Array} - [{ name, amount }]
 */
function getTopCategories(categorySpending, limit = 10) {
  return Object.entries(categorySpending)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, amount]) => ({ name, amount }));
}

module.exports = {
  // Currency
  milliunitsToAmount,
  formatCurrency,
  formatCurrencyWithCents,
  formatPercent,

  // YNAB
  getTransactionAmount,
  getAccountBalance,
  normalizeAccountType,
  isIncomeCategory,
  shouldExcludeTransaction,
  YNAB_INCOME_CATEGORIES,

  // Dates
  getStartOfWeek,
  getEndOfWeek,
  getStartOfMonth,
  getEndOfMonth,
  getStartOfYear,
  getMonthsAgo,
  getSameMonthLastYear,
  getMonthKey,
  getWeekKey,
  formatDate,
  formatDateShort,
  formatMonth,
  formatMonthShort,
  isWithinRange,
  getMonthlyRangeData,
  getNextSaturday9am,

  // Transaction processing
  processTransactions,
  getTransactionsForMonth,
  getTransactionsForRange,
  aggregateByCategory,
  getTopCategories
};
