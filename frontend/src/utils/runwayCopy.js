const months = (m) => {
  if (m >= 24) return '24+ months';
  const whole = Math.floor(m);
  return `${whole} ${whole === 1 ? 'month' : 'months'}`;
};

/**
 * Headline and detail for the Runway health banner. The headline names the
 * same runway the health grade uses (see useRunwayCalculator), and never
 * claims reserves are growing: investing transfers can still draw them down.
 */
export function runwayBanner({ cashReserves, netRunwayMonths, pureRunwayMonths }) {
  if (cashReserves <= 0) {
    return { headline: 'No runway', detail: 'Card balances exceed your cash, so there is no runway until they are paid down' };
  }
  if (!isFinite(netRunwayMonths)) {
    const cover = isFinite(pureRunwayMonths)
      ? `your reserves cover ${months(pureRunwayMonths)} of expenses`
      : 'there are no recorded expenses to measure against';
    return {
      headline: 'Spending is covered by income',
      detail: `Income covers your spending, so spending doesn't limit your runway; with no income, ${cover}`
    };
  }
  return {
    headline: `${months(netRunwayMonths)} of runway`,
    detail: `At your current net burn. With no income, cash would last ${months(pureRunwayMonths)}.`
  };
}
