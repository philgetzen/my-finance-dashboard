/**
 * Category utility functions for CSP bucket mapping
 * Handles mapping YNAB categories to Conscious Spending Plan buckets
 */

import {
  GROUP_NAME_TO_BUCKET,
  DEFAULT_FIXED_COST_KEYWORDS,
  DEFAULT_INVESTMENT_KEYWORDS,
  DEFAULT_SAVINGS_KEYWORDS,
  CSP_BUCKETS,
  isIncomeCategory,
} from './constants';

/**
 * Normalize a string for comparison (lowercase, remove special chars)
 * @param {string} str - String to normalize
 * @returns {string} - Normalized string
 */
function normalizeString(str) {
  return (str || '').toLowerCase().trim();
}

/**
 * Map a category group name to a CSP bucket using known mappings
 * @param {string} groupName - YNAB category group name
 * @returns {string|null} - CSP bucket key or null if no match
 */
export function mapGroupNameToBucket(groupName) {
  if (!groupName) return null;

  const normalized = normalizeString(groupName);
  return GROUP_NAME_TO_BUCKET[normalized] || null;
}

/**
 * Infer a CSP bucket from category name using keywords
 * Used as fallback when no explicit mapping exists
 * @param {string} categoryName - Category name to analyze
 * @returns {string} - CSP bucket key (defaults to 'guiltFree')
 */
export function inferBucketFromKeywords(categoryName) {
  if (!categoryName) return 'guiltFree';

  const normalized = normalizeString(categoryName);

  // Check investment keywords first (most specific)
  if (DEFAULT_INVESTMENT_KEYWORDS.some(kw => normalized.includes(kw))) {
    return 'investments';
  }

  // Check savings keywords
  if (DEFAULT_SAVINGS_KEYWORDS.some(kw => normalized.includes(kw))) {
    return 'savings';
  }

  // Check fixed cost keywords
  if (DEFAULT_FIXED_COST_KEYWORDS.some(kw => normalized.includes(kw))) {
    return 'fixedCosts';
  }

  // Default to guilt-free spending
  return 'guiltFree';
}

/**
 * Get the CSP bucket for a category
 * Uses a priority order: custom mapping > group name > keyword inference
 * @param {object} category - Category object with name and group info
 * @param {Object} [customMappings] - User-defined category-to-bucket mappings
 * @param {boolean} [useKeywordFallback=false] - Whether to use keyword inference
 * @returns {string} - CSP bucket key
 */
export function getCategoryBucket(category, customMappings = {}, useKeywordFallback = false) {
  if (!category) return 'guiltFree';

  const categoryName = category.name || category.category_name;
  const groupName = category.category_group_name || category.group_name;

  // Skip income categories - they don't belong in CSP buckets
  if (isIncomeCategory(categoryName)) {
    return null;
  }

  // Priority 1: Check custom mappings by category ID or name
  if (customMappings) {
    if (category.id && customMappings[category.id]) {
      return customMappings[category.id];
    }
    if (categoryName && customMappings[categoryName]) {
      return customMappings[categoryName];
    }
  }

  // Priority 2: Check group name mapping
  const groupBucket = mapGroupNameToBucket(groupName);
  if (groupBucket) {
    return groupBucket;
  }

  // Priority 3: Keyword inference (if enabled)
  if (useKeywordFallback) {
    return inferBucketFromKeywords(categoryName);
  }

  // Default: guilt-free spending
  return 'guiltFree';
}

/**
 * Map all categories to their CSP buckets
 * @param {Array} categories - Array of category objects
 * @param {Object} [customMappings] - User-defined mappings
 * @param {boolean} [useKeywordFallback=false] - Whether to use keyword inference
 * @returns {Object} - Map of category_id -> bucket key
 */
export function mapCategoriesToBuckets(categories, customMappings = {}, useKeywordFallback = false) {
  if (!categories?.length) return {};

  const mapping = {};

  categories.forEach(category => {
    const bucket = getCategoryBucket(category, customMappings, useKeywordFallback);
    if (bucket && category.id) {
      mapping[category.id] = bucket;
    }
  });

  return mapping;
}

