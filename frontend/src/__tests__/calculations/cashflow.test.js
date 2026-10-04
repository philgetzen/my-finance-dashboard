import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../../firebase', () => ({ db: {}, auth: {} }));
vi.mock('../../contexts/ConsolidatedDataContext', () => ({ useFinanceData: () => ({}) }));

import { classifyTransactions, summarizeLines, parseLocalDate, isInvestmentAccount } from '../../utils/calculations/cashflow';
import { mapGroupNameToBucket } from '../../utils/calculations/categories';
import { useTransactionProcessor } from '../../hooks/useTransactionProcessor';
import { useRunwayCalculator } from '../../hooks/useRunwayCalculator';
import { useConsciousSpendingPlan } from '../../hooks/useConsciousSpendingPlan';
import { useAccountManager } from '../../hooks/useAccountManager';
import { calculateScenarioMonthlyIncome } from '../../hooks/useIncomeScenario';
import { signPrefix } from '../../utils/formatters';
import { useCategoryProcessor, INVESTING_GROUP_NAME } from '../../hooks/useCategoryProcessor';

// Oct 2, 2026, local noon
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 2, 12, 0, 0));
});
afterAll(() => vi.useRealTimers());

const accounts = [
  { id: 'chk', name: 'BoA Checking Joint', type: 'checking', on_budget: true, balance: 30000000 },
  { id: 'schwab', name: 'Schwab Investor Checking Phil', type: 'checking', on_budget: true, balance: 0 },
  { id: 'card', name: 'Chase Sapphire Reserve', type: 'creditCard', on_budget: true, balance: -1000000 },
  { id: 'brokerage', name: 'Brokerage', type: 'otherAsset', on_budget: false, balance: 100000000 },
  { id: 'vanguard', name: 'Vanguard Roth IRA', type: 'otherAsset', on_budget: false, balance: 0 },
  { id: 'home', name: '8331 Home Value', type: 'otherAsset', on_budget: false, balance: 900000000 },
  { id: 'mortgage', name: '8331 Mortgage', type: 'mortgage', on_budget: false, balance: -500000000 }
];

const categories = {
  category_groups: [
    { name: 'Internal Master Category', categories: [{ id: 'rta', name: 'Inflow: Ready to Assign' }] },
    { name: '🔗 Fixed Costs', categories: [{ id: 'rent', name: 'Rent' }, { id: 'mort', name: '8331 Mortgage' }, { id: 'groc', name: 'Groceries' }] },
    { name: '👩🏽‍❤️‍👨🏼 Family Guilt Free Spending', categories: [{ id: 'fun', name: 'Fun' }] },
    { name: '🤑 Post Tax Investments', categories: [{ id: 'roth', name: 'Roth IRA' }] }
  ]
};

const names = Object.fromEntries(categories.category_groups.flatMap(g => g.categories).map(c => [c.id, c.name]));
let seq = 0;
const tx = (date, account_id, dollars, fields = {}) => ({
  id: `t${seq++}`,
  date,
  account_id,
  amount: Math.round(dollars * 1000),
  payee_name: 'Payee',
  category_id: fields.category_id || null,
  category_name: fields.category_id ? names[fields.category_id] : null,
  transfer_account_id: null,
  subtransactions: [],
  deleted: false,
  ...fields
});

const classify = transactions => classifyTransactions(transactions, { accounts, categories });

