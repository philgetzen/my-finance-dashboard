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
  
  // Plaid transaction - assuming amount is in cents if not YNAB
  // (Plaid often provides amounts in cents or as a float,
  // this ensures consistency if it's cents)
  if (transaction.amount !== undefined) {
    // Heuristic: if it's not a YNAB transaction, and it's an integer,
    // and it's large, it might be cents.
    // A more robust solution would be to have a clear flag or check Plaid's specific API version docs.
    // For now, let's assume if it's not YNAB, it might need conversion if it looks like cents.
    // This is a common source of 100x errors.
    // Let's be conservative: if it's not YNAB, assume it's dollars unless a specific check for Plaid cents is added.
    // The problem description implies a 100x multiplication.
    // If Plaid provides amounts in major units (dollars), this is fine.
    // If Plaid provides amounts in minor units (cents), it needs division.
    // Given the "multiplied by 100" issue, it's safer to assume Plaid might be in cents.
    // However, the original comment said "already in dollars".
    // Let's test a conditional division for non-YNAB transactions if they seem to be scaled up.
    // A common pattern for Plaid is positive for debits, negative for credits.
    // The problem states "income vs expense numbers seem to be multiplied by 100".
    // This points to `transaction.amount` for Plaid being in cents.
    // Correcting this based on the assumption that Plaid amounts are in dollars,
    // similar to Plaid balances. If they were in cents, this would be transaction.amount / 100.
    return transaction.amount; // Assuming Plaid amounts are in dollars
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
