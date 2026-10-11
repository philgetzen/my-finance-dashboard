import { describe, it, expect } from 'vitest';
import { getMonthlyRangeData } from '../../hooks/useTransactionProcessor';

describe('getMonthlyRangeData endMonth option (Last Year chart)', () => {
  it('returns Jan-Dec of the given year when endMonth is December', () => {
    const rows = getMonthlyRangeData({}, 12, { endMonth: new Date(2025, 11, 1) });
    expect(rows.map(r => r.monthKey)).toEqual([
      '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
      '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12'
    ]);
  });
});
