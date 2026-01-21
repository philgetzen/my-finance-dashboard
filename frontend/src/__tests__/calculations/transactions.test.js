import { describe, test, expect } from 'vitest';
import {
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
} from '../../utils/calculations/transactions';

// Test fixtures - hand-verified transaction data
const createTransaction = (overrides = {}) => ({
  id: 'txn-1',
  date: '2025-10-15',
  amount: -50000, // $50 expense (YNAB uses milliunits)
  payee_name: 'Test Payee',
  category_id: 'cat-1',
  category_name: 'Groceries',
  account_id: 'acc-1',
  transfer_account_id: null,
  ...overrides
});

// Use ISO format with time to avoid timezone issues (treated as local time)
const sampleTransactions = [
  // Regular expense
  createTransaction({ id: 'txn-1', amount: -50000, category_name: 'Groceries', date: '2025-10-02T12:00:00' }),
  // Income
  createTransaction({ id: 'txn-2', amount: 3000000, category_name: 'Inflow: Ready to Assign', date: '2025-10-05T12:00:00' }),
  // Another expense
  createTransaction({ id: 'txn-3', amount: -25000, category_name: 'Dining Out', date: '2025-10-10T12:00:00' }),
  // Refund (positive amount, non-income category)
  createTransaction({ id: 'txn-4', amount: 10000, category_name: 'Groceries', date: '2025-10-12T12:00:00' }),
  // Internal transfer
  createTransaction({ id: 'txn-5', amount: -100000, category_name: 'Transfer', transfer_account_id: 'acc-2', date: '2025-10-15T12:00:00' }),
  // Expense in different month
  createTransaction({ id: 'txn-6', amount: -75000, category_name: 'Utilities', date: '2025-11-05T12:00:00' }),
];

describe('getTransactionAmount', () => {
  test('converts milliunits to dollars', () => {
    expect(getTransactionAmount({ amount: 50000 })).toBe(50);
    expect(getTransactionAmount({ amount: -25000 })).toBe(-25);
    expect(getTransactionAmount({ amount: 1500 })).toBe(1.5);
  });

  test('handles zero and missing amounts', () => {
    expect(getTransactionAmount({ amount: 0 })).toBe(0);
    expect(getTransactionAmount({})).toBe(0);
  });
});

describe('filterByDateRange', () => {
  test('filters transactions within date range', () => {
    const start = new Date(2025, 9, 1); // Oct 1, 2025
    const end = new Date(2025, 9, 31); // Oct 31, 2025

    const filtered = filterByDateRange(sampleTransactions, start, end);

    expect(filtered).toHaveLength(5); // All October transactions
    expect(filtered.find(t => t.id === 'txn-6')).toBeUndefined(); // November excluded
  });

  test('handles null end date (up to today)', () => {
    const start = new Date(2025, 9, 1);
    const filtered = filterByDateRange(sampleTransactions, start, null);

    expect(filtered.length).toBeGreaterThan(0);
  });

  test('returns empty array for empty input', () => {
    expect(filterByDateRange([], new Date(), new Date())).toEqual([]);
    expect(filterByDateRange(null, new Date(), new Date())).toEqual([]);
  });
});

describe('filterByCategory', () => {
  test('filters by single category', () => {
    const filtered = filterByCategory(sampleTransactions, 'Groceries');
    expect(filtered).toHaveLength(2); // expense + refund
  });

  test('filters by multiple categories', () => {
    const filtered = filterByCategory(sampleTransactions, ['Groceries', 'Dining Out']);
    expect(filtered).toHaveLength(3);
  });

  test('returns empty for non-existent category', () => {
    const filtered = filterByCategory(sampleTransactions, 'NonExistent');
    expect(filtered).toHaveLength(0);
  });
});

describe('filterByType', () => {
  test('filters income transactions', () => {
    const filtered = filterByType(sampleTransactions, 'income');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].category_name).toBe('Inflow: Ready to Assign');
  });

  test('filters expense transactions (excludes income)', () => {
    const filtered = filterByType(sampleTransactions, 'expense');
    expect(filtered).toHaveLength(5); // All non-income
    expect(filtered.find(t => t.category_name === 'Inflow: Ready to Assign')).toBeUndefined();
  });

  test('returns all for type "all"', () => {
    const filtered = filterByType(sampleTransactions, 'all');
    expect(filtered).toHaveLength(sampleTransactions.length);
  });
});