describe('cash-flow classification', () => {
  test('investment contributions are investing, not spending', () => {
    const lines = classify([
      tx('2026-09-05', 'chk', -2000, { transfer_account_id: 'brokerage', category_id: 'roth' }),
      tx('2026-09-06', 'chk', 3000, { transfer_account_id: 'brokerage', category_id: 'rta' })
    ]);
    expect(lines.map(l => l.kind)).toEqual(['investing', 'transfer']);
  });

  test('payroll contributions recorded in the investment account are investing', () => {
    const lines = classify([
      tx('2026-09-11', 'brokerage', 1375.84, { payee_name: 'Contribution' }),
      tx('2026-09-11', 'brokerage', 42.1, { payee_name: 'Dividend' }),
      tx('2026-09-11', 'home', 5000, { payee_name: 'Contribution' })
    ]);
    expect(lines.map(l => l.kind)).toEqual(['investing', 'ignored', 'ignored']);
    expect(summarizeLines(lines).investing).toBe(1375.84);
  });

  test('payments to Vanguard or Altruist are investing in any category, even uncategorized', () => {
    const lines = classify([
      tx('2026-09-04', 'schwab', -500, { category_id: 'fun', payee_name: 'Vanguard' }),
      tx('2026-09-11', 'chk', -2500, { payee_name: 'ALTRUIST FINANCIAL ACH' }),
      tx('2026-09-11', 'chk', -1500, { category_id: 'groc', payee_name: 'Poppins Payroll' })
    ]);
    expect(lines.map(l => l.kind)).toEqual(['investing', 'investing', 'spending']);
    expect(summarizeLines(lines).investing).toBe(3000);
  });

  test('a contribution paid from the budget and imported by the brokerage counts once', () => {
    const lines = classify([
      tx('2026-04-01', 'schwab', -7000, { category_id: 'roth', payee_name: 'Vanguard' }),
      tx('2026-04-03', 'vanguard', 7000, { payee_name: 'Contribution' }),
      tx('2026-05-01', 'chk', -500, { transfer_account_id: 'brokerage' }),
      tx('2026-05-02', 'brokerage', 500, { payee_name: 'Contribution' })
    ]);
    expect(lines.map(l => l.kind)).toEqual(['investing', 'ignored', 'investing', 'ignored']);
    expect(summarizeLines(lines).investing).toBe(7500);
  });

  test('equal contributions to different accounts, or more than 5 days apart, both count', () => {
    const lines = classify([
      tx('2026-10-01', 'chk', -500, { category_id: 'roth', payee_name: 'Vanguard' }),
      tx('2026-10-03', 'brokerage', 500, { payee_name: 'Contribution' }),
      tx('2026-11-01', 'chk', -700, { category_id: 'roth', payee_name: 'Vanguard' }),
      tx('2026-11-09', 'vanguard', 700, { payee_name: 'Contribution' })
    ]);
    expect(lines.every(l => l.kind === 'investing')).toBe(true);
    expect(summarizeLines(lines).investing).toBe(2400);
  });

  test('a brokerage payment in a CSP-excluded category is ignored', () => {
    const lines = classifyTransactions(
      [tx('2026-09-04', 'chk', -250, { category_id: 'fun', payee_name: 'Vanguard' })],
      { accounts, categories, cspSettings: { excludedExpenseCategories: ['fun'] } }
    );
    expect(lines[0].kind).toBe('ignored');
  });

  test('stock-sale proceeds in an investment category are a withdrawal, not negative investing', () => {
    const lines = classify([
      tx('2026-03-01', 'brokerage', 2000, { payee_name: 'Contribution' }),
      tx('2026-03-05', 'schwab', 30000, { category_id: 'roth', payee_name: 'Stock Sale' })
    ]);
    expect(lines.map(l => l.kind)).toEqual(['investing', 'transfer']);
    expect(summarizeLines(lines)).toMatchObject({ investing: 2000, income: 0 });
  });

  test('Cash Flow shows a payroll contribution as a positive investing row', () => {
    const groupMap = new Map(categories.category_groups.flatMap(g =>
      g.categories.map(c => [c.id, { groupName: g.name, categoryName: c.name }])));
    const { result } = renderHook(() => useCategoryProcessor(
      [tx('2026-09-11', 'brokerage', 1375.84, { payee_name: 'Contribution' })],
      groupMap, new Set(), 3, true, { accounts, categories }
    ));
    const group = result.current.processedCategoryGroups.find(g => g.groupName === INVESTING_GROUP_NAME);
    expect(group.categories).toMatchObject([{ category: 'Brokerage contributions', totalExpense: 1375.84 }]);
    expect(result.current.grandTotals.expenses).toBe(0);
  });

  test('categorized mortgage transfers are spending', () => {
    const lines = classify([tx('2026-09-01', 'chk', -3000, { transfer_account_id: 'mortgage', category_id: 'mort' })]);
    expect(lines[0]).toMatchObject({ kind: 'spending', bucket: 'fixedCosts' });
  });

  test('tracking-account activity is ignored', () => {
    const lines = classify([
      tx('2026-09-01', 'home', -16726, { payee_name: 'Market value change' }),
      tx('2026-09-01', 'brokerage', 500, { payee_name: 'Dividend' })
    ]);
    expect(lines.map(l => l.kind)).toEqual(['ignored', 'ignored']);
  });

  test('uncategorized transactions are flagged and budget-to-budget transfers are ignored', () => {
    const lines = classify([
      tx('2026-09-01', 'chk', -250000, { payee_name: 'Wire' }),
      tx('2026-09-02', 'chk', -800, { transfer_account_id: 'card' })
    ]);
    expect(lines.map(l => l.kind)).toEqual(['uncategorized', 'transfer']);
  });

  test('a budget account named Schwab is not an investment account', () => {
    expect(isInvestmentAccount(accounts[1])).toBe(false);
    expect(isInvestmentAccount(accounts[3])).toBe(true);
  });

  test('splits are expanded and refunds net out per category', () => {
    const lines = classify([
      tx('2026-09-20', 'card', -300, {
        category_id: 'split',
        category_name: 'Split (Multiple Categories)...',
        subtransactions: [
          { id: 's1', amount: -200000, category_id: 'groc', category_name: 'Groceries' },
          { id: 's2', amount: -100000, category_id: 'fun', category_name: 'Fun' }
        ]
      }),
      tx('2026-09-22', 'card', 40, { category_id: 'fun' })
    ]);
    const summary = summarizeLines(lines);
    expect(summary.byCategory.map(c => [c.name, c.amount])).toEqual([['Groceries', 200], ['Fun', 60]]);
    expect(summary.spending).toBe(260);
  });

  test('emoji-prefixed group names map to buckets', () => {
    expect(mapGroupNameToBucket('🔗 Fixed Costs')).toBe('fixedCosts');
    expect(mapGroupNameToBucket('🤑 Post Tax Investments')).toBe('investments');
    expect(mapGroupNameToBucket('💵 Savings')).toBe('savings');
  });

  test('YNAB dates parse as local calendar dates', () => {
    const date = parseLocalDate('2026-08-01');
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 7, 1]);
  });
});

