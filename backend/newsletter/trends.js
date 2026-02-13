/**
 * Newsletter Trends Calculator
 * Month-over-Month, Year-over-Year, and Annual Progress calculations
 * Uses YNAB historical data (available back to November 2018)
 */

const {
  getMonthKey,
  getStartOfMonth,
  getEndOfMonth,
  getStartOfYear,
  getSameMonthLastYear,
  getTransactionsForMonth,
  getTransactionsForRange,
  aggregateByCategory,
  getTopCategories,
  processTransactions,
  formatCurrency,
  formatPercent,
  getTransactionAmount,
  isIncomeCategory,
  shouldExcludeTransaction
} = require('./helpers');

const { isTrueExpense } = require('./metrics');

// ============================================
// Month-over-Month Trends
// ============================================

/**
 * Calculate month-over-month trends
 * @param {Array} transactions - All YNAB transactions
 * @param {Object} currentMetrics - Current month's metrics
 * @param {Set} investmentAccountIds - Set of investment account IDs to exclude
 * @returns {Object} - MoM comparison data
 */
function calculateMonthOverMonth(transactions, currentMetrics, investmentAccountIds = new Set()) {
  const now = new Date();
  const currentMonthStart = getStartOfMonth(now);

  // For fair comparison, use same number of days in both months
  // e.g., Jan 1-12 vs Dec 1-12 (not Jan 1-12 vs Dec 1-31)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthSameDay = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  lastMonthSameDay.setHours(23, 59, 59, 999);

  // Get transactions for the same date range in both months
  const currentMonthTxns = getTransactionsForRange(transactions, currentMonthStart, now);
  const lastMonthTxns = getTransactionsForRange(transactions, lastMonthStart, lastMonthSameDay);

  // Process each month (excluding investment accounts)
  const current = processTransactions(currentMonthTxns, investmentAccountIds);
  const previous = processTransactions(lastMonthTxns, investmentAccountIds);

  const currentTotals = current.totals;
  const previousTotals = previous.totals;

  // Calculate changes
  const incomeChange = currentTotals.income - previousTotals.income;
  const expenseChange = currentTotals.expenses - previousTotals.expenses;
  const netChange = currentTotals.net - previousTotals.net;

  const incomeChangePercent = previousTotals.income > 0
    ? (incomeChange / previousTotals.income) * 100
    : 0;
  const expenseChangePercent = previousTotals.expenses > 0
    ? (expenseChange / previousTotals.expenses) * 100
    : 0;

  // Savings rate calculation
  const currentSavingsRate = currentTotals.income > 0
    ? ((currentTotals.income - currentTotals.expenses) / currentTotals.income) * 100
    : 0;
  const previousSavingsRate = previousTotals.income > 0
    ? ((previousTotals.income - previousTotals.expenses) / previousTotals.income) * 100
    : 0;
  const savingsRateChange = currentSavingsRate - previousSavingsRate;

  // Category comparison
  const currentCategories = aggregateByCategory(currentMonthTxns);
  const previousCategories = aggregateByCategory(lastMonthTxns);

  const categoryChanges = [];
  const allCategories = new Set([
    ...Object.keys(currentCategories),
    ...Object.keys(previousCategories)
  ]);

  allCategories.forEach(category => {
    const currentAmount = currentCategories[category] || 0;
    const previousAmount = previousCategories[category] || 0;
    const change = currentAmount - previousAmount;
    const changePercent = previousAmount > 0
      ? (change / previousAmount) * 100
      : (currentAmount > 0 ? 100 : 0);

    if (Math.abs(change) > 10) { // Only include meaningful changes
      categoryChanges.push({
        category,
        current: currentAmount,
        previous: previousAmount,
        change,
        changePercent: Math.round(changePercent)
      });
    }
  });

  // Sort by absolute change
  categoryChanges.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  // Determine if we're comparing partial months
  const dayOfMonth = now.getDate();
  const isPartialMonth = dayOfMonth < 28;

  // Build display names showing the actual date range being compared
  const currentMonthName = currentMonthStart.toLocaleDateString('en-US', { month: 'long' });
  const lastMonthName = lastMonthStart.toLocaleDateString('en-US', { month: 'long' });
  const currentYear = now.getFullYear();
  const lastYear = lastMonthStart.getFullYear();

  let currentPeriodName, lastPeriodName;
  if (isPartialMonth) {
    currentPeriodName = `${currentMonthName} 1-${dayOfMonth}, ${currentYear}`;
    lastPeriodName = `${lastMonthName} 1-${dayOfMonth}, ${lastYear}`;
  } else {
    currentPeriodName = `${currentMonthName} ${currentYear}`;
    lastPeriodName = `${lastMonthName} ${lastYear}`;
  }

  return {
    available: true,
    isPartialMonth,
    daysCompared: dayOfMonth,
    currentMonth: {
      name: currentPeriodName,
      income: currentTotals.income,
      expenses: currentTotals.expenses,
      net: currentTotals.net,
      savingsRate: Math.round(currentSavingsRate * 10) / 10
    },
    previousMonth: {
      name: lastPeriodName,
      income: previousTotals.income,
      expenses: previousTotals.expenses,
      net: previousTotals.net,
      savingsRate: Math.round(previousSavingsRate * 10) / 10
    },
    changes: {
      income: incomeChange,
      incomePercent: Math.round(incomeChangePercent * 10) / 10,
      expenses: expenseChange,
      expensesPercent: Math.round(expenseChangePercent * 10) / 10,
      net: netChange,
      savingsRate: Math.round(savingsRateChange * 10) / 10
    },
    topCategoryChanges: categoryChanges.slice(0, 5)
  };
}

