/**
 * Cash-flow classification for YNAB transactions
 *
 * The rules live in shared/cashflow.mjs, which the weekly newsletter uses
 * too, so the dashboard and the email agree on income and spending. This
 * file adds the browser's local-date helpers.
 */

export {
  isOnBudget,
  isLoanAccount,
  isDebtAccount,
  isHomeValueAccount,
  isInvestmentAccount,
  getBucketForCategory,
  flattenLines,
  createClassifier,
  categoryLabels,
  classifyTransactions,
  summarizeLines
} from '../../../../shared/cashflow.mjs';

// ============================================
// Calendar dates
// ============================================

/**
 * Parse a YNAB 'YYYY-MM-DD' date as local midnight.
 * new Date('2026-08-01') is UTC midnight, which is July 31 in US time zones.
 * @param {string} dateString - 'YYYY-MM-DD'
 * @returns {Date}
 */
export function parseLocalDate(dateString) {
  if (!dateString) return new Date(NaN);
  const [year, month, day] = String(dateString).slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Local calendar date as 'YYYY-MM-DD'
 * @param {Date} date
 * @returns {string}
 */
export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Local month as 'YYYY-MM'
 * @param {Date} date
 * @returns {string}
 */
export function toMonthKey(date) {
  return toDateKey(date).slice(0, 7);
}
