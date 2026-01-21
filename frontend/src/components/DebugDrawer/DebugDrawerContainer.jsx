import { useMemo, useState, useCallback, useEffect } from 'react';
import { DebugDrawer } from './index';
import { useFinanceData } from '../../contexts/ConsolidatedDataContext';
import { useConsciousSpendingPlan, useCSPSettings } from '../../hooks/useConsciousSpendingPlan';
import {
  getDateRange,
  formatDateRange,
  getMonthCount,
  getYNABComparisonData,
} from '../../utils/calculations';

// Map periodMonths number to period string
const MONTHS_TO_PERIOD = {
  0: 'thisMonth',
  1: 'last30days',
  3: 'last3months',
  6: 'last6months',
  12: 'last12months',
};

/**
 * Container component that wires up the Debug Drawer with app data
 * This pulls data from the finance context and computes debug comparisons
 * using the same CSP calculation logic as the main app
 *
 * Syncs with CSP page's period selection via custom events
 */
export default function DebugDrawerContainer() {
  const {
    transactions = [],
    categories = { category_groups: [] },
    accounts = [],
    months = [], // YNAB months data for comparison
    scheduledTransactions = [], // YNAB scheduled transactions for projected income
  } = useFinanceData();

  // Period state - syncs with CSP page
  const [periodMonths, setPeriodMonths] = useState(() => {
    const saved = localStorage.getItem('cspSelectedPeriod');
    return saved ? parseInt(saved, 10) : 6;
  });

  const [lastUpdated, setLastUpdated] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Listen for period changes from CSP page
  useEffect(() => {
    const handlePeriodChange = (event) => {
      setPeriodMonths(event.detail);
    };

    window.addEventListener('csp-period-changed', handlePeriodChange);
    return () => window.removeEventListener('csp-period-changed', handlePeriodChange);
  }, []);

  // Convert period months to period string for date range calculations
  const period = useMemo(() => {
    return MONTHS_TO_PERIOD[periodMonths] || 'last6months';
  }, [periodMonths]);

  // Get CSP settings (category mappings, exclusions)
  const { categoryMappings, excludedCategories, excludedPayees, excludedExpenseCategories } = useCSPSettings();

  // Use CSP hook to get properly calculated data
  const cspData = useConsciousSpendingPlan(
    transactions,
    categories,
    accounts,
    periodMonths,
    { categoryMappings, excludedCategories, excludedPayees, excludedExpenseCategories },
    months,
    scheduledTransactions
  );

  // Get date range for display
  const dateRangeInfo = useMemo(() => {
    const { start, end } = getDateRange(period);
    const monthCount = getMonthCount(start, end);
    return {
      dateRange: formatDateRange(start, end),
      monthCount,
    };
  }, [period]);

  // Transform CSP data for Debug Drawer format
  const appData = useMemo(() => {
    if (!cspData || !cspData.buckets) {
      return {
        totalIncome: 0,
        totalExpenses: 0,
        net: 0,
        avgMonthlySpend: 0,
        categories: {},
        buckets: {
          fixedCosts: 0,
          investments: 0,
          savings: 0,
          guiltFree: 0,
        },
        transactionCount: transactions?.length || 0,
        monthCount: dateRangeInfo.monthCount,
        dateRange: dateRangeInfo.dateRange,
        diagnostics: {
          budgetedSavingsAdded: 0,
          excludedIncome: 0,
          categoriesWithZeroTxns: [],
        },
      };
    }

    // Build categories object from CSP breakdown
    const categoriesObj = {};
    let budgetedSavingsAdded = 0;
    const categoriesWithZeroTxns = [];

    if (cspData.categoryBreakdown) {
      cspData.categoryBreakdown.forEach(cat => {
        const totalAmount = cat.amount * (cspData.periodMonths || 1);
        categoriesObj[cat.name] = {
          total: totalAmount,
          count: cat.transactionCount || 0,
          bucket: cat.bucket,
          transactions: cat.transactions || [],
        };

        // Track categories with 0 transactions (budgeted-only)
        if ((cat.transactionCount || 0) === 0 && totalAmount > 0) {
          budgetedSavingsAdded += totalAmount;
          categoriesWithZeroTxns.push({
            name: cat.name,
            amount: totalAmount,
            bucket: cat.bucket,
          });
        }
      });
    }

    // Extract bucket totals (CSP stores monthly amounts, we need totals)
    const bucketTotals = {
      fixedCosts: cspData.buckets.fixedCosts?.total || 0,
      investments: cspData.buckets.investments?.total || 0,
      savings: cspData.buckets.savings?.total || 0,
      guiltFree: cspData.buckets.guiltFree?.total || 0,
    };

    // Get excluded income from CSP data
    const excludedIncome = cspData.excludedIncomeTotal || 0;

    // Get skipped transactions data
    const skippedTransactions = cspData.skippedTransactions || {
      trackingAccount: { count: 0, total: 0, samples: [] },
      trackingAccountIncome: { count: 0, total: 0, samples: [] },
      uncategorizedTransfer: { count: 0, total: 0, samples: [] },
      creditCardPayment: { count: 0, total: 0, samples: [] },
      outsideDateRange: { count: 0, total: 0 },
    };

    // Get income diagnostics
    const incomeDiagnostics = cspData.incomeDiagnostics || {
      totalIncomeTransactions: 0,
      incomeByCategory: {},
      positiveNonIncomeTransactions: [],
    };

    return {
      totalIncome: cspData.totalIncome || 0,
      totalExpenses: cspData.totalSpending || 0,
      net: (cspData.totalIncome || 0) - (cspData.totalSpending || 0),
      avgMonthlySpend: cspData.monthlySpending || 0,
      categories: categoriesObj,
      buckets: bucketTotals,
      transactionCount: transactions?.length || 0,
      monthCount: cspData.periodMonths || dateRangeInfo.monthCount,
      dateRange: dateRangeInfo.dateRange,
      diagnostics: {
        budgetedSavingsAdded,
        excludedIncome,
        categoriesWithZeroTxns,
        skippedTransactions,
        incomeDiagnostics,
        scheduledIncomeDiagnostics: cspData.scheduledIncomeDiagnostics,
        scheduledIncomeTotal: cspData.scheduledIncomeTotal,
      },
    };
  }, [cspData, transactions, dateRangeInfo]);

  // Calculate YNAB data programmatically from months data
  const ynabData = useMemo(() => {
    if (!months || months.length === 0) {
      return {};
    }

    const ynabComparison = getYNABComparisonData(months, period);

    return {
      totalIncome: ynabComparison.totalIncome,
      totalExpenses: ynabComparison.totalExpenses,
      avgMonthlySpend: ynabComparison.avgMonthlySpend,
      monthCount: ynabComparison.monthCount,
      monthsUsed: ynabComparison.monthsUsed,
      dateRange: ynabComparison.dateRange,
      // Expense diagnostics
      sumOfCategoryExpenses: ynabComparison.sumOfCategoryExpenses,
      activityVsCategoryDiff: ynabComparison.activityVsCategoryDiff,
      // Income diagnostics
      sumOfIncomeCategories: ynabComparison.sumOfIncomeCategories,
      incomeCategoryTotals: ynabComparison.incomeCategoryTotals,
      incomeVsCategoryDiff: ynabComparison.incomeVsCategoryDiff,
    };
  }, [months, period]);

  // Refresh function
  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    setTimeout(() => {
      setLastUpdated(Date.now());
      setIsLoading(false);
    }, 100);
  }, []);

  // Combine data for Debug Drawer
  const debugData = useMemo(() => ({
    app: appData,
    ynab: ynabData,
    period: `${periodMonths} months`,
    lastUpdated,
  }), [appData, ynabData, periodMonths, lastUpdated]);

  return (
    <DebugDrawer
      appData={debugData}
      onRefresh={handleRefresh}
      isLoading={isLoading}
    />
  );
}
