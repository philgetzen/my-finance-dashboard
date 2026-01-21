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
      cashBreakdown: { checking: 0, savings: 0, manualCash: 0 },
      avgMonthlyExpenses: 0,
      avgMonthlyIncome: 0,
      avgMonthlyNet: 0,
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
    // Filter for cash accounts: checking, savings, cash (but NOT investments)
    // Exclude closed accounts (closed_on field is set)
    let checking = 0;
    let savings = 0;
    let manualCash = 0;

    allAccounts.forEach(account => {
      // Skip closed accounts
      if (account.closed_on) return;

      const type = account.normalizedType;
      const balance = account.balance || 0;
      const source = account.source;

      if (type === 'checking') {
        checking += balance;
      } else if (type === 'savings') {
        savings += balance;
      } else if (type === 'cash' || (source === 'manual' && type !== 'investment' && type !== 'credit' && type !== 'loan')) {
        // Include manual cash accounts that aren't investments or debt
        manualCash += balance;
      }
    });

    const cashReserves = checking + savings + manualCash;

    // 2. Get historical data for selected period
    const historicalData = getMonthlyRangeData(monthlyData, periodMonths);
    const validMonths = historicalData.filter(m => m.income > 0 || m.expenses > 0);
    const numMonths = Math.max(validMonths.length, 1);

    // 3. Calculate averages
    const totalExpenses = validMonths.reduce((sum, m) => sum + m.expenses, 0);
    const totalIncome = validMonths.reduce((sum, m) => sum + m.income, 0);

    const historicalAvgMonthlyExpenses = totalExpenses / numMonths;
    const historicalAvgMonthlyIncome = totalIncome / numMonths;

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
    const pureRunwayMonths = avgMonthlyExpenses > 0
      ? cashReserves / avgMonthlyExpenses
      : Infinity;

    // Net runway: how long cash lasts considering income
    // If income > expenses (positive net), runway is infinite (growing)
    // If expenses > income (negative net), calculate depletion time
    const netRunwayMonths = avgMonthlyNet >= 0
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
        netBalance = Math.min(cashReserves + (avgMonthlyNet * i), cashReserves * 2);
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

    // 7. Determine health status (based on pure burn - worst case)
    let runwayHealth = 'excellent';
    if (pureRunwayMonths < 3) {
      runwayHealth = 'critical';
    } else if (pureRunwayMonths < 6) {
      runwayHealth = 'caution';
    } else if (pureRunwayMonths < 12) {
      runwayHealth = 'healthy';
    }

    return {
      cashReserves,
      cashBreakdown: { checking, savings, manualCash },
      avgMonthlyExpenses,
      avgMonthlyIncome,
      historicalAvgMonthlyIncome,
      historicalAvgMonthlyExpenses,
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