// ============================================
// Year-over-Year Comparison
// ============================================

/**
 * Calculate year-over-year comparison
 * Uses YNAB transaction history (available back to November 2018)
 * @param {Array} transactions - All YNAB transactions
 * @param {Object} currentMetrics - Current metrics
 * @param {Array} snapshots - Historical newsletter snapshots (for net worth YoY)
 * @param {Set} investmentAccountIds - Set of investment account IDs to exclude
 * @returns {Object} - YoY comparison data
 */
function calculateYearOverYear(transactions, currentMetrics, snapshots = [], investmentAccountIds = new Set()) {
  const now = new Date();
  const currentMonthStart = getStartOfMonth(now);

  // Use same date range for fair comparison (e.g., Jan 1-12 this year vs Jan 1-12 last year)
  const lastYearStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const lastYearSameDay = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  lastYearSameDay.setHours(23, 59, 59, 999);

  // Get transactions for the same date range in both years
  const currentMonthTxns = getTransactionsForRange(transactions, currentMonthStart, now);
  const lastYearMonthTxns = getTransactionsForRange(transactions, lastYearStart, lastYearSameDay);

  // Check if we have data from last year
  const hasLastYearData = lastYearMonthTxns.length > 0;

  // Calculate how many days we're comparing
  const daysInComparison = now.getDate();
  const isPartialMonth = daysInComparison < 28;

  if (!hasLastYearData) {
    return {
      available: false,
      message: 'Year-over-year data will be available once you have transaction history from the same month last year.'
    };
  }

  // Process transactions (excluding investment accounts)
  const currentData = processTransactions(currentMonthTxns, investmentAccountIds);
  const lastYearData = processTransactions(lastYearMonthTxns, investmentAccountIds);

  const currentTotals = currentData.totals;
  const lastYearTotals = lastYearData.totals;

  // Spending comparison
  const spendingChange = currentTotals.expenses - lastYearTotals.expenses;
  const spendingChangePercent = lastYearTotals.expenses > 0
    ? (spendingChange / lastYearTotals.expenses) * 100
    : 0;

  // Income comparison
  const incomeChange = currentTotals.income - lastYearTotals.income;
  const incomeChangePercent = lastYearTotals.income > 0
    ? (incomeChange / lastYearTotals.income) * 100
    : 0;

  // Category YoY comparison
  const currentCategories = aggregateByCategory(currentMonthTxns);
  const lastYearCategories = aggregateByCategory(lastYearMonthTxns);

  const categoryComparison = [];
  const allCategories = new Set([
    ...Object.keys(currentCategories),
    ...Object.keys(lastYearCategories)
  ]);

  allCategories.forEach(category => {
    const currentAmount = currentCategories[category] || 0;
    const lastYearAmount = lastYearCategories[category] || 0;
    const change = currentAmount - lastYearAmount;
    const changePercent = lastYearAmount > 0
      ? (change / lastYearAmount) * 100
      : (currentAmount > 0 ? 100 : 0);

    if (currentAmount > 50 || lastYearAmount > 50) { // Only include meaningful categories
      categoryComparison.push({
        category,
        current: currentAmount,
        lastYear: lastYearAmount,
        change,
        changePercent: Math.round(changePercent)
      });
    }
  });

  categoryComparison.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  // Net worth YoY (requires snapshots)
  let netWorthYoY = { available: false };
  if (snapshots?.length > 0 && currentMetrics?.netWorth) {
    // Find snapshot from same month last year
    const lastYearMonthKey = getMonthKey(lastYearStart);
    const lastYearSnapshot = snapshots.find(s => s.month === lastYearMonthKey);

    if (lastYearSnapshot?.netWorth) {
      const netWorthChange = currentMetrics.netWorth.total - lastYearSnapshot.netWorth;
      const netWorthChangePercent = lastYearSnapshot.netWorth !== 0
        ? (netWorthChange / Math.abs(lastYearSnapshot.netWorth)) * 100
        : 0;

      netWorthYoY = {
        available: true,
        current: currentMetrics.netWorth.total,
        lastYear: lastYearSnapshot.netWorth,
        change: netWorthChange,
        changePercent: Math.round(netWorthChangePercent * 10) / 10
      };
    } else {
      netWorthYoY = {
        available: false,
        message: 'Net worth comparison will be available after 12 months of newsletters'
      };
    }
  }

  // Seasonal note
  let seasonalNote = '';

  // Add seasonal context based on month
  if (now.getMonth() === 0) { // January
    seasonalNote = 'January spending typically drops 15-20% from December holiday spending.';
  } else if (now.getMonth() === 11) { // December
    seasonalNote = 'December often sees increased spending due to holidays and gift-giving.';
  } else if (now.getMonth() >= 5 && now.getMonth() <= 7) { // Summer
    seasonalNote = 'Summer months often see higher travel and entertainment expenses.';
  }

  // Format date range for display
  const monthName = currentMonthStart.toLocaleDateString('en-US', { month: 'long' });
  const currentYear = now.getFullYear();
  const lastYear = now.getFullYear() - 1;
  const dayOfMonth = now.getDate();

  // Build display names showing the actual date range being compared
  let currentPeriodName, lastYearPeriodName;
  if (isPartialMonth) {
    currentPeriodName = `${monthName} 1-${dayOfMonth}, ${currentYear}`;
    lastYearPeriodName = `${monthName} 1-${dayOfMonth}, ${lastYear}`;
  } else {
    currentPeriodName = `${monthName} ${currentYear}`;
    lastYearPeriodName = `${monthName} ${lastYear}`;
  }

  return {
    available: true,
    isPartialMonth,
    daysCompared: dayOfMonth,
    currentMonth: {
      name: currentPeriodName,
      spending: currentTotals.expenses,
      income: currentTotals.income
    },
    lastYearMonth: {
      name: lastYearPeriodName,
      spending: lastYearTotals.expenses,
      income: lastYearTotals.income
    },
    spending: {
      change: spendingChange,
      changePercent: Math.round(spendingChangePercent * 10) / 10
    },
    income: {
      change: incomeChange,
      changePercent: Math.round(incomeChangePercent * 10) / 10
    },
    categoryComparison: categoryComparison.slice(0, 5),
    netWorth: netWorthYoY,
    seasonalNote
  };
}