describe('runway', () => {
  // Apr-Sep: $10k income, $3k mortgage, $2k groceries, $2k to investments; Oct 1: $100
  function steadyBudget() {
    const transactions = [];
    ['04', '05', '06', '07', '08', '09'].forEach(m => {
      transactions.push(tx(`2026-${m}-01`, 'chk', 10000, { category_id: 'rta' }));
      transactions.push(tx(`2026-${m}-01`, 'chk', -3000, { transfer_account_id: 'mortgage', category_id: 'mort' }));
      transactions.push(tx(`2026-${m}-10`, 'card', -2000, { category_id: 'groc' }));
      transactions.push(tx(`2026-${m}-20`, 'chk', -2000, { transfer_account_id: 'brokerage', category_id: 'roth' }));
    });
    transactions.push(tx('2026-10-01', 'card', -100, { category_id: 'groc' }));
    return transactions;
  }

  test('burn includes debt payments, excludes investing, and averages complete months', () => {
    const transactions = steadyBudget();
    const { result: processed } = renderHook(() =>
      useTransactionProcessor(transactions, accounts, new Set(), { categories }));
    expect(processed.current.monthlyData['2026-09']).toMatchObject({ income: 10000, expenses: 5000, investing: 2000 });
    expect(processed.current.monthlyData['2026-10'].expenses).toBe(100);

    const { result: normalized } = renderHook(() => useAccountManager(accounts, []));
    const { result } = renderHook(() =>
      useRunwayCalculator(normalized.current.allAccounts, processed.current.monthlyData, 6));
    expect(result.current.avgMonthlyExpenses).toBe(5000);
    expect(result.current.avgMonthlyIncome).toBe(10000);
    expect(result.current.cashReserves).toBe(30000);
  });

  test('manual mortgages and other assets are not cash', () => {
    const { result: normalized } = renderHook(() => useAccountManager(accounts, [
      { id: 'm1', name: 'Rental mortgage', type: 'mortgage', balance: 200000 },
      { id: 'm2', name: 'Car', type: 'other', balance: 15000 }
    ]));
    const { result } = renderHook(() => useRunwayCalculator(normalized.current.allAccounts, {}, 6));
    expect(result.current.cashReserves).toBe(30000);
  });
});

