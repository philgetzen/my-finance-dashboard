import { describe, test, expect } from 'vitest';
import {
  mapGroupNameToBucket,
  inferBucketFromKeywords,
  getCategoryBucket,
  mapCategoriesToBuckets,
  groupCategoriesByBucket,
  calculateBucketTotals,
  getBucketInfo,
  calculateCSPPercentages,
} from '../../utils/calculations/categories';

// Test fixtures
const createCategory = (overrides = {}) => ({
  id: 'cat-1',
  name: 'Test Category',
  category_group_name: 'Test Group',
  ...overrides
});

const createTransaction = (overrides = {}) => ({
  id: 'txn-1',
  date: '2025-10-15',
  amount: -50000, // $50 expense
  category_id: 'cat-1',
  category_name: 'Test Category',
  ...overrides
});

describe('mapGroupNameToBucket', () => {
  test('maps known group names to buckets', () => {
    expect(mapGroupNameToBucket('Fixed Costs')).toBe('fixedCosts');
    expect(mapGroupNameToBucket('Bills')).toBe('fixedCosts');
    expect(mapGroupNameToBucket('Investments')).toBe('investments');
    expect(mapGroupNameToBucket('Post Tax Investments')).toBe('investments');
    expect(mapGroupNameToBucket('Savings')).toBe('savings');
    expect(mapGroupNameToBucket('Guilt-Free Spending')).toBe('guiltFree');
    expect(mapGroupNameToBucket('Fun Money')).toBe('guiltFree');
  });

  test('is case-insensitive', () => {
    expect(mapGroupNameToBucket('FIXED COSTS')).toBe('fixedCosts');
    expect(mapGroupNameToBucket('savings')).toBe('savings');
    expect(mapGroupNameToBucket('Guilt-Free')).toBe('guiltFree');
  });

  test('returns null for unknown groups', () => {
    expect(mapGroupNameToBucket('Unknown Group')).toBeNull();
    expect(mapGroupNameToBucket('')).toBeNull();
    expect(mapGroupNameToBucket(null)).toBeNull();
  });
});

describe('inferBucketFromKeywords', () => {
  test('identifies investment categories', () => {
    expect(inferBucketFromKeywords('401k Contribution')).toBe('investments');
    expect(inferBucketFromKeywords('Roth IRA')).toBe('investments');
    expect(inferBucketFromKeywords('Stock Purchase')).toBe('investments');
  });

  test('identifies savings categories', () => {
    expect(inferBucketFromKeywords('Emergency Fund')).toBe('savings');
    expect(inferBucketFromKeywords('Vacation Savings')).toBe('savings');
    expect(inferBucketFromKeywords('House Down Payment')).toBe('savings');
  });

  test('identifies fixed cost categories', () => {
    expect(inferBucketFromKeywords('Rent')).toBe('fixedCosts');
    expect(inferBucketFromKeywords('Electric Bill')).toBe('fixedCosts');
    expect(inferBucketFromKeywords('Car Insurance')).toBe('fixedCosts');
    expect(inferBucketFromKeywords('Groceries')).toBe('fixedCosts');
  });

  test('defaults to guilt-free for unmatched', () => {
    expect(inferBucketFromKeywords('Random Category')).toBe('guiltFree');
    expect(inferBucketFromKeywords('')).toBe('guiltFree');
    expect(inferBucketFromKeywords(null)).toBe('guiltFree');
  });
});