// ============================================
// Annual Progress Dashboard
// ============================================

/**
 * Calculate year-to-date progress and annual projections
 * @param {Array} transactions - All YNAB transactions
 * @param {Object} currentMetrics - Current metrics including net worth
 * @param {Array} snapshots - Historical newsletter snapshots
 * @param {Object} goals - User's annual goals (optional)
 * @param {Set} investmentAccountIds - Set of investment account IDs to exclude
 * @returns {Object} - Annual progress data
 */
function calculateAnnualProgress(transactions, currentMetrics, snapshots = [], goals = {}, investmentAccountIds = new Set()) {
  const now = new Date();
  const startOfYear = getStartOfYear(now);
  const currentMonth = getStartOfMonth(now);

  // Calculate how far into the year we are
  const dayOfYear = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000)) + 1;
  const daysInYear = (new Date(now.getFullYear(), 11, 31) - startOfYear) / (24 * 60 * 60 * 1000) + 1;
  const yearProgress = dayOfYear / daysInYear;
  const monthsCompleted = now.getMonth() + (now.getDate() / 30);

  // Get YTD transactions
  const ytdTransactions = getTransactionsForRange(transactions, startOfYear, now);
  const ytdData = processTransactions(ytdTransactions, investmentAccountIds);

  const ytdIncome = ytdData.totals.income;
  const ytdExpenses = ytdData.totals.expenses;
  const ytdSavings = ytdIncome - ytdExpenses;

  // Savings rate
  const ytdSavingsRate = ytdIncome > 0 ? (ytdSavings / ytdIncome) * 100 : 0;
  const targetSavingsRate = goals.savingsRate || 25;
  const savingsRateOnTrack = ytdSavingsRate >= targetSavingsRate;

  // Investment contributions (from CSP data if available)
  const ytdInvestments = currentMetrics?.csp?.buckets?.investments?.total || 0;
  const annualInvestmentGoal = goals.investmentContributions || 24000;
  const investmentProgress = (ytdInvestments / annualInvestmentGoal) * 100;
  const expectedInvestmentProgress = yearProgress * 100;
  const investmentsOnTrack = investmentProgress >= expectedInvestmentProgress * 0.9; // Allow 10% buffer

  // Project annual totals
  const projectedAnnualIncome = ytdIncome / yearProgress;
  const projectedAnnualExpenses = ytdExpenses / yearProgress;
  const projectedAnnualSavings = ytdSavings / yearProgress;
  const projectedInvestments = ytdInvestments / yearProgress;

  // Net worth progress (compare to start of year snapshot)
  let netWorthProgress = { available: false };
  if (currentMetrics?.netWorth && snapshots?.length > 0) {
    // Find snapshot from January or earliest this year
    const yearStartKey = `${now.getFullYear()}-01`;
    const startOfYearSnapshot = snapshots.find(s => s.month === yearStartKey) ||
      snapshots.find(s => s.year === now.getFullYear());

    if (startOfYearSnapshot?.netWorth !== undefined) {
      const startingNetWorth = startOfYearSnapshot.netWorth;
      const currentNetWorth = currentMetrics.netWorth.total;
      const netWorthGrowth = currentNetWorth - startingNetWorth;
      const netWorthGrowthPercent = startingNetWorth !== 0
        ? (netWorthGrowth / Math.abs(startingNetWorth)) * 100
        : 0;

      // Project full year growth
      const projectedAnnualGrowth = netWorthGrowth / yearProgress;
      const projectedYearEndNetWorth = startingNetWorth + projectedAnnualGrowth;

      netWorthProgress = {
        available: true,
        startOfYear: startingNetWorth,
        current: currentNetWorth,
        growth: netWorthGrowth,
        growthPercent: Math.round(netWorthGrowthPercent * 10) / 10,
        projectedYearEnd: Math.round(projectedYearEndNetWorth),
        projectedAnnualGrowth: Math.round(projectedAnnualGrowth)
      };
    }
  }

  // Compare to last year's full year performance
  let vsLastYear = { available: false };
  const lastYear = now.getFullYear() - 1;
  const lastYearStart = new Date(lastYear, 0, 1);
  const lastYearEnd = new Date(lastYear, 11, 31, 23, 59, 59);
  const lastYearSamePoint = new Date(lastYear, now.getMonth(), now.getDate());

  const lastYearYtdTxns = getTransactionsForRange(transactions, lastYearStart, lastYearSamePoint);
  if (lastYearYtdTxns.length > 0) {
    const lastYearYtd = processTransactions(lastYearYtdTxns, investmentAccountIds);
    const lastYearYtdSavings = lastYearYtd.totals.income - lastYearYtd.totals.expenses;
    const lastYearYtdSavingsRate = lastYearYtd.totals.income > 0
      ? (lastYearYtdSavings / lastYearYtd.totals.income) * 100
      : 0;

    vsLastYear = {
      available: true,
      lastYearYtdSavingsRate: Math.round(lastYearYtdSavingsRate * 10) / 10,
      savingsRateImprovement: Math.round((ytdSavingsRate - lastYearYtdSavingsRate) * 10) / 10,
      lastYearYtdExpenses: lastYearYtd.totals.expenses,
      expenseChange: ytdExpenses - lastYearYtd.totals.expenses,
      expenseChangePercent: lastYearYtd.totals.expenses > 0
        ? Math.round(((ytdExpenses - lastYearYtd.totals.expenses) / lastYearYtd.totals.expenses) * 100)
        : 0
    };
  }

  return {
    available: true,
    yearProgress: Math.round(yearProgress * 100),
    monthsCompleted: Math.round(monthsCompleted * 10) / 10,

    // YTD Actuals
    ytd: {
      income: ytdIncome,
      expenses: ytdExpenses,
      savings: ytdSavings,
      savingsRate: Math.round(ytdSavingsRate * 10) / 10,
      investments: ytdInvestments
    },

    // Goals & Progress
    goals: {
      savingsRate: {
        target: targetSavingsRate,
        actual: Math.round(ytdSavingsRate * 10) / 10,
        onTrack: savingsRateOnTrack
      },
      investments: {
        target: annualInvestmentGoal,
        actual: ytdInvestments,
        progress: Math.round(investmentProgress),
        expectedProgress: Math.round(expectedInvestmentProgress),
        onTrack: investmentsOnTrack
      }
    },

    // Projections
    projections: {
      annualIncome: Math.round(projectedAnnualIncome),
      annualExpenses: Math.round(projectedAnnualExpenses),
      annualSavings: Math.round(projectedAnnualSavings),
      annualInvestments: Math.round(projectedInvestments)
    },

    netWorthProgress,
    vsLastYear
  };
}

