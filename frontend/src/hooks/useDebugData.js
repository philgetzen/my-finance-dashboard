import { useMemo, useState, useCallback } from 'react';
import {
  getDateRange,
  formatDateRange,
  getMonthCount,
  processTransactions,
  sumIncome,
  sumExpenses,
  getCategoryTotals,
  mapCategoriesToBuckets,
  calculateBucketTotals,
} from '../utils/calculations';

/**
 * Hook to compute debug comparison data from app state
 * This extracts calculations to verify against YNAB
 */
export function useDebugData({
  transactions = [],
  categories = [],
  categoryMappings = {},
  investmentAccountIds = new Set(),
  period = 'last6months',
}) {
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Compute app-side calculations
  const appData = useMemo(() => {
    if (!transactions?.length) {
      return {
        totalIncome: 0,
        totalExpenses: 0,
        net: 0,
        avgMonthlySpend: 0,
        categories: {},
        buckets: {},
        transactionCount: 0,
        monthCount: 0,
        dateRange: 'N/A',
      };
    }

    // Get date range
    const { start, end } = getDateRange(period);
    const monthCount = getMonthCount(start, end);

    // Process transactions
    const processed = processTransactions(transactions, {
      investmentAccountIds,
      startDate: start,
      endDate: end,
      flattenSplits: true,
    });

    // Calculate totals
    const totalIncome = sumIncome(processed);
    const totalExpenses = sumExpenses(processed);
    const net = totalIncome - totalExpenses;
    const avgMonthlySpend = monthCount > 0 ? totalExpenses / monthCount : 0;

    // Get category totals with transaction details
    const categoryTotals = getCategoryTotals(processed);

    // Map categories to buckets
    const categoryToBucket = mapCategoriesToBuckets(categories, categoryMappings, false);

    // Calculate bucket totals
    const bucketTotals = calculateBucketTotals(processed, categoryToBucket);

    // Add bucket info to category totals
    const categoriesWithBucket = {};
    Object.entries(categoryTotals).forEach(([name, data]) => {
      const category = categories.find(c => c.name === name);
      const bucket = category ? categoryToBucket[category.id] : 'guiltFree';
      categoriesWithBucket[name] = {
        ...data,
        bucket,
      };
    });

    return {
      totalIncome,
      totalExpenses,
      net,
      avgMonthlySpend,
      categories: categoriesWithBucket,
      buckets: bucketTotals,
      transactionCount: processed.length,
      monthCount,
      dateRange: formatDateRange(start, end),
    };
  }, [transactions, categories, categoryMappings, investmentAccountIds, period]);

  // Refresh function - triggers recalculation and updates timestamp
  const refresh = useCallback(() => {
    setIsLoading(true);
    // Simulate async to show loading state
    setTimeout(() => {
      setLastUpdated(Date.now());
      setIsLoading(false);
    }, 100);
  }, []);

  // Combine data for Debug Drawer
  const debugData = useMemo(() => ({
    app: appData,
    ynab: {}, // Placeholder - would need YNAB API integration to populate
    period,
    lastUpdated,
  }), [appData, period, lastUpdated]);

  return {
    data: debugData,
    isLoading,
    refresh,
  };
}

/**
 * Manual YNAB data entry for comparison
 * Users can input YNAB values to verify calculations
 */
export function useManualYnabData() {
  const [ynabData, setYnabData] = useState({
    totalIncome: undefined,
    totalExpenses: undefined,
    avgMonthlySpend: undefined,
    categories: {},
  });

  const updateYnabValue = useCallback((key, value) => {
    setYnabData(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const updateYnabCategory = useCallback((categoryName, total) => {
    setYnabData(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [categoryName]: { total },
      },
    }));
  }, []);

  const clearYnabData = useCallback(() => {
    setYnabData({
      totalIncome: undefined,
      totalExpenses: undefined,
      avgMonthlySpend: undefined,
      categories: {},
    });
  }, []);

  return {
    ynabData,
    updateYnabValue,
    updateYnabCategory,
    clearYnabData,
  };
}
