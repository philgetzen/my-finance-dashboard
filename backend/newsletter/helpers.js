/**
 * Newsletter Helper Functions
 * Formatting and scheduling helpers for the newsletter system.
 * Income/spending classification lives in cashflow.js.
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
// Date Formatting
// ============================================

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

module.exports = {
  // Currency
  milliunitsToAmount,
  formatCurrency,
  formatCurrencyWithCents,
  formatPercent,

  // Dates
  formatDate,
  formatDateShort,
  formatMonth,
  formatMonthShort,
  getNextSaturday9am
};
