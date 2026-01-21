/**
 * Shared calculation utilities
 * Re-exports all calculation functions for easy importing
 *
 * Usage:
 *   import { getDateRange, sumExpenses, getCategoryBucket } from '../utils/calculations';
 */

// Constants - single source of truth
export {
  INCOME_CATEGORIES,
  DEBT_PAYMENT_CATEGORIES,
  SAVINGS_INVESTMENT_CATEGORIES,
  CSP_TARGETS,
  CSP_BUCKETS,
  DEFAULT_FIXED_COST_KEYWORDS,
  DEFAULT_INVESTMENT_KEYWORDS,
  DEFAULT_SAVINGS_KEYWORDS,
  GROUP_NAME_TO_BUCKET,
  DEFAULT_CSP_SETTINGS,
  isIncomeCategory,
  shouldSkipTransaction,
} from './constants';

// Date range utilities
export {
  getDateRange,
  getMonthBoundaries,
  isWithinRange,
  getMonthKey,
  getMonthKeysBetween,
  getMonthCount,
  formatDateRange,
} from './dateRanges';

// Transaction utilities
export {
  getTransactionAmount,
  filterByDateRange,
  filterByCategory,
  filterByType,
  excludeTransfers,
  excludeInvestmentAccounts,
  excludeSystemTransactions,
  sumTransactions,
  sumExpenses,
  sumIncome,
  groupByCategory,
  groupByMonth,
  getMonthlyTotals,
  getCategoryTotals,
  flattenSubtransactions,
  processTransactions,
} from './transactions';

// Category utilities
export {
  mapGroupNameToBucket,
  inferBucketFromKeywords,
  getCategoryBucket,
  mapCategoriesToBuckets,
  groupCategoriesByBucket,
  calculateBucketTotals,
  getBucketInfo,
  calculateCSPPercentages,
} from './categories';

// YNAB comparison utilities
export {
  getMonthsInRange,
  calculateYNABTotals,
  getYNABComparisonData,
  compareWithYNAB,
} from './ynabComparison';