// ============================================
// Weekly Trends (for weekly newsletter)
// ============================================

/**
 * Calculate true expenses for a set of transactions (excluding investments/savings)
 * @param {Array} transactions - Transactions to process
 * @param {Set} investmentAccountIds - Account IDs to exclude
 * @param {Object} cspSettings - CSP settings for categorization
 * @returns {number} - Total true expenses
 */
function calculateTrueExpenses(transactions, investmentAccountIds = new Set(), cspSettings = {}) {
  let totalExpenses = 0;

  transactions.forEach(txn => {
    // Skip investment account transactions
    if (investmentAccountIds.has(txn.account_id)) return;
    // Skip excluded transactions (transfers, reconciliation, etc.)
    if (shouldExcludeTransaction(txn)) return;
    // Skip income
    if (isIncomeCategory(txn.category_name)) return;

    const amount = getTransactionAmount(txn);
    // Only count negative amounts (outflows) that are true expenses
    if (amount < 0 && isTrueExpense(txn.category_name, txn.category_group_name, cspSettings, txn.category_id)) {
      totalExpenses += Math.abs(amount);
    }
  });

  return totalExpenses;
}

/**
 * Calculate week-over-week trends
 * @param {Array} transactions - All YNAB transactions
 * @param {Set} investmentAccountIds - Set of investment account IDs to exclude
 * @param {Object} cspSettings - CSP settings for categorization
 * @returns {Object} - Weekly comparison data
 */
