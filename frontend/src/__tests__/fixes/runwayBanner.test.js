import { describe, it, expect } from 'vitest';
import { runwayBanner } from '../../utils/runwayCopy';

describe('runwayBanner', () => {
  it('never says cash is growing when income covers spending', () => {
    const banner = runwayBanner({ cashReserves: 10000, netRunwayMonths: Infinity, pureRunwayMonths: 2 });
    expect(`${banner.headline} ${banner.detail}`).not.toMatch(/growing|increasing|unlimited/i);
    expect(banner.detail).toMatch(/2 months of expenses/);
  });

  it('headlines the net runway the health grade uses', () => {
    const banner = runwayBanner({ cashReserves: 40000, netRunwayMonths: 50, pureRunwayMonths: 8 });
    expect(banner.headline).toBe('24+ months of runway');
    expect(banner.detail).toMatch(/8 months/);
  });

  it('says there is no runway when card balances exceed cash', () => {
    const banner = runwayBanner({ cashReserves: -3000, netRunwayMonths: 0, pureRunwayMonths: 0 });
    expect(banner.headline).toBe('No runway');
    expect(banner.detail).toMatch(/Card balances exceed your cash/);
  });
});