describe('net worth', () => {
  test('liabilities keep their sign and include every YNAB loan type', () => {
    const { result } = renderHook(() => useAccountManager([
      { id: 'a', name: 'Checking', type: 'checking', on_budget: true, balance: 1000000 },
      { id: 'b', name: 'Card', type: 'creditCard', on_budget: true, balance: 50000 },
      { id: 'c', name: 'Student Loans', type: 'studentLoan', on_budget: false, balance: -20000000 }
    ], []));
    expect(result.current.totals).toEqual({ assets: 1000, liabilities: 19950, netWorth: -18950 });
  });
});

describe('conscious spending plan', () => {
  const settings = {
    categoryMappings: {},
    excludedCategories: new Set(),
    excludedPayees: new Set(),
    excludedExpenseCategories: new Set(),
    settings: { includeTrackingAccounts: true, useKeywordFallback: false }
  };

  test('rent on the 1st counts, splits are expanded, and groups map without keyword fallback', () => {
    const transactions = [
      tx('2026-08-15', 'chk', 5000, { category_id: 'rta' }),
      tx('2026-08-01', 'chk', -2000, { category_id: 'rent' }),
      tx('2026-09-15', 'chk', 5000, { category_id: 'rta' }),
      tx('2026-09-01', 'chk', -2000, { category_id: 'rent' }),
      tx('2026-10-01', 'chk', -2000, { category_id: 'rent' }),
      tx('2026-09-20', 'card', -300, {
        category_id: 'split',
        category_name: 'Split (Multiple Categories)...',
        subtransactions: [
          { id: 's1', amount: -200000, category_id: 'groc', category_name: 'Groceries' },
          { id: 's2', amount: -100000, category_id: 'fun', category_name: 'Fun' }
        ]
      })
    ];
    const { result } = renderHook(() => useConsciousSpendingPlan(transactions, categories, accounts, 3, settings));
    const byName = Object.fromEntries(result.current.categoryBreakdown.map(c => [c.name, [c.amount, c.bucket]]));

    expect(byName.Rent).toEqual([6000, 'fixedCosts']);
    expect(byName.Groceries).toEqual([200, 'fixedCosts']);
    expect(byName.Fun).toEqual([100, 'guiltFree']);
    expect(byName['Split (Multiple Categories)...']).toBeUndefined();
    expect(result.current.monthlyData.map(m => [m.monthKey, m.month])).toEqual([
      ['2026-08', 'Aug'], ['2026-09', 'Sep'], ['2026-10', 'Oct']
    ]);
  });

  test('a negative scheduled amount is not counted as income', () => {
    const scheduled = [{ frequency: 'everyOtherWeek', date_next: '2026-10-10', amount: -3000000, category_name: 'Inflow: Ready to Assign' }];
    const transactions = [tx('2026-09-15', 'chk', 5000, { category_id: 'rta' })];
    const { result } = renderHook(() =>
      useConsciousSpendingPlan(transactions, categories, accounts, 3, settings, [], scheduled));
    expect(result.current.totalIncome).toBe(5000);
  });
});