function calculateWeeklyTrends(transactions, investmentAccountIds = new Set(), cspSettings = {}) {
  const now = new Date();

  // Get start of current week (Sunday)
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - now.getDay());
  currentWeekStart.setHours(0, 0, 0, 0);

  // Get start of last week
  const lastWeekStart = new Date(currentWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const lastWeekEnd = new Date(currentWeekStart);
  lastWeekEnd.setMilliseconds(-1);

  // Get transactions for each week
  const currentWeekTxns = getTransactionsForRange(transactions, currentWeekStart, now);
  const lastWeekTxns = getTransactionsForRange(transactions, lastWeekStart, lastWeekEnd);

  // Calculate true expenses (excluding investments and savings)
  const currentWeekExpenses = calculateTrueExpenses(currentWeekTxns, investmentAccountIds, cspSettings);
  const lastWeekExpenses = calculateTrueExpenses(lastWeekTxns, investmentAccountIds, cspSettings);

  // Calculate 6-week average of true expenses (excluding current partial week)
  const sixWeeksAgo = new Date(lastWeekStart);
  sixWeeksAgo.setDate(sixWeeksAgo.getDate() - (5 * 7)); // 5 more weeks back from last week start
  const historicalTxns = getTransactionsForRange(transactions, sixWeeksAgo, lastWeekEnd);
  const historicalExpenses = calculateTrueExpenses(historicalTxns, investmentAccountIds, cspSettings);
  const sixWeekAverage = historicalExpenses / 6;

  // Days elapsed in current week
  const daysInCurrentWeek = Math.ceil((now - currentWeekStart) / (24 * 60 * 60 * 1000));
  const fullWeekDays = 7;

  // Pro-rate current week if partial
  const proRateFactor = daysInCurrentWeek < fullWeekDays ? fullWeekDays / daysInCurrentWeek : 1;

  return {
    currentWeek: {
      spending: currentWeekExpenses,
      projectedWeekly: currentWeekExpenses * proRateFactor,
      daysElapsed: daysInCurrentWeek,
      topCategories: getTopCategories(aggregateByCategory(currentWeekTxns), 5)
    },
    lastWeek: {
      spending: lastWeekExpenses,
      topCategories: getTopCategories(aggregateByCategory(lastWeekTxns), 5)
    },
    change: {
      amount: currentWeekExpenses - lastWeekExpenses,
      percent: lastWeekExpenses > 0
        ? Math.round(((currentWeekExpenses - lastWeekExpenses) / lastWeekExpenses) * 100)
        : 0
    },
    sixWeekAverage // Average weekly true expenses over past 6 weeks
  };
}