describe('excludeTransfers', () => {
  test('excludes internal transfers', () => {
    const filtered = excludeTransfers(sampleTransactions);
    expect(filtered).toHaveLength(5); // Transfer excluded
    expect(filtered.find(t => t.id === 'txn-5')).toBeUndefined();
  });

  test('keeps transfers to investment accounts', () => {
    const investmentIds = new Set(['acc-2']);
    const filtered = excludeTransfers(sampleTransactions, investmentIds);
    expect(filtered).toHaveLength(6); // Transfer to investment kept
  });
});

describe('excludeInvestmentAccounts', () => {
  test('excludes transactions from investment accounts', () => {
    const investmentIds = new Set(['acc-1']);
    const filtered = excludeInvestmentAccounts(sampleTransactions, investmentIds);
    expect(filtered).toHaveLength(0); // All transactions are from acc-1
  });

  test('keeps transactions from non-investment accounts', () => {
    const investmentIds = new Set(['other-acc']);
    const filtered = excludeInvestmentAccounts(sampleTransactions, investmentIds);
    expect(filtered).toHaveLength(sampleTransactions.length);
  });
});

describe('excludeSystemTransactions', () => {
  test('excludes reconciliation transactions', () => {
    const withReconciliation = [
      ...sampleTransactions,
      createTransaction({ id: 'recon', payee_name: 'Reconciliation Balance Adjustment' })
    ];
    const filtered = excludeSystemTransactions(withReconciliation);
    expect(filtered.find(t => t.id === 'recon')).toBeUndefined();
  });

  test('excludes starting balance transactions', () => {
    const withStarting = [
      ...sampleTransactions,
      createTransaction({ id: 'start', payee_name: 'Starting Balance' })
    ];
    const filtered = excludeSystemTransactions(withStarting);
    expect(filtered.find(t => t.id === 'start')).toBeUndefined();
  });
});

describe('sumTransactions', () => {
  test('sums all transaction amounts', () => {
    const transactions = [
      createTransaction({ amount: -50000 }),
      createTransaction({ amount: 100000 }),
      createTransaction({ amount: -25000 })
    ];
    expect(sumTransactions(transactions)).toBe(25); // -50 + 100 - 25 = 25
  });

  test('returns 0 for empty array', () => {
    expect(sumTransactions([])).toBe(0);
    expect(sumTransactions(null)).toBe(0);
  });
});

describe('sumExpenses', () => {
  test('sums only expense outflows as positive number', () => {
    const transactions = [
      createTransaction({ amount: -50000, category_name: 'Groceries' }), // $50 expense
      createTransaction({ amount: -25000, category_name: 'Dining Out' }), // $25 expense
    ];
    expect(sumExpenses(transactions)).toBe(75);
  });

  test('excludes income from expense total', () => {
    const transactions = [
      createTransaction({ amount: -50000, category_name: 'Groceries' }),
      createTransaction({ amount: 3000000, category_name: 'Inflow: Ready to Assign' }), // Income - excluded
    ];
    expect(sumExpenses(transactions)).toBe(50);
  });

  test('refunds reduce expense total', () => {
    const transactions = [
      createTransaction({ amount: -50000, category_name: 'Groceries' }), // $50 expense
      createTransaction({ amount: 10000, category_name: 'Groceries' }), // $10 refund
    ];
    expect(sumExpenses(transactions)).toBe(40); // 50 - 10 = 40
  });
});

describe('sumIncome', () => {
  test('sums only income category transactions', () => {
    const transactions = [
      createTransaction({ amount: 3000000, category_name: 'Inflow: Ready to Assign' }),
      createTransaction({ amount: 500000, category_name: 'Ready to Assign' }),
      createTransaction({ amount: -50000, category_name: 'Groceries' }), // Expense - excluded
    ];
    expect(sumIncome(transactions)).toBe(3500); // 3000 + 500
  });

  test('returns 0 when no income transactions', () => {
    const transactions = [
      createTransaction({ amount: -50000, category_name: 'Groceries' }),
    ];
    expect(sumIncome(transactions)).toBe(0);
  });
});

describe('groupByCategory', () => {
  test('groups transactions by category name', () => {
    const grouped = groupByCategory(sampleTransactions);

    expect(Object.keys(grouped)).toContain('Groceries');
    expect(Object.keys(grouped)).toContain('Dining Out');
    expect(grouped['Groceries']).toHaveLength(2);
  });

  test('handles uncategorized transactions', () => {
    const transactions = [
      createTransaction({ category_name: null }),
      createTransaction({ category_name: undefined }),
    ];
    const grouped = groupByCategory(transactions);
    expect(grouped['Uncategorized']).toHaveLength(2);
  });
});

