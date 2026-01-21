/**
 * YNAB Comparison Utilities
 * Calculate totals directly from YNAB months data for comparison with app calculations
 */

import { getDateRange, getMonthCount } from './dateRanges';
import { INCOME_CATEGORIES } from './constants';

/**
 * Get YNAB months within a date range
 * @param {Array} months - YNAB months array
 * @param {string} period - Period string (e.g., 'last6months')
 * @returns {Array} Filtered months within the date range
 */
export function getMonthsInRange(months, period) {
  if (!months?.length) return [];

  const { start, end } = getDateRange(period);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return months.filter(month => {
    // YNAB month format: "2025-08-01"
    const monthDate = new Date(month.month + 'T00:00:00');

    // Check if month is within range
    // Start of month must be >= start date
    // Start of month must be <= end date (or today if end is null)
    const isAfterStart = monthDate >= start;
    // When end is null, use today as the end boundary
    // A month is included if its start date is on or before today
    const effectiveEnd = end === null ? today : end;
    const isBeforeEnd = monthDate <= effectiveEnd;

    return isAfterStart && isBeforeEnd;
  });
}

/**
 * Calculate YNAB totals from months data
 * @param {Array} months - YNAB months array (filtered for date range)
 * @param {Object} options - Calculation options
 * @returns {Object} YNAB totals for comparison
 */
export function calculateYNABTotals(months, options = {}) {
  if (!months?.length) {
    return {
      totalIncome: 0,
      totalExpenses: 0,
      net: 0,
      avgMonthlySpend: 0,
      categoryTotals: {},
      monthCount: 0,
      sumOfIncomeCategories: 0,
      incomeCategoryTotals: {},
      incomeVsCategoryDiff: 0,
    };
  }

  let totalIncome = 0;
  let totalActivity = 0; // This is spending (negative in YNAB)
  let sumOfCategoryActivities = 0; // Sum of individual category activities for comparison
  let sumOfIncomeCategories = 0; // Sum of income category activities (positive values)
  const categoryTotals = {};
  const incomeCategoryTotals = {}; // Track income by category for diagnostics

  months.forEach(month => {
    // YNAB's income field is the total income for the month
    totalIncome += (month.income || 0) / 1000; // milliunits to dollars

    // YNAB's activity is total spending (negative)
    totalActivity += (month.activity || 0) / 1000;

    // Process category-level data if available
    if (month.categories) {
      month.categories.forEach(cat => {
        const categoryName = cat.name;
        const activity = (cat.activity || 0) / 1000; // Keep sign for proper sum
        const absActivity = Math.abs(activity);

        // Check if this is an income category
        const isIncomeCategory = INCOME_CATEGORIES.some(ic =>
          categoryName === ic || categoryName.includes(ic)
        );

        if (isIncomeCategory) {
          // For income categories, positive activity = income received
          // Note: YNAB months endpoint doesn't include category details,
          // so this will typically be $0. Category data requires individual month calls.
          if (activity > 0) {
            sumOfIncomeCategories += activity;
            if (!incomeCategoryTotals[categoryName]) {
              incomeCategoryTotals[categoryName] = { total: 0, count: 0 };
            }
            incomeCategoryTotals[categoryName].total += activity;
            incomeCategoryTotals[categoryName].count += 1;
          }
        }

        // Sum negative activities (outflows/spending)
        if (activity < 0) {
          sumOfCategoryActivities += activity;
        }

        if (!categoryTotals[categoryName]) {
          categoryTotals[categoryName] = {
            total: 0,
            budgeted: 0,
            categoryId: cat.id,
          };
        }

        categoryTotals[categoryName].total += absActivity;
        categoryTotals[categoryName].budgeted += (cat.budgeted || 0) / 1000;
      });
    }
  });

  // Activity is negative for spending, so negate it
  const totalExpenses = Math.abs(totalActivity);
  const sumOfCategoryExpenses = Math.abs(sumOfCategoryActivities);
  const activityVsCategoryDiff = totalExpenses - sumOfCategoryExpenses;
  const net = totalIncome - totalExpenses;
  const avgMonthlySpend = months.length > 0 ? totalExpenses / months.length : 0;

  // Calculate difference between month.income and sum of income category activities
  // This tells us if YNAB includes income sources we're not seeing in categories
  const incomeVsCategoryDiff = totalIncome - sumOfIncomeCategories;

  return {
    totalIncome,
    totalExpenses,
    sumOfCategoryExpenses, // Sum of individual category activities (for debugging)
    activityVsCategoryDiff, // Diff between month.activity and sum of categories
    net,
    avgMonthlySpend,
    categoryTotals,
    monthCount: months.length,
    // New income diagnostics
    sumOfIncomeCategories, // Sum of positive activities in income categories
    incomeCategoryTotals, // Breakdown by income category
    incomeVsCategoryDiff, // Diff between month.income and sum of income categories
  };
}

/**
 * Get YNAB comparison data for a specific period
 * This is the main function to use for Debug Drawer comparison
 * @param {Array} months - YNAB months array from useFinanceData
 * @param {string} period - Period string (e.g., 'last6months')
 * @returns {Object} YNAB data formatted for comparison
 */
export function getYNABComparisonData(months, period) {
  const { start, end } = getDateRange(period);
  const monthsInRange = getMonthsInRange(months, period);
  const totals = calculateYNABTotals(monthsInRange);

  return {
    ...totals,
    period,
    dateRange: {
      start: start?.toISOString().slice(0, 10),
      end: end?.toISOString().slice(0, 10) || 'today',
    },
    monthsUsed: monthsInRange.map(m => m.month),
  };
}

/**
 * Compare app data with YNAB data
 * @param {Object} appData - App calculated data
 * @param {Object} ynabData - YNAB comparison data
 * @returns {Object} Comparison results with discrepancies
 */
export function compareWithYNAB(appData, ynabData) {
  const tolerance = 0.01; // $0.01 tolerance

  const comparisons = {
    totalIncome: {
      app: appData.totalIncome,
      ynab: ynabData.totalIncome,
      diff: appData.totalIncome - ynabData.totalIncome,
      matches: Math.abs(appData.totalIncome - ynabData.totalIncome) <= tolerance,
    },
    totalExpenses: {
      app: appData.totalExpenses,
      ynab: ynabData.totalExpenses,
      diff: appData.totalExpenses - ynabData.totalExpenses,
      matches: Math.abs(appData.totalExpenses - ynabData.totalExpenses) <= tolerance,
    },
    avgMonthlySpend: {
      app: appData.avgMonthlySpend,
      ynab: ynabData.avgMonthlySpend,
      diff: appData.avgMonthlySpend - ynabData.avgMonthlySpend,
      matches: Math.abs(appData.avgMonthlySpend - ynabData.avgMonthlySpend) <= tolerance,
    },
    monthCount: {
      app: appData.monthCount,
      ynab: ynabData.monthCount,
      matches: appData.monthCount === ynabData.monthCount,
    },
  };

  const allMatch = Object.values(comparisons).every(c => c.matches);

  return {
    comparisons,
    allMatch,
    summary: {
      totalDiscrepancy: comparisons.totalExpenses.diff,
      avgMonthlyDiscrepancy: comparisons.avgMonthlySpend.diff,
    },
  };
}
