/**
 * The runway the health grade uses (see useRunwayCalculator): net runway when
 * it is finite, otherwise reserves measured against monthly expenses.
 */
export function gradedRunwayMonths({ netRunwayMonths, pureRunwayMonths }) {
  return isFinite(netRunwayMonths) ? netRunwayMonths : pureRunwayMonths;
}

export function formatRunwayMonths(m) {
  if (!isFinite(m) || m >= 24) return '24+ months';
  if (m < 1) return 'less than 1 month';
  const whole = Math.floor(m);
  return `${whole} ${whole === 1 ? 'month' : 'months'}`;
}

/**
 * Headline and detail for the Runway health banner. The headline names the
 * same runway the health grade uses, and never claims reserves are growing:
 * investing transfers can still draw them down.
 */
export function runwayBanner({ cashReserves, netRunwayMonths, pureRunwayMonths }) {
  if (cashReserves < 0) {
    return { headline: 'No runway', detail: 'Card balances exceed your cash, so there is no runway until they are paid down.' };
  }
  if (cashReserves === 0) {
    return { headline: 'No cash on hand', detail: 'There is no cash in checking, savings or cash accounts to cover spending.' };
  }
  if (!isFinite(netRunwayMonths)) {
    if (!isFinite(pureRunwayMonths)) {
      return { headline: 'Income covers spending', detail: 'There are no recorded expenses to measure your reserves against.' };
    }
    return {
      headline: `${formatRunwayMonths(pureRunwayMonths)} of reserves; income covers spending`,
      detail: `Spending doesn't limit your runway, but with no income your cash would last ${formatRunwayMonths(pureRunwayMonths)}.`
    };
  }
  return {
    headline: `${formatRunwayMonths(netRunwayMonths)} of runway`,
    detail: `At your current net burn. With no income, cash would last ${formatRunwayMonths(pureRunwayMonths)}.`
  };
}
