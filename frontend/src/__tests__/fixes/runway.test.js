import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRunwayCalculator } from '../../hooks/useRunwayCalculator';
import { resolveScenarioIncome } from '../../hooks/useIncomeScenario';

const acct = (over) => ({ closed_on: null, ...over });

describe('useRunwayCalculator cash reserves', () => {
  const monthlyData = {};

  it('subtracts amounts owed on open on-budget credit cards', () => {
    const accounts = [
      acct({ normalizedType: 'checking', balance: 10000, on_budget: true }),
      acct({ normalizedType: 'savings', balance: 5000, on_budget: true }),
      acct({ normalizedType: 'credit', balance: -3000, on_budget: true }),
      acct({ normalizedType: 'credit', balance: -999, on_budget: true, closed_on: 'closed' }),
      acct({ normalizedType: 'credit', balance: -777, on_budget: false })
    ];
    const { result } = renderHook(() => useRunwayCalculator(accounts, monthlyData, 6));
    expect(result.current.cashReserves).toBe(12000);
    expect(result.current.cashBreakdown.creditCards).toBe(-3000);
  });

  it('leaves manual accounts alone (no on_budget flag)', () => {
    const accounts = [
      acct({ normalizedType: 'checking', balance: 1000, source: 'manual' }),
      acct({ normalizedType: 'credit', balance: -400, source: 'manual' })
    ];
    const { result } = renderHook(() => useRunwayCalculator(accounts, monthlyData, 6));
    expect(result.current.cashReserves).toBe(1000);
  });
});

describe('resolveScenarioIncome', () => {
  it('returns $0 for an enabled scenario where the user entered $0 income', () => {
    expect(resolveScenarioIncome({ isEnabled: true, hasScenarioValues: false, hasIncomeInput: true, scenarioMonthlyIncome: 0 })).toBe(0);
  });
  it('falls back to historical (undefined) when no income was ever entered', () => {
    expect(resolveScenarioIncome({ isEnabled: true, hasScenarioValues: false, hasIncomeInput: false, scenarioMonthlyIncome: 0 })).toBeUndefined();
  });
  it('returns undefined when disabled', () => {
    expect(resolveScenarioIncome({ isEnabled: false, hasScenarioValues: true, hasIncomeInput: true, scenarioMonthlyIncome: 500 })).toBeUndefined();
  });
  it('returns the scenario income when values exist', () => {
    expect(resolveScenarioIncome({ isEnabled: true, hasScenarioValues: true, hasIncomeInput: true, scenarioMonthlyIncome: 500 })).toBe(500);
  });
});