describe('getCategoryBucket', () => {
  test('uses custom mapping when provided', () => {
    const category = createCategory({ id: 'cat-1', name: 'Some Category' });
    const customMappings = { 'cat-1': 'investments' };

    expect(getCategoryBucket(category, customMappings)).toBe('investments');
  });

  test('uses group name mapping as fallback', () => {
    const category = createCategory({ category_group_name: 'Fixed Costs' });

    expect(getCategoryBucket(category)).toBe('fixedCosts');
  });

  test('uses keyword inference when enabled', () => {
    const category = createCategory({
      name: 'Rent Payment',
      category_group_name: 'Unknown Group'
    });

    expect(getCategoryBucket(category, {}, true)).toBe('fixedCosts');
  });

  test('defaults to guiltFree when no match', () => {
    const category = createCategory({
      name: 'Random',
      category_group_name: 'Unknown'
    });

    expect(getCategoryBucket(category, {}, false)).toBe('guiltFree');
  });

  test('returns null for income categories', () => {
    const category = createCategory({ name: 'Inflow: Ready to Assign' });
    expect(getCategoryBucket(category)).toBeNull();
  });

  test('handles both name and category_name fields', () => {
    const withName = { name: 'Rent', category_group_name: 'Fixed Costs' };
    const withCategoryName = { category_name: 'Rent', category_group_name: 'Fixed Costs' };

    expect(getCategoryBucket(withName)).toBe('fixedCosts');
    expect(getCategoryBucket(withCategoryName)).toBe('fixedCosts');
  });
});

describe('mapCategoriesToBuckets', () => {
  test('creates mapping of category IDs to buckets', () => {
    const categories = [
      createCategory({ id: 'cat-1', category_group_name: 'Fixed Costs' }),
      createCategory({ id: 'cat-2', category_group_name: 'Savings' }),
      createCategory({ id: 'cat-3', category_group_name: 'Investments' }),
    ];

    const mapping = mapCategoriesToBuckets(categories);

    expect(mapping['cat-1']).toBe('fixedCosts');
    expect(mapping['cat-2']).toBe('savings');
    expect(mapping['cat-3']).toBe('investments');
  });

  test('respects custom mappings', () => {
    const categories = [
      createCategory({ id: 'cat-1', category_group_name: 'Unknown' }),
    ];
    const customMappings = { 'cat-1': 'savings' };

    const mapping = mapCategoriesToBuckets(categories, customMappings);
    expect(mapping['cat-1']).toBe('savings');
  });

  test('returns empty object for empty input', () => {
    expect(mapCategoriesToBuckets([])).toEqual({});
    expect(mapCategoriesToBuckets(null)).toEqual({});
  });
});

describe('groupCategoriesByBucket', () => {
  test('groups categories into bucket arrays', () => {
    const categories = [
      createCategory({ id: 'cat-1', name: 'Rent', category_group_name: 'Fixed Costs' }),
      createCategory({ id: 'cat-2', name: 'Electric', category_group_name: 'Fixed Costs' }),
      createCategory({ id: 'cat-3', name: 'IRA', category_group_name: 'Investments' }),
      createCategory({ id: 'cat-4', name: 'Fun', category_group_name: 'Guilt-Free' }),
    ];

    const groups = groupCategoriesByBucket(categories);

    expect(groups.fixedCosts).toHaveLength(2);
    expect(groups.investments).toHaveLength(1);
    expect(groups.guiltFree).toHaveLength(1);
    expect(groups.savings).toHaveLength(0);
  });

  test('initializes all buckets even if empty', () => {
    const groups = groupCategoriesByBucket([]);

    expect(groups).toHaveProperty('fixedCosts');
    expect(groups).toHaveProperty('investments');
    expect(groups).toHaveProperty('savings');
    expect(groups).toHaveProperty('guiltFree');
  });
});