describe('remaining dashboard fixes', () => {
  test('categories with the same name in different groups stay separate', () => {
    const cats = {
      category_groups: [
        { name: '💵 Savings', categories: [{ id: 'gift-save', name: 'Gifts' }] },
        { name: 'Guilt Free', categories: [{ id: 'gift-fun', name: 'Gifts' }] }
      ]
    };
    const lines = classifyTransactions([
      { id: 'a', date: '2026-09-01', account_id: 'chk', amount: -100000, category_id: 'gift-save', category_name: 'Gifts', payee_name: 'P' },
      { id: 'b', date: '2026-09-02', account_id: 'chk', amount: -40000, category_id: 'gift-fun', category_name: 'Gifts', payee_name: 'P' }
    ], { accounts, categories: cats });

    const summary = summarizeLines(lines);
    expect(summary.byCategory.map(c => [c.name, c.amount, c.bucket])).toEqual([
      ['Gifts (Savings)', 100, 'savings'],
      ['Gifts (Guilt Free)', 40, 'guiltFree']
    ]);
  });

  test('same-named category labels stay consistent when only one appears', () => {
    const cats = {
      category_groups: [
        { name: '💵 Savings', categories: [{ id: 'gift-save', name: 'Gifts' }] },
        { name: 'Guilt Free', categories: [{ id: 'gift-fun', name: 'Gifts' }] }
      ]
    };
    const lines = classifyTransactions([
      { id: 'a', date: '2026-08-03', account_id: 'chk', amount: -100000, category_id: 'gift-save', category_name: 'Gifts', payee_name: 'P' }
    ], { accounts, categories: cats });

    expect(summarizeLines(lines).byCategory.map(c => c.name)).toEqual(['Gifts (Savings)']);
  });

  test('CSP keeps same-named categories in their own buckets', () => {
    const cats = {
      category_groups: [
        { name: 'Internal Master Category', categories: [{ id: 'rta', name: 'Inflow: Ready to Assign' }] },
        { name: '💵 Savings', categories: [{ id: 'gift-save', name: 'Gifts' }] },
        { name: 'Guilt Free', categories: [{ id: 'gift-fun', name: 'Gifts' }] }
      ]
    };
    const transactions = [
      { id: 'i', date: '2026-09-01', account_id: 'chk', amount: 1000000, category_id: 'rta', category_name: 'Inflow: Ready to Assign', payee_name: 'Employer' },
      { id: 'a', date: '2026-09-03', account_id: 'chk', amount: -100000, category_id: 'gift-save', category_name: 'Gifts', payee_name: 'P' },
      { id: 'b', date: '2026-09-04', account_id: 'chk', amount: -40000, category_id: 'gift-fun', category_name: 'Gifts', payee_name: 'P' }
    ];
    const settings = {
      categoryMappings: {},
      excludedCategories: new Set(),
      excludedPayees: new Set(),
      excludedExpenseCategories: new Set(),
      settings: { includeTrackingAccounts: true, useKeywordFallback: false }
    };
    const { result } = renderHook(() => useConsciousSpendingPlan(transactions, cats, accounts, 3, settings));

    expect(result.current.buckets.savings.total).toBe(100);
    expect(result.current.buckets.guiltFree.total).toBe(40);
  });

  test('scenario income is gross pay scaled to take-home', () => {
    expect(calculateScenarioMonthlyIncome({ salary: { annual: 120000 }, bonus: { annual: 0 }, stock: { annualValue: 0 } }))
      .toBeCloseTo(7000); // 70% default take-home
    expect(calculateScenarioMonthlyIncome({ salary: { annual: 120000 }, takeHomeRate: 60 })).toBeCloseTo(6000);
  });

  test('runway spending by bucket adds up to the baseline burn', () => {
    const transactions = [];
    ['04', '05', '06', '07', '08', '09'].forEach(m => {
      transactions.push({ id: `r${m}`, date: `2026-${m}-01`, account_id: 'chk', amount: -2000000, category_id: 'rent', category_name: 'Rent', payee_name: 'P' });
      transactions.push({ id: `f${m}`, date: `2026-${m}-05`, account_id: 'card', amount: -500000, category_id: 'fun', category_name: 'Fun', payee_name: 'P' });
      transactions.push({ id: `v${m}`, date: `2026-${m}-20`, account_id: 'chk', amount: -1000000, category_id: 'roth', category_name: 'Roth IRA', transfer_account_id: 'brokerage', payee_name: 'P' });
    });
    const { result: processed } = renderHook(() => useTransactionProcessor(transactions, accounts, new Set(), { categories }));
    const { result: normalized } = renderHook(() => useAccountManager(accounts, []));
    const { result } = renderHook(() => useRunwayCalculator(normalized.current.allAccounts, processed.current.monthlyData, 6));

    expect(result.current.historicalAvgMonthlyExpenses).toBe(2500);
    expect(result.current.historicalAvgMonthlyByBucket).toEqual({ fixedCosts: 2000, savings: 0, guiltFree: 500 });
  });

  test('signPrefix marks negative amounts only', () => {
    expect(signPrefix(-1234)).toBe('-');
    expect(signPrefix(1234)).toBe('');
    expect(signPrefix(-0.001)).toBe('');
  });
});