describe('groupByMonth', () => {
  test('groups transactions by YYYY-MM', () => {
    const grouped = groupByMonth(sampleTransactions);

    expect(Object.keys(grouped)).toContain('2025-10');
    expect(Object.keys(grouped)).toContain('2025-11');
    expect(grouped['2025-10']).toHaveLength(5);
    expect(grouped['2025-11']).toHaveLength(1);
  });
});

describe('getMonthlyTotals', () => {
  test('calculates income, expenses, and net for each month', () => {
    const totals = getMonthlyTotals(sampleTransactions);

    expect(totals['2025-10']).toBeDefined();
    expect(totals['2025-10'].income).toBe(3000); // $3000 income
    // Expenses: $50 + $25 - $10 (refund) + $100 (transfer) = $165
    // But transfer is included here since we haven't filtered
    expect(totals['2025-10'].expenses).toBe(165);
  });
});

describe('getCategoryTotals', () => {
  test('returns totals with transaction details', () => {
    const totals = getCategoryTotals(sampleTransactions);

    expect(totals['Groceries']).toBeDefined();
    expect(totals['Groceries'].count).toBe(2);
    expect(totals['Groceries'].total).toBe(-40); // -50 + 10 refund
    expect(totals['Groceries'].transactions).toHaveLength(2);
  });
});

describe('flattenSubtransactions', () => {
  test('expands split transactions', () => {
    const transactions = [
      createTransaction({
        id: 'parent',
        subtransactions: [
          { id: 'sub-1', amount: -25000, category_name: 'Groceries' },
          { id: 'sub-2', amount: -25000, category_name: 'Household' }
        ]
      })
    ];

    const flattened = flattenSubtransactions(transactions);

    expect(flattened).toHaveLength(2);
    expect(flattened[0].category_name).toBe('Groceries');
    expect(flattened[1].category_name).toBe('Household');
    expect(flattened[0]._parentId).toBe('parent');
  });

  test('inherits parent properties when missing', () => {
    const transactions = [
      createTransaction({
        id: 'parent',
        payee_name: 'Parent Payee',
        date: '2025-10-15',
        subtransactions: [
          { id: 'sub-1', amount: -25000 } // No payee_name or date
        ]
      })
    ];

    const flattened = flattenSubtransactions(transactions);

    expect(flattened[0].payee_name).toBe('Parent Payee');
    expect(flattened[0].date).toBe('2025-10-15');
  });

  test('keeps transactions without subtransactions as-is', () => {
    const transactions = [createTransaction({ id: 'simple' })];
    const flattened = flattenSubtransactions(transactions);

    expect(flattened).toHaveLength(1);
    expect(flattened[0].id).toBe('simple');
  });
});

describe('processTransactions', () => {
  test('applies all standard filters', () => {
    const transactions = [
      createTransaction({ id: 'normal', amount: -50000 }),
      createTransaction({ id: 'transfer', transfer_account_id: 'other-acc' }),
      createTransaction({ id: 'recon', payee_name: 'Reconciliation Balance Adjustment' }),
    ];

    const processed = processTransactions(transactions);

    expect(processed).toHaveLength(1);
    expect(processed[0].id).toBe('normal');
  });

  test('respects date range option', () => {
    const processed = processTransactions(sampleTransactions, {
      startDate: new Date(2025, 9, 1),
      endDate: new Date(2025, 9, 31)
    });

    expect(processed.find(t => t.id === 'txn-6')).toBeUndefined(); // Nov transaction excluded
  });

  test('flattens subtransactions by default', () => {
    const transactions = [
      createTransaction({
        subtransactions: [
          { id: 'sub-1', amount: -25000, category_name: 'Groceries' },
          { id: 'sub-2', amount: -25000, category_name: 'Household' }
        ]
      })
    ];

    const processed = processTransactions(transactions);
    expect(processed).toHaveLength(2);
  });

  test('can disable subtransaction flattening', () => {
    const transactions = [
      createTransaction({
        subtransactions: [
          { id: 'sub-1', amount: -25000 },
          { id: 'sub-2', amount: -25000 }
        ]
      })
    ];

    const processed = processTransactions(transactions, { flattenSplits: false });
    expect(processed).toHaveLength(1);
  });
});
