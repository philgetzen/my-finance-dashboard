import { describe, it, expect } from 'vitest';
import { calculateNetWorthTotals } from '../../utils/netWorth';

const ynab = (over) => ({ id: over.name, on_budget: true, closed: false, deleted: false, balance: 0, ...over });

describe('calculateNetWorthTotals (Dashboard net worth)', () => {
  it('skips closed and deleted accounts so Dashboard matches the Accounts page', () => {
    const accounts = [
      ynab({ name: 'Checking', type: 'checking', balance: 100000000 }),
      ynab({ name: 'Visa', type: 'creditCard', balance: -10000000 }),
      ynab({ name: 'Old Trust Account', type: 'otherLiability', balance: -100000000, closed: true }),
      ynab({ name: 'Old savings', type: 'savings', balance: 5000000, deleted: true })
    ];
    const totals = calculateNetWorthTotals(accounts);
    expect(totals.totalAssets).toBe(100000);
    expect(totals.totalLiabilities).toBe(10000);
    expect(totals.netWorth).toBe(90000);
  });

  it('also skips accounts flagged with closed_on', () => {
    const accounts = [
      ynab({ name: 'Checking', type: 'checking', balance: 1000000 }),
      ynab({ name: 'Gone', type: 'savings', balance: 9000000, closed_on: '2026-01-01' })
    ];
    expect(calculateNetWorthTotals(accounts).netWorth).toBe(1000);
  });
});
