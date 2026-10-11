import { describe, it, expect } from 'vitest';
import { runwayBanner, gradedRunwayMonths, formatRunwayMonths } from '../../utils/runwayCopy';

describe('runwayBanner', () => {
  it('never says cash is growing when income covers spending, and names the graded months', () => {
    const banner = runwayBanner({ cashReserves: 10000, netRunwayMonths: Infinity, pureRunwayMonths: 2 });
    expect(`${banner.headline} ${banner.detail}`).not.toMatch(/growing|increasing|unlimited/i);
    expect(banner.headline).toBe('2 months of reserves; income covers spending');
  });

  it('handles no recorded expenses', () => {
    const banner = runwayBanner({ cashReserves: 10000, netRunwayMonths: Infinity, pureRunwayMonths: Infinity });
    expect(banner.headline).toBe('Income covers spending');
    expect(banner.detail).toMatch(/no recorded expenses/);
  });

  it('headlines the net runway the health grade uses', () => {
    const banner = runwayBanner({ cashReserves: 40000, netRunwayMonths: 50, pureRunwayMonths: 8 });
    expect(banner.headline).toBe('24+ months of runway');
    expect(banner.detail).toMatch(/8 months\.$/);
  });

  it('says there is no runway when card balances exceed cash', () => {
    const banner = runwayBanner({ cashReserves: -3000, netRunwayMonths: 0, pureRunwayMonths: 0 });
    expect(banner.headline).toBe('No runway');
    expect(banner.detail).toMatch(/Card balances exceed your cash/);
  });

  it('does not blame cards when there is simply no cash', () => {
    const banner = runwayBanner({ cashReserves: 0, netRunwayMonths: 0, pureRunwayMonths: 0 });
    expect(banner.headline).toBe('No cash on hand');
    expect(banner.detail).not.toMatch(/Card/);
  });

  it('ends every detail with a period', () => {
    for (const r of [
      { cashReserves: 10000, netRunwayMonths: Infinity, pureRunwayMonths: 2 },
      { cashReserves: 40000, netRunwayMonths: 50, pureRunwayMonths: 8 },
      { cashReserves: -1, netRunwayMonths: 0, pureRunwayMonths: 0 },
      { cashReserves: 0, netRunwayMonths: 0, pureRunwayMonths: 0 }
    ]) expect(runwayBanner(r).detail).toMatch(/\.$/);
  });
});

describe('formatRunwayMonths', () => {
  it.each([
    [0.4, 'less than 1 month'], [1, '1 month'], [23.9, '23 months'], [24, '24+ months'], [Infinity, '24+ months']
  ])('%s -> %s', (m, text) => expect(formatRunwayMonths(m)).toBe(text));
});

describe('gradedRunwayMonths', () => {
  it('uses net runway when finite, otherwise reserves vs expenses', () => {
    expect(gradedRunwayMonths({ netRunwayMonths: 12, pureRunwayMonths: 4 })).toBe(12);
    expect(gradedRunwayMonths({ netRunwayMonths: Infinity, pureRunwayMonths: 2 })).toBe(2);
  });
});
