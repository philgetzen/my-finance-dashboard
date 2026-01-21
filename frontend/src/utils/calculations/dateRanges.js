/**
 * Date range utilities for financial calculations
 * Designed to match YNAB's date range behavior exactly
 */

/**
 * Get the start and end dates for a given period
 *
 * YNAB's "Last X Months" behavior:
 * - "Last 6 Months" in January 2026 = Aug 1, 2025 through today (Jan 2026)
 * - It includes the current partial month
 * - The range is X complete calendar months before the current month, plus the current partial month
 *
 * @param {string|number} period - Period identifier: 'thisMonth', 'last3months', 'last6months', 'last12months', 'ytd', 'lastYear', 'all', or number of months
 * @param {Date} [referenceDate] - Reference date (defaults to now, useful for testing)
 * @returns {{ start: Date, end: Date|null }} - Start date and end date (null means "up to today")
 */
export function getDateRange(period, referenceDate = new Date()) {
  const now = referenceDate;

  // Handle numeric periods (number of months)
  if (typeof period === 'number') {
    if (period === 0) {
      // "This Month": current partial month (1st of current month to today)
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: null // Up to today
      };
    } else {
      // "Last X Months": X calendar months INCLUDING current partial month
      // This matches YNAB's "Last X Months" behavior
      // e.g., "Last 6 Months" in January = Aug, Sep, Oct, Nov, Dec, Jan
      return {
        start: new Date(now.getFullYear(), now.getMonth() - (period - 1), 1),
        end: null // Up to today (include current partial month)
      };
    }
  }

  // Handle string period identifiers
  const periodKey = String(period).toLowerCase().replace(/[^a-z0-9]/g, '');

  switch (periodKey) {
    case 'thismonth':
    case '0':
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: null
      };

    case 'last3months':
    case '3':
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 2, 1),
        end: null
      };

    case 'last6months':
    case '6':
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 5, 1),
        end: null
      };

    case 'last12months':
    case '12':
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 11, 1),
        end: null
      };

    case 'ytd':
    case 'yeartodate':
      return {
        start: new Date(now.getFullYear(), 0, 1), // January 1st of current year
        end: null
      };

    case 'lastyear':
      return {
        start: new Date(now.getFullYear() - 1, 0, 1), // January 1st of last year
        end: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999) // December 31st of last year
      };

    case 'all':
    case 'alldates':
      return {
        start: new Date(1970, 0, 1), // Beginning of time (epoch)
        end: null
      };

    default:
      // Default to last 6 months if unrecognized
      console.warn(`Unrecognized period: ${period}, defaulting to last 6 months`);
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 5, 1),
        end: null
      };
  }
}

/**
 * Get the first and last day of a given month
 * @param {Date} date - Any date within the desired month
 * @returns {{ first: Date, last: Date }} - First and last day of the month
 */
export function getMonthBoundaries(date) {
  const year = date.getFullYear();
  const month = date.getMonth();

  return {
    first: new Date(year, month, 1),
    last: new Date(year, month + 1, 0, 23, 59, 59, 999) // Last moment of last day
  };
}

/**
 * Check if a date is within a range (inclusive)
 * @param {Date|string} date - The date to check
 * @param {Date} startDate - Start of range
 * @param {Date|null} endDate - End of range (null means up to today)
 * @returns {boolean} - True if date is within range
 */
export function isWithinRange(date, startDate, endDate) {
  const checkDate = date instanceof Date ? date : new Date(date);
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : new Date();

  return checkDate >= start && checkDate <= end;
}

/**
 * Get month key in YYYY-MM format for a date
 * @param {Date|string} date - The date
 * @returns {string} - Month key like "2026-01"
 */
export function getMonthKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 7);
}

/**
 * Get array of month keys between two dates
 * @param {Date} startDate - Start date
 * @param {Date|null} endDate - End date (null means today)
 * @returns {string[]} - Array of month keys like ["2025-08", "2025-09", ...]
 */
export function getMonthKeysBetween(startDate, endDate) {
  const end = endDate || new Date();
  const keys = [];

  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const finalMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (current <= finalMonth) {
    keys.push(getMonthKey(current));
    current.setMonth(current.getMonth() + 1);
  }

  return keys;
}

/**
 * Calculate the number of months in a date range
 * @param {Date} startDate - Start date
 * @param {Date|null} endDate - End date (null means today)
 * @returns {number} - Number of months (partial months count as 1)
 */
export function getMonthCount(startDate, endDate) {
  return getMonthKeysBetween(startDate, endDate).length;
}

/**
 * Format a date range for display
 * @param {Date} startDate - Start date
 * @param {Date|null} endDate - End date (null means today)
 * @returns {string} - Formatted string like "Aug 2025 - Jan 2026"
 */
export function formatDateRange(startDate, endDate) {
  const formatOptions = { month: 'short', year: 'numeric' };
  const start = startDate.toLocaleDateString('en-US', formatOptions);
  const end = endDate
    ? endDate.toLocaleDateString('en-US', formatOptions)
    : new Date().toLocaleDateString('en-US', formatOptions);

  return `${start} - ${end}`;
}
