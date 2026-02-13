/**
 * Shared constants for financial calculations
 * Single source of truth - all hooks should import from here
 */

/**
 * Income categories in YNAB that represent money coming in
 * These are excluded from expense calculations
 */
export const INCOME_CATEGORIES = [
  "Inflow: Ready to Assign",
  "Ready to Assign",
  "To be Budgeted",
  "Deferred Income SubCategory"
];

/**
 * Categories that represent debt payments (mortgages, loans)
 * These may be categorized transfers in YNAB
 */
export const DEBT_PAYMENT_CATEGORIES = [
  "8331 Mortgage",
  "2563 Mortgage",
  "Kia Loan"
];

/**
 * Categories that represent savings/investment contributions
 */
export const SAVINGS_INVESTMENT_CATEGORIES = [
  "Investments (Stocks, ETFs, MFs)",
];

/**
 * Ramit Sethi's Conscious Spending Plan recommended percentages
 */
export const CSP_TARGETS = {
  fixedCosts: { min: 50, max: 60, label: 'Fixed Costs' },
  investments: { min: 10, max: 10, label: 'Investments' },
  savings: { min: 5, max: 10, label: 'Savings' },
  guiltFree: { min: 20, max: 35, label: 'Guilt-Free Spending' }
};

/**
 * CSP Bucket types for category mapping
 */
export const CSP_BUCKETS = {
  fixedCosts: { key: 'fixedCosts', label: 'Fixed Costs', color: '#6366F1' },
  investments: { key: 'investments', label: 'Investments', color: '#10B981' },
  savings: { key: 'savings', label: 'Savings', color: '#3B82F6' },
  guiltFree: { key: 'guiltFree', label: 'Guilt-Free', color: '#F59E0B' }
};

/**
 * Default keyword-based mappings for CSP bucket inference
 */
export const DEFAULT_FIXED_COST_KEYWORDS = [
  'rent', 'mortgage', 'utilities', 'electric', 'gas', 'water', 'internet',
  'phone', 'insurance', 'car payment', 'auto', 'transportation', 'groceries',
  'subscription', 'netflix', 'spotify', 'gym', 'membership',
  'loan', 'debt', 'payment', 'cable', 'trash', 'sewer', 'hoa'
];

export const DEFAULT_INVESTMENT_KEYWORDS = [
  'investment', 'retirement', '401k', 'ira', 'roth', 'stock', 'etf',
  'mutual fund', 'brokerage', 'investing'
];

export const DEFAULT_SAVINGS_KEYWORDS = [
  'savings', 'emergency', 'vacation', 'travel', 'gift', 'holiday',
  'christmas', 'birthday', 'wedding', 'fund', 'goal', 'reserve',
  'house', 'down payment', 'sinking'
];

/**
 * Map YNAB group names to CSP buckets
 * This allows direct matching of user's YNAB group structure
 */
export const GROUP_NAME_TO_BUCKET = {
  // Fixed Costs variations
  'fixed costs': 'fixedCosts',
  'fixed': 'fixedCosts',
  'bills': 'fixedCosts',
  'monthly bills': 'fixedCosts',
  // Investments variations
  'investments': 'investments',
  'investing': 'investments',
  'post tax investments': 'investments',
  'post-tax investments': 'investments',
  // Savings variations
  'savings': 'savings',
  'saving': 'savings',
  'savings goals': 'savings',
  'true expenses': 'guiltFree', // Common YNAB pattern - irregular but expected expenses
  // Guilt-free variations
  'guilt-free': 'guiltFree',
  'guilt free': 'guiltFree',
  'guilt-free spending': 'guiltFree',
  'discretionary': 'guiltFree',
  'fun money': 'guiltFree',
  'spending': 'guiltFree',
  'variable expenses': 'guiltFree',
};

/**
 * Default CSP settings
 */
export const DEFAULT_CSP_SETTINGS = {
  includeTrackingAccounts: true,
  useKeywordFallback: false,  // Prefer custom category mappings over keyword inference
};

/**
 * Check if a category name is an income category
 * @param {string} categoryName - The category name to check
 * @returns {boolean} - True if this is an income category
 */
export function isIncomeCategory(categoryName) {
  return INCOME_CATEGORIES.includes(categoryName);
}

/**
 * Check if a transaction should be skipped (reconciliation, starting balance, etc.)
 * @param {object} transaction - The transaction to check
 * @returns {boolean} - True if this transaction should be skipped
 */
export function shouldSkipTransaction(transaction) {
  const payeeName = transaction.payee_name;
  return payeeName === 'Reconciliation Balance Adjustment' ||
         payeeName === 'Starting Balance';
}
