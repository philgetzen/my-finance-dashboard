import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../../firebase', () => ({ db: {}, auth: {} }));
vi.mock('../../contexts/ConsolidatedDataContext', () => ({ useFinanceData: () => ({}) }));

import { useConsciousSpendingPlan } from '../../hooks/useConsciousSpendingPlan';

const accounts = [{ id: 'chk', name: 'Checking', type: 'checking', on_budget: true, balance: 0 }];
const categories = {
  category_groups: [
    { name: 'Internal Master Category', categories: [{ id: 'rta', name: 'Inflow: Ready to Assign' }] },
    { name: 'Investments', categories: [{ id: 'inv', name: 'Investments (Stocks, ETFs, MFs)' }] }
  ]
};
const settings = {
  categoryMappings: { inv: 'investments' },
  excludedCategories: new Set(),
  excludedPayees: new Set(),
  excludedExpenseCategories: new Set(),
  settings: { includeTrackingAccounts: true, useKeywordFallback: false }
};
const today = new Date();
const d = (day) => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const t = (id, dollars, extra = {}) => ({
  id, date: d(1), account_id: 'chk', amount: Math.round(dollars * 1000), payee_name: 'P',
  category_id: 'inv', category_name: 'Investments (Stocks, ETFs, MFs)', transfer_account_id: null,
  subtransactions: [], deleted: false, ...extra
});

describe('CSP investment inflows', () => {
  it('does not net a stock-sale transfer against real investing', () => {
    const transactions = [
      t('income', 5000, { category_id: 'rta', category_name: 'Inflow: Ready to Assign', payee_name: 'Employer' }),
      t('out', -1000, { payee_name: 'Vanguard' }),
      t('sale', 50000, { payee_name: 'Brokerage Transfer' })
    ];
    const { result } = renderHook(() => useConsciousSpendingPlan(transactions, categories, accounts, 0, settings));
    expect(result.current.buckets.investments.total).toBe(1000);
  });
});