/**
 * Group categories by their CSP bucket
 * @param {Array} categories - Array of category objects
 * @param {Object} [customMappings] - User-defined mappings
 * @param {boolean} [useKeywordFallback=false] - Whether to use keyword inference
 * @returns {Object} - Map of bucket key -> array of categories
 */
export function groupCategoriesByBucket(categories, customMappings = {}, useKeywordFallback = false) {
  // Always initialize all buckets
  const groups = {
    fixedCosts: [],
    investments: [],
    savings: [],
    guiltFree: []
  };

  if (!categories?.length) return groups;

  categories.forEach(category => {
    const bucket = getCategoryBucket(category, customMappings, useKeywordFallback);
    if (bucket && groups[bucket]) {
      groups[bucket].push(category);
    }
  });

  return groups;
}

/**
 * Calculate totals for each CSP bucket from transactions
 * @param {Array} transactions - Processed transactions
 * @param {Object} categoryToBucket - Map of category_id -> bucket key
 * @returns {Object} - Map of bucket key -> { total, count, categories }
 */
export function calculateBucketTotals(transactions, categoryToBucket) {
  if (!transactions?.length) {
    return {
      fixedCosts: { total: 0, count: 0, categories: {} },
      investments: { total: 0, count: 0, categories: {} },
      savings: { total: 0, count: 0, categories: {} },
      guiltFree: { total: 0, count: 0, categories: {} }
    };
  }

  const buckets = {
    fixedCosts: { total: 0, count: 0, categories: {} },
    investments: { total: 0, count: 0, categories: {} },
    savings: { total: 0, count: 0, categories: {} },
    guiltFree: { total: 0, count: 0, categories: {} }
  };

  transactions.forEach(txn => {
    // Skip income transactions
    if (isIncomeCategory(txn.category_name)) return;

    const amount = (txn.amount || 0) / 1000;
    const bucket = categoryToBucket[txn.category_id] || 'guiltFree';
    const categoryName = txn.category_name || 'Uncategorized';

    if (!buckets[bucket]) return;

    // Track expense amounts (outflows are negative in YNAB)
    if (amount < 0) {
      const expenseAmount = Math.abs(amount);
      buckets[bucket].total += expenseAmount;
      buckets[bucket].count += 1;

      // Track by category
      if (!buckets[bucket].categories[categoryName]) {
        buckets[bucket].categories[categoryName] = { total: 0, count: 0 };
      }
      buckets[bucket].categories[categoryName].total += expenseAmount;
      buckets[bucket].categories[categoryName].count += 1;
    } else if (amount > 0) {
      // Refund - reduces the bucket total
      buckets[bucket].total -= amount;

      if (!buckets[bucket].categories[categoryName]) {
        buckets[bucket].categories[categoryName] = { total: 0, count: 0 };
      }
      buckets[bucket].categories[categoryName].total -= amount;
    }
  });

  return buckets;
}

/**
 * Get bucket display info (label, color)
 * @param {string} bucketKey - CSP bucket key
 * @returns {Object} - Bucket display info
 */
export function getBucketInfo(bucketKey) {
  return CSP_BUCKETS[bucketKey] || { key: bucketKey, label: bucketKey, color: '#6B7280' };
}

/**
 * Calculate CSP percentages from bucket totals and income
 * @param {Object} bucketTotals - Map of bucket key -> { total }
 * @param {number} totalIncome - Total income for the period
 * @returns {Object} - Map of bucket key -> { total, percentage }
 */
export function calculateCSPPercentages(bucketTotals, totalIncome) {
  const result = {};

  Object.entries(bucketTotals).forEach(([bucket, data]) => {
    const percentage = totalIncome > 0 ? (data.total / totalIncome) * 100 : 0;
    result[bucket] = {
      ...data,
      percentage: Math.round(percentage * 10) / 10 // Round to 1 decimal
    };
  });

  return result;
}
