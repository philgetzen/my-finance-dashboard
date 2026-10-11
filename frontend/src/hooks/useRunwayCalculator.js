import { useMemo } from 'react';
import { getMonthlyRangeData } from './useTransactionProcessor';

/**
 * Custom hook for calculating cash runway metrics
 * @param {Array} allAccounts - Normalized accounts from useAccountManager
 * @param {Object} monthlyData - Monthly income/expense data from useTransactionProcessor
 * @param {number} periodMonths - Number of months to average (3, 6, or 12)
 * @param {Object} options - Optional configuration
 * @param {number} options.scenarioIncome - Optional monthly income override for scenario planning
 * @param {number} options.scenarioExpenses - Optional monthly expenses override for scenario planning
 * @returns {Object} Runway metrics and projection data
 */
export function useRunwayCalculator(allAccounts, monthlyData, periodMonths = 6, options = {}) {
  const { scenarioIncome, scenarioExpenses } = options;

  return useMemo(() => {
    // Default return for empty data
    const emptyResult = {
      cashReserves: 0,
      cashBreakdown: { checking: 0, savings: 0, manualCash: 0, creditCards: 0 },
      avgMonthlyExpenses: 0,
      avgMonthlyIncome: 0,
      avgMonthlyNet: 0,
      historicalAvgMonthlyByBucket: { fixedCosts: 0, savings: 0, guiltFree: 0 },
      pureRunwayMonths: 0,
      netRunwayMonths: 0,
      projection: [],
      historicalSpending: [],
      runwayHealth: 'critical'
    };

    if (!allAccounts?.length) {
      return emptyResult;
    }

    // 1. Calculate cash reserves from normalized accounts
    // Cash accounts: checking, savings, cash (but NOT investments), less what
    // open on-budget credit cards and lines of credit owe. YNAB card balances
    // are signed (owed is negative), so adding them nets the debt out.
    // Exclude closed accounts (closed_on field is set)
    let checking = 0;
    let savings = 0;
    let manualCash = 0;
    let creditCards = 0;

    allAccounts.forEach(account => {
      // Skip closed and deleted accounts
      if (account.closed_on || account.closed === true || account.deleted === true) return;

      const type = account.normalizedType;
      const balance = account.balance || 0;

      if (type === 'checking') {
        checking += balance;
      } else if (type === 'savings') {
        savings += balance;
      } else if (type === 'cash') {
        // Only cash-type accounts count; a manual mortgage or "other" asset isn't spendable cash
        manualCash += balance;
      } else if (type === 'credit' && account.on_budget === true) {
        // Manual accounts carry no on_budget flag, so they are left out
        creditCards += balance;
      }
    });

    const cashReserves = checking + savings + manualCash + creditCards;

    // 2. Get historical data for the last N complete months. Including the
    // current partial month would understate the monthly averages.
    const historicalData = getMonthlyRangeData(monthlyData, periodMonths, { completeOnly: true });
    const validMonths = historicalData.filter(m => m.income > 0 || m.expenses > 0);
    const numMonths = Math.max(validMonths.length, 1);

    // 3. Calculate averages
    const totalExpenses = validMonths.reduce((sum, m) => sum + m.expenses, 0);
    const totalIncome = validMonths.reduce((sum, m) => sum + m.income, 0);

    const historicalAvgMonthlyExpenses = totalExpenses / numMonths;
    const historicalAvgMonthlyIncome = totalIncome / numMonths;

    // Spending by CSP bucket over the same months, so scenario toggles add up
    // to the same burn as the baseline
    const historicalAvgMonthlyByBucket = { fixedCosts: 0, savings: 0, guiltFree: 0 };
    Object.keys(historicalAvgMonthlyByBucket).forEach(key => {
      const total = validMonths.reduce((sum, m) => sum + (m.expensesByBucket?.[key] || 0), 0);
      historicalAvgMonthlyByBucket[key] = total / numMonths;
    });

    // Use scenario values if provided, otherwise use historical averages
    const avgMonthlyExpenses = scenarioExpenses !== undefined && scenarioExpenses !== null
      ? scenarioExpenses
      : historicalAvgMonthlyExpenses;

    const avgMonthlyIncome = scenarioIncome !== undefined && scenarioIncome !== null
      ? scenarioIncome
      : historicalAvgMonthlyIncome;

    const avgMonthlyNet = avgMonthlyIncome - avgMonthlyExpenses;

    // 4. Calculate runway months
    // Pure runway: how long cash lasts with zero income (worst case)
    // With no cash (or card debt larger than cash) there is no runway,
    // whatever the cash flow looks like
    const hasNoCash = cashReserves <= 0;
    const pureRunwayMonths = hasNoCash
      ? 0
      : avgMonthlyExpenses > 0
        ? cashReserves / avgMonthlyExpenses
        : Infinity;

    // Net runway: how long cash lasts considering income
    // If income >= expenses (positive net), spending doesn't run the cash down
    // If expenses > income (negative net), calculate depletion time
    const netRunwayMonths = hasNoCash
      ? 0
      : avgMonthlyNet >= 0
        ? Infinity
        : cashReserves / Math.abs(avgMonthlyNet);

    // 5. Generate projection data (single array with both scenarios)
    const maxProjectionMonths = 24;
    const projectionLength = Math.min(
      Math.ceil(Math.max(pureRunwayMonths, 6)) + 3,
      maxProjectionMonths
    );

    const today = new Date();
    const projection = [];

    for (let i = 0; i <= projectionLength; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      // Pure burn: cash depletes by expenses each month
      const pureBalance = Math.max(0, cashReserves - (avgMonthlyExpenses * i));

      // Net burn: cash changes by net amount each month
      let netBalance;
      if (avgMonthlyNet >= 0) {
        // Growing - cap at reasonable display value
        netBalance = Math.max(0, Math.min(cashReserves + (avgMonthlyNet * i), cashReserves * 2));
      } else {
        netBalance = Math.max(0, cashReserves - (Math.abs(avgMonthlyNet) * i));
      }

      projection.push({
        month: monthLabel,
        pureBalance,
        netBalance
      });
    }

    // 6. Historical spending for trend chart
    const historicalSpending = historicalData.map(m => ({
      month: m.monthName,
      income: m.income,
      expenses: m.expenses
    }));

    // 7. Determine health status (same rule as the newsletter)
    // Grade on the net runway the page headlines. When income covers spending
    // that runway is not finite, so grade reserves against monthly expenses.
    const gradedMonths = isFinite(netRunwayMonths) ? netRunwayMonths : pureRunwayMonths;
    let runwayHealth = 'excellent';
    if (hasNoCash || gradedMonths < 3) {
      runwayHealth = 'critical';
    } else if (gradedMonths < 6) {
      runwayHealth = 'caution';
    } else if (gradedMonths < 12) {
      runwayHealth = 'healthy';
    }

    return {
      cashReserves,
      cashBreakdown: { checking, savings, manualCash, creditCards },
      avgMonthlyExpenses,
      avgMonthlyIncome,
      historicalAvgMonthlyIncome,
      historicalAvgMonthlyExpenses,
      historicalAvgMonthlyByBucket,
      avgMonthlyNet,
      pureRunwayMonths,
      netRunwayMonths,
      projection,
      historicalSpending,
      runwayHealth,
      // Flags to indicate if scenario values are being used
      isUsingScenarioIncome: scenarioIncome !== undefined && scenarioIncome !== null,
      isUsingScenarioExpenses: scenarioExpenses !== undefined && scenarioExpenses !== null
    };
  }, [allAccounts, monthlyData, periodMonths, scenarioIncome, scenarioExpenses]);
}
