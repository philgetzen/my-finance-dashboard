/**
 * Shared constants for financial calculations
 * Single source of truth - all hooks should import from here
 *
 * Income categories, bucket keywords and group-name mappings live in
 * shared/cashflow.mjs so the newsletter uses the same lists.
 */

export {
  INCOME_CATEGORIES,
  SAVINGS_INVESTMENT_CATEGORIES,
  DEFAULT_FIXED_COST_KEYWORDS,
  DEFAULT_INVESTMENT_KEYWORDS,
  DEFAULT_SAVINGS_KEYWORDS,
  GROUP_NAME_TO_BUCKET,
  isIncomeCategory
} from '../../../../shared/cashflow.mjs';

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
 * Default CSP settings
 */
export const DEFAULT_CSP_SETTINGS = {
  includeTrackingAccounts: true,
  useKeywordFallback: false,  // Prefer custom category mappings over keyword inference
};

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
