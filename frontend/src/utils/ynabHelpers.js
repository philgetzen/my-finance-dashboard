// YNAB Helper Functions

/**
 * Convert YNAB milliunits to dollars
 * YNAB stores amounts in milliunits where $1.00 = 1000 milliunits
 * @param {number} milliunits - Amount in milliunits from YNAB
 * @returns {number} - Amount in dollars
 */
export const milliunitsToAmount = (milliunits) => {
  if (typeof milliunits !== 'number') return 0;
  return milliunits / 1000;
};

/**
 * Convert dollars to YNAB milliunits
 * @param {number} amount - Amount in dollars
 * @returns {number} - Amount in milliunits for YNAB
 */
export const amountToMilliunits = (amount) => {
  if (typeof amount !== 'number') return 0;
  return Math.round(amount * 1000);
};

/**
 * Format currency with proper conversion from YNAB milliunits
 * @param {number} milliunits - Amount in milliunits from YNAB
 * @param {object} options - Formatting options
 * @returns {string} - Formatted currency string
 */
export const formatYNABCurrency = (milliunits, options = {}) => {
  const amount = milliunitsToAmount(milliunits);
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options
  });
};

/**
 * Get the account balance from either YNAB or Plaid format
 * @param {object} account - Account object from YNAB or Plaid
 * @returns {number} - Balance in dollars
 */
export const getAccountBalance = (account) => {
  if (!account) return 0;
  
  // YNAB account - balance is in milliunits
  // YNAB accounts have budget_id, account_type, or on_budget as identifiers
  if (account.balance !== undefined && (
    account.budget_id !== undefined ||
    account.account_type !== undefined ||
    account.on_budget !== undefined
  ) && typeof account.balance === 'number') {
    return milliunitsToAmount(account.balance);
  }
  
  // Plaid account - balance is already in dollars
  if (account.balances?.current !== undefined) {
    return account.balances.current;
  }
  
  // Manual account - balance is in dollars
  if (account.balance !== undefined) {
    return account.balance;
  }
  
  return 0;
};

/**
 * Get transaction amount from either YNAB or Plaid format
 * @param {object} transaction - Transaction object from YNAB or Plaid
 * @returns {number} - Amount in dollars
 */
export const getTransactionAmount = (transaction) => {
  if (!transaction) return 0;
  
  // YNAB transaction - amount is in milliunits
  // YNAB transactions have payee_name, category_name, or budget_id as identifiers
  if (transaction.amount !== undefined && (
    transaction.payee_name !== undefined || 
    transaction.category_name !== undefined ||
    transaction.budget_id !== undefined
  )) {
    return milliunitsToAmount(transaction.amount);
  }
  
  // Plaid transaction - amount is already in dollars
  if (transaction.amount !== undefined) {
    return transaction.amount;
  }
  
  return 0;
};

/**
 * Check if an account is from YNAB
 * @param {object} account - Account object
 * @returns {boolean} - True if from YNAB
 */
export const isYNABAccount = (account) => {
  return account && (
    account.budget_id !== undefined || 
    account.account_type !== undefined ||
    account.on_budget !== undefined
  );
};

/**
 * Check if a transaction is from YNAB
 * @param {object} transaction - Transaction object
 * @returns {boolean} - True if from YNAB
 */
export const isYNABTransaction = (transaction) => {
  return transaction && (
    transaction.budget_id !== undefined ||
    transaction.payee_name !== undefined ||
    transaction.category_name !== undefined
  );
};

/**
 * Normalize account type from YNAB format
 * @param {string} type - Raw account type
 * @returns {string} - Normalized account type
 */
export const normalizeYNABAccountType = (type) => {
  if (!type) return 'other';
  const lowerType = type.toLowerCase();
  
  // YNAB specific mappings
  if (lowerType === 'otherasset') return 'investment';
  if (lowerType === 'creditcard') return 'credit';
  if (lowerType === 'otherliability') return 'loan';
  
  return lowerType;
};
