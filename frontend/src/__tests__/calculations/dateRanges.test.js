import { describe, test, expect } from 'vitest';
import {
  getDateRange,
  getMonthBoundaries,
  isWithinRange,
  getMonthKey,
  getMonthKeysBetween,
  getMonthCount,
  formatDateRange,
} from '../../utils/calculations/dateRanges';

describe('getDateRange', () => {
  // Test with a fixed reference date to ensure consistent results
  const referenceDate = new Date('2026-01-15T12:00:00');

  describe('YNAB "Last X Months" behavior', () => {
    test('last6months includes current partial month (Jan 2026 = Aug-Jan)', () => {
      const { start, end } = getDateRange('last6months', referenceDate);
      expect(start).toEqual(new Date(2025, 7, 1)); // Aug 1, 2025
      expect(end).toBeNull(); // Up to today
    });

    test('last3months includes current partial month (Jan 2026 = Nov-Jan)', () => {
      const { start, end } = getDateRange('last3months', referenceDate);
      expect(start).toEqual(new Date(2025, 10, 1)); // Nov 1, 2025
      expect(end).toBeNull();
    });

    test('last12months includes current partial month (Jan 2026 = Feb 2025-Jan 2026)', () => {
      const { start, end } = getDateRange('last12months', referenceDate);
      expect(start).toEqual(new Date(2025, 1, 1)); // Feb 1, 2025
      expect(end).toBeNull();
    });

    test('thisMonth returns first of current month', () => {
      const { start, end } = getDateRange('thisMonth', referenceDate);
      expect(start).toEqual(new Date(2026, 0, 1)); // Jan 1, 2026
      expect(end).toBeNull();
    });
  });

  describe('numeric period handling', () => {
    test('period 0 means this month', () => {
      const { start, end } = getDateRange(0, referenceDate);
      expect(start).toEqual(new Date(2026, 0, 1));
      expect(end).toBeNull();
    });

    test('period 6 means last 6 months', () => {
      const { start, end } = getDateRange(6, referenceDate);
      expect(start).toEqual(new Date(2025, 7, 1)); // Aug 1, 2025
      expect(end).toBeNull();
    });

    test('period 3 means last 3 months', () => {
      const { start, end } = getDateRange(3, referenceDate);
      expect(start).toEqual(new Date(2025, 10, 1)); // Nov 1, 2025
      expect(end).toBeNull();
    });
  });

  describe('special periods', () => {
    test('ytd returns January 1st of current year', () => {
      const { start, end } = getDateRange('ytd', referenceDate);
      expect(start).toEqual(new Date(2026, 0, 1));
      expect(end).toBeNull();
    });

    test('lastYear returns full previous year', () => {
      const { start, end } = getDateRange('lastYear', referenceDate);
      expect(start).toEqual(new Date(2025, 0, 1)); // Jan 1, 2025
      expect(end.getFullYear()).toBe(2025);
      expect(end.getMonth()).toBe(11); // December
      expect(end.getDate()).toBe(31);
    });

    test('all returns epoch start', () => {
      const { start, end } = getDateRange('all', referenceDate);
      expect(start).toEqual(new Date(1970, 0, 1));
      expect(end).toBeNull();
    });
  });

  describe('edge cases', () => {
    test('handles year boundary correctly for last6months in March', () => {
      const marchDate = new Date('2026-03-15');
      const { start } = getDateRange('last6months', marchDate);
      expect(start).toEqual(new Date(2025, 9, 1)); // Oct 1, 2025
    });

    test('unrecognized period defaults to last 6 months with warning', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { start, end } = getDateRange('unknownPeriod', referenceDate);
      expect(start).toEqual(new Date(2025, 7, 1)); // Same as last6months
      expect(end).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

describe('getMonthBoundaries', () => {
  test('returns first and last day of month', () => {
    const date = new Date('2026-01-15');
    const { first, last } = getMonthBoundaries(date);

    expect(first).toEqual(new Date(2026, 0, 1));
    expect(last.getFullYear()).toBe(2026);
    expect(last.getMonth()).toBe(0);
    expect(last.getDate()).toBe(31);
  });

  test('handles February correctly', () => {
    const date = new Date('2026-02-15');
    const { first, last } = getMonthBoundaries(date);

    expect(first).toEqual(new Date(2026, 1, 1));
    expect(last.getDate()).toBe(28); // 2026 is not a leap year
  });

  test('handles leap year February', () => {
    const date = new Date('2024-02-15');
    const { first, last } = getMonthBoundaries(date);

    expect(last.getDate()).toBe(29); // 2024 is a leap year
  });
});

describe('isWithinRange', () => {
  const start = new Date('2025-08-01');
  const end = new Date('2026-01-31');

  test('returns true for date within range', () => {
    expect(isWithinRange('2025-10-15', start, end)).toBe(true);
  });

  test('returns true for date at start boundary', () => {
    expect(isWithinRange('2025-08-01', start, end)).toBe(true);
  });

  test('returns true for date at end boundary', () => {
    expect(isWithinRange('2026-01-31', start, end)).toBe(true);
  });

  test('returns false for date before range', () => {
    expect(isWithinRange('2025-07-31', start, end)).toBe(false);
  });

  test('returns false for date after range', () => {
    expect(isWithinRange('2026-02-01', start, end)).toBe(false);
  });

  test('handles null end date (up to today)', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1); // Yesterday
    expect(isWithinRange(pastDate, start, null)).toBe(true);
  });
});

describe('getMonthKey', () => {
  test('returns YYYY-MM format', () => {
    expect(getMonthKey(new Date('2026-01-15'))).toBe('2026-01');
    expect(getMonthKey(new Date('2025-12-01'))).toBe('2025-12');
  });

  test('handles string dates', () => {
    expect(getMonthKey('2026-01-15')).toBe('2026-01');
  });
});

describe('getMonthKeysBetween', () => {
  test('returns all months between two dates', () => {
    // Use explicit Date constructor to avoid timezone issues
    const start = new Date(2025, 7, 1); // Aug 1, 2025
    const end = new Date(2026, 0, 31); // Jan 31, 2026
    const keys = getMonthKeysBetween(start, end);

    expect(keys).toEqual([
      '2025-08',
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
    ]);
  });

  test('handles single month', () => {
    const start = new Date(2026, 0, 1); // Jan 1, 2026
    const end = new Date(2026, 0, 31); // Jan 31, 2026
    const keys = getMonthKeysBetween(start, end);

    expect(keys).toEqual(['2026-01']);
  });
});

describe('getMonthCount', () => {
  test('counts months correctly', () => {
    const start = new Date(2025, 7, 1); // Aug 1, 2025
    const end = new Date(2026, 0, 31); // Jan 31, 2026
    expect(getMonthCount(start, end)).toBe(6);
  });

  test('single month returns 1', () => {
    const start = new Date(2026, 0, 1); // Jan 1, 2026
    const end = new Date(2026, 0, 31); // Jan 31, 2026
    expect(getMonthCount(start, end)).toBe(1);
  });
});

describe('formatDateRange', () => {
  test('formats date range for display', () => {
    const start = new Date(2025, 7, 1); // Aug 1, 2025
    const end = new Date(2026, 0, 31); // Jan 31, 2026
    const formatted = formatDateRange(start, end);

    expect(formatted).toBe('Aug 2025 - Jan 2026');
  });
});