// ============================================
// All Trends Combined
// ============================================

/**
 * Calculate all trend data for the newsletter
 * @param {Array} transactions - All YNAB transactions
 * @param {Object} currentMetrics - Current metrics from metrics.js
 * @param {Array} snapshots - Historical newsletter snapshots
 * @param {Object} goals - User's financial goals
 * @param {Set} investmentAccountIds - Set of investment account IDs to exclude
 * @param {Object} cspSettings - CSP settings for categorization
 * @returns {Object} - All trend data
 */
function calculateAllTrends(transactions, currentMetrics, snapshots = [], goals = {}, investmentAccountIds = new Set(), cspSettings = {}) {
  return {
    weekly: calculateWeeklyTrends(transactions, investmentAccountIds, cspSettings),
    monthOverMonth: calculateMonthOverMonth(transactions, currentMetrics, investmentAccountIds),
    yearOverYear: calculateYearOverYear(transactions, currentMetrics, snapshots, investmentAccountIds),
    annualProgress: calculateAnnualProgress(transactions, currentMetrics, snapshots, goals, investmentAccountIds),
    calculatedAt: new Date().toISOString()
  };
}

module.exports = {
  calculateMonthOverMonth,
  calculateYearOverYear,
  calculateAnnualProgress,
  calculateWeeklyTrends,
  calculateAllTrends
};