describe('calculateBucketTotals', () => {
  test('calculates totals for each bucket', () => {
    const transactions = [
      createTransaction({ amount: -50000, category_id: 'cat-1', category_name: 'Rent' }),
      createTransaction({ amount: -25000, category_id: 'cat-1', category_name: 'Rent' }),
      createTransaction({ amount: -100000, category_id: 'cat-2', category_name: 'IRA' }),
    ];
    const categoryToBucket = {
      'cat-1': 'fixedCosts',
      'cat-2': 'investments'
    };

    const totals = calculateBucketTotals(transactions, categoryToBucket);

    expect(totals.fixedCosts.total).toBe(75); // $50 + $25
    expect(totals.fixedCosts.count).toBe(2);
    expect(totals.investments.total).toBe(100);
    expect(totals.investments.count).toBe(1);
  });

  test('handles refunds correctly', () => {
    const transactions = [
      createTransaction({ amount: -50000, category_id: 'cat-1' }), // $50 expense
      createTransaction({ amount: 10000, category_id: 'cat-1' }), // $10 refund
    ];
    const categoryToBucket = { 'cat-1': 'fixedCosts' };

    const totals = calculateBucketTotals(transactions, categoryToBucket);

    expect(totals.fixedCosts.total).toBe(40); // $50 - $10
  });

  test('excludes income transactions', () => {
    const transactions = [
      createTransaction({ amount: -50000, category_name: 'Rent', category_id: 'cat-1' }),
      createTransaction({ amount: 3000000, category_name: 'Inflow: Ready to Assign', category_id: 'cat-income' }),
    ];
    const categoryToBucket = { 'cat-1': 'fixedCosts' };

    const totals = calculateBucketTotals(transactions, categoryToBucket);

    expect(totals.fixedCosts.total).toBe(50);
    // Income should not appear in any bucket
    const totalAllBuckets = Object.values(totals).reduce((sum, b) => sum + b.total, 0);
    expect(totalAllBuckets).toBe(50);
  });

  test('tracks category breakdown within buckets', () => {
    const transactions = [
      createTransaction({ amount: -50000, category_id: 'cat-1', category_name: 'Rent' }),
      createTransaction({ amount: -25000, category_id: 'cat-2', category_name: 'Electric' }),
    ];
    const categoryToBucket = {
      'cat-1': 'fixedCosts',
      'cat-2': 'fixedCosts'
    };

    const totals = calculateBucketTotals(transactions, categoryToBucket);

    expect(totals.fixedCosts.categories['Rent'].total).toBe(50);
    expect(totals.fixedCosts.categories['Electric'].total).toBe(25);
  });

  test('defaults unmapped categories to guiltFree', () => {
    const transactions = [
      createTransaction({ amount: -50000, category_id: 'unmapped', category_name: 'Random' }),
    ];

    const totals = calculateBucketTotals(transactions, {});

    expect(totals.guiltFree.total).toBe(50);
  });

  test('returns zeros for empty input', () => {
    const totals = calculateBucketTotals([], {});

    expect(totals.fixedCosts.total).toBe(0);
    expect(totals.investments.total).toBe(0);
    expect(totals.savings.total).toBe(0);
    expect(totals.guiltFree.total).toBe(0);
  });
});

describe('getBucketInfo', () => {
  test('returns display info for known buckets', () => {
    const fixedInfo = getBucketInfo('fixedCosts');
    expect(fixedInfo.label).toBe('Fixed Costs');
    expect(fixedInfo.color).toBeDefined();

    const investInfo = getBucketInfo('investments');
    expect(investInfo.label).toBe('Investments');
  });

  test('returns default for unknown bucket', () => {
    const info = getBucketInfo('unknownBucket');
    expect(info.key).toBe('unknownBucket');
    expect(info.color).toBe('#6B7280'); // Gray default
  });
});

describe('calculateCSPPercentages', () => {
  test('calculates percentages of income', () => {
    const bucketTotals = {
      fixedCosts: { total: 5000 },
      investments: { total: 1000 },
      savings: { total: 500 },
      guiltFree: { total: 2500 }
    };
    const totalIncome = 10000;

    const result = calculateCSPPercentages(bucketTotals, totalIncome);

    expect(result.fixedCosts.percentage).toBe(50);
    expect(result.investments.percentage).toBe(10);
    expect(result.savings.percentage).toBe(5);
    expect(result.guiltFree.percentage).toBe(25);
  });

  test('handles zero income', () => {
    const bucketTotals = {
      fixedCosts: { total: 500 },
      investments: { total: 0 },
      savings: { total: 0 },
      guiltFree: { total: 0 }
    };

    const result = calculateCSPPercentages(bucketTotals, 0);

    expect(result.fixedCosts.percentage).toBe(0);
  });

  test('rounds percentages to one decimal', () => {
    const bucketTotals = {
      fixedCosts: { total: 3333 },
    };

    const result = calculateCSPPercentages(bucketTotals, 10000);

    expect(result.fixedCosts.percentage).toBe(33.3);
  });
});
