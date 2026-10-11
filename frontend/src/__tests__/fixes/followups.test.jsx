import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, render, screen, waitFor } from '@testing-library/react';

vi.mock('../../firebase', () => ({ db: {}, auth: {} }));
vi.mock('../../contexts/ConsolidatedDataContext', () => ({
  useFinanceData: () => ({ isDemoMode: true }),
  usePrivacy: () => ({ privacyMode: false })
}));

import { useRunwayCalculator } from '../../hooks/useRunwayCalculator';
import { useIncomeScenario } from '../../hooks/useIncomeScenario';
import { useConsciousSpendingPlan } from '../../hooks/useConsciousSpendingPlan';
import IncomeScenarioPanel from '../../components/ui/IncomeScenarioPanel';

describe('negative reserves', () => {
  const accounts = [
    { normalizedType: 'checking', balance: 5000, on_budget: true, closed_on: null },
    { normalizedType: 'credit', balance: -8000, on_budget: true, closed_on: null }
  ];
  const monthKey = (back) => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - back, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const flow = (income, expenses) => {
    const data = {};
    [1, 2, 3].forEach(b => { data[monthKey(b)] = { income, expenses, net: income - expenses }; });
    return data;
  };

  it.each([[6000, 2000], [1000, 2000]])('is 0 months and critical with income %i, expenses %i', (income, expenses) => {
    const { result } = renderHook(() => useRunwayCalculator(accounts, flow(income, expenses), 3));
    expect(result.current.cashReserves).toBe(-3000);
    expect(result.current.pureRunwayMonths).toBe(0);
    expect(result.current.netRunwayMonths).toBe(0);
    expect(result.current.runwayHealth).toBe('critical');
  });
});

describe('clearScenario', () => {
  beforeEach(() => localStorage.clear());
  it('persists incomeEdited:false explicitly', async () => {
    const { result } = renderHook(() => useIncomeScenario(0));
    await act(async () => { result.current.setSalary(0); });
    expect(result.current.hasIncomeInput).toBe(true);
    await act(async () => { result.current.clearScenario(); });
    expect(result.current.hasIncomeInput).toBe(false);
    expect(result.current.scenario.incomeEdited).toBe(false);
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('income_scenario')).incomeEdited).toBe(false);
    }, { timeout: 3000 });
  });
});

describe('IncomeScenarioPanel with $0 income', () => {
  const props = {
    isOpen: false, onToggle: () => {}, isEnabled: true, setEnabled: () => {},
    salary: 0, setSalary: () => {}, bonus: 0, setBonus: () => {}, stock: 0, setStock: () => {},
    scenarioMonthlyIncome: 0, historicalAvgIncome: 5000, incomeDelta: -5000,
    hasScenarioValues: false, hasIncomeInput: true, expenseBuckets: {}, toggleExpenseBucket: () => {},
    hasExpenseFilters: false, resetToCurrent: () => {}, resetExpenseBuckets: () => {}
  };
  it('shows the active state and toggle', () => {
    render(<IncomeScenarioPanel {...props} />);
    expect(screen.getByText('Scenario active')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
  });
  it('shows the Runway Impact block when open', () => {
    render(<IncomeScenarioPanel {...props} isOpen currentRunwayMonths={10} projectedRunwayMonths={0} />);
    expect(screen.getByText(/Runway Impact/i)).toBeTruthy();
  });
});

describe('CSP categorized transfers between budget accounts', () => {
  it('skips a categorized positive transfer instead of netting it as a refund', () => {
    const accounts = [
      { id: 'chk', name: 'Checking', type: 'checking', on_budget: true, balance: 0 },
      { id: 'sav', name: 'Savings', type: 'savings', on_budget: true, balance: 0 }
    ];
    const categories = { category_groups: [{ name: 'Fixed Costs', categories: [{ id: 'rent', name: 'Rent' }] }] };
    const settings = { categoryMappings: { rent: 'fixedCosts' }, excludedCategories: new Set(), excludedPayees: new Set(), excludedExpenseCategories: new Set(), settings: { includeTrackingAccounts: true, useKeywordFallback: false } };
    const d = new Date(); const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const base = { date, subtransactions: [], deleted: false, category_id: 'rent', category_name: 'Rent' };
    const transactions = [
      { ...base, id: 'a', account_id: 'chk', amount: -1000000, payee_name: 'Landlord' },
      { ...base, id: 'b', account_id: 'chk', amount: 400000, payee_name: 'Transfer : Savings', transfer_account_id: 'sav' }
    ];
    const { result } = renderHook(() => useConsciousSpendingPlan(transactions, categories, accounts, 0, settings));
    expect(result.current.buckets.fixedCosts.total).toBe(1000);
  });
});
