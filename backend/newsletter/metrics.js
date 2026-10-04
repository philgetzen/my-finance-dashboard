/**
 * Newsletter Metrics Calculator
 * Core metrics: netWorth, runway, CSP buckets, burnRate, top categories
 *
 * All income and spending figures come from the classified ledger in
 * cashflow.js, so every section uses the same definitions. Monthly averages use
 * complete calendar months only: a partial current month would understate them.
 */

const {
  todayKey,
  addDays,
  reportWeek,
  monthStart,
  completeMonths,
  formatKey,
  isDebtAccount,
  isHomeValueAccount,
  isInvestmentAccount,
  isCashAccount,
  isOnBudget,
  buildLedger,
  summarize
} = require('./cashflow');

// ============================================
// CSP (Conscious Spending Plan) Configuration
// ============================================

// Ramit Sethi's Conscious Spending Plan recommended percentages
const CSP_TARGETS = {
  fixedCosts: { min: 50, max: 60, label: 'Fixed Costs' },
  investments: { min: 10, max: 10, label: 'Investments' },
  savings: { min: 5, max: 10, label: 'Savings' },
  guiltFree: { min: 20, max: 35, label: 'Guilt-Free Spending' }
};

// ============================================
// Net Worth Calculation
// ============================================

/**
 * Calculate net worth from YNAB accounts
 * @param {Array} accounts - YNAB accounts array
 * @returns {Object} - { total, assets, investments, savings, debt, breakdown }
 */
function calculateNetWorth(accounts) {
  const netWorthAccounts = { assets: [], investments: [], savings: [], debt: [] };

  (accounts || []).forEach(acc => {
    if (acc.closed) return;

    const accountInfo = {
      id: acc.id,
      name: acc.name,
      balance: (acc.balance || 0) / 1000,
      type: (acc.type || '').toLowerCase(),
      isOnBudget: isOnBudget(acc)
    };

    if (isDebtAccount(acc)) {
      netWorthAccounts.debt.push(accountInfo);
    } else if (isHomeValueAccount(acc)) {
      netWorthAccounts.assets.push(accountInfo);
    } else if (isInvestmentAccount(acc)) {
      netWorthAccounts.investments.push(accountInfo);
    } else if (isCashAccount(acc)) {
      netWorthAccounts.savings.push(accountInfo);
    } else {
      netWorthAccounts.assets.push(accountInfo);
    }
  });

  const sum = list => list.reduce((total, acc) => total + acc.balance, 0);
  const assets = sum(netWorthAccounts.assets);
  const investments = sum(netWorthAccounts.investments);
  const savings = sum(netWorthAccounts.savings);
  // Liability balances are negative in YNAB; a card carrying a credit is an asset
  const debt = -sum(netWorthAccounts.debt);

  return {
    total: assets + investments + savings - debt,
    assets,
    investments,
    savings,
    debt,
    breakdown: netWorthAccounts
  };
}

// ============================================
// Monthly history
// ============================================

/**
 * Summaries for the last `periodMonths` complete months, oldest first
 */
function getMonthlyHistory(ledger, today, periodMonths = 6) {
  return completeMonths(today, periodMonths).map(({ monthKey, start, end }) => {
    const summary = summarize(ledger.lines, start, end);
    return {
      monthKey,
      monthName: formatKey(start, { month: 'short', year: '2-digit' }),
      income: summary.income,
      expenses: summary.spending,
      investing: summary.investing,
      saving: summary.saving,
      net: summary.net,
      summary
    };
  });
}

function hasActivity(month) {
  return month.income !== 0 || month.expenses !== 0 || month.investing !== 0;
}

// ============================================
// Cash Runway Calculation
// ============================================

/**
 * Calculate cash runway metrics
 * @param {Array} accounts - YNAB accounts array
 * @param {Array} monthlyHistory - Output of getMonthlyHistory
 * @returns {Object} - Runway metrics
 */
function calculateRunway(accounts, monthlyHistory = []) {
  let checking = 0;
  let savings = 0;
  let cash = 0;

  (accounts || []).forEach(acc => {
    if (!isCashAccount(acc)) return;
    const balance = (acc.balance || 0) / 1000;
    const accType = (acc.type || '').toLowerCase();

    if (accType === 'checking') checking += balance;
    else if (accType === 'savings') savings += balance;
    else cash += balance;
  });

  const cashReserves = checking + savings + cash;

  // Months before the budget had data would drag the averages toward zero
  const validMonths = monthlyHistory.filter(hasActivity);
  const numMonths = Math.max(validMonths.length, 1);

  const avgMonthlyExpenses = validMonths.reduce((sum, m) => sum + m.expenses, 0) / numMonths;
  const avgMonthlyIncome = validMonths.reduce((sum, m) => sum + m.income, 0) / numMonths;
  const avgMonthlyInvesting = validMonths.reduce((sum, m) => sum + m.investing, 0) / numMonths;
  const avgMonthlyNet = avgMonthlyIncome - avgMonthlyExpenses;

  const pureRunwayMonths = avgMonthlyExpenses > 0 ? cashReserves / avgMonthlyExpenses : Infinity;
  const netRunwayMonths = avgMonthlyNet >= 0 ? Infinity : cashReserves / Math.abs(avgMonthlyNet);

  // Health is based on the runway the newsletter shows (accounts for income)
  let runwayHealth = 'excellent';
  if (netRunwayMonths < 3) {
    runwayHealth = 'critical';
  } else if (netRunwayMonths < 6) {
    runwayHealth = 'caution';
  } else if (netRunwayMonths < 12) {
    runwayHealth = 'healthy';
  }

  return {
    cashReserves,
    cashBreakdown: { checking, savings, cash },
    avgMonthlyExpenses,
    avgMonthlyIncome,
    avgMonthlyInvesting,
    avgMonthlyNet,
    pureRunwayMonths,
    netRunwayMonths,
    runwayHealth,
    monthsAveraged: validMonths.length
  };
}

// ============================================
// CSP Bucket Calculation
// ============================================

/**
 * Calculate CSP bucket percentages over complete months
 * Investments include transfers to investment accounts (matches the dashboard).
 * @param {Array} monthlyHistory - Output of getMonthlyHistory
 * @returns {Object} - CSP data with buckets, percentages, and suggestions
 */
function calculateCSPBuckets(monthlyHistory = []) {
  const validMonths = monthlyHistory.filter(hasActivity);
  const numMonths = Math.max(validMonths.length, 1);

  let totalIncome = 0;
  const bucketTotals = { fixedCosts: 0, investments: 0, savings: 0, guiltFree: 0 };
  const categoryTotals = new Map();

  validMonths.forEach(month => {
    totalIncome += month.income;
    Object.keys(bucketTotals).forEach(key => {
      bucketTotals[key] += month.summary.bucketTotals[key] || 0;
    });
    month.summary.byCategory.forEach(cat => {
      const existing = categoryTotals.get(cat.key) || { name: cat.name, amount: 0, bucket: cat.bucket };
      existing.amount += cat.amount;
      categoryTotals.set(cat.key, existing);
    });
  });

  const monthlyIncome = totalIncome / numMonths;

  const buckets = {};
  Object.entries(bucketTotals).forEach(([key, total]) => {
    const monthlyAmount = total / numMonths;
    const percentage = monthlyIncome > 0 ? (monthlyAmount / monthlyIncome) * 100 : 0;

    // Fixed costs and guilt-free are only a problem above max; investments and savings below min
    const isOnTarget = (key === 'fixedCosts' || key === 'guiltFree')
      ? percentage <= CSP_TARGETS[key].max
      : percentage >= CSP_TARGETS[key].min;

    buckets[key] = {
      amount: monthlyAmount,
      total,
      percentage: Math.round(percentage * 10) / 10,
      target: CSP_TARGETS[key],
      isOnTarget
    };
  });

  const suggestions = [];

  if (monthlyIncome > 0) {
    if (buckets.fixedCosts.percentage > CSP_TARGETS.fixedCosts.max) {
      suggestions.push({
        type: 'warning',
        bucket: 'fixedCosts',
        message: `Fixed costs at ${Math.round(buckets.fixedCosts.percentage)}% of income - consider reducing to under ${CSP_TARGETS.fixedCosts.max}%`
      });
    }
    if (buckets.guiltFree.percentage > CSP_TARGETS.guiltFree.max) {
      suggestions.push({
        type: 'warning',
        bucket: 'guiltFree',
        message: `Guilt-free spending at ${Math.round(buckets.guiltFree.percentage)}% of income - consider reducing to under ${CSP_TARGETS.guiltFree.max}%`
      });
    }
    if (buckets.investments.percentage < CSP_TARGETS.investments.min) {
      suggestions.push({
        type: 'alert',
        bucket: 'investments',
        message: `Investing ${Math.round(buckets.investments.percentage)}% of income - try to reach at least ${CSP_TARGETS.investments.min}%`
      });
    }
    if (buckets.savings.percentage < CSP_TARGETS.savings.min) {
      suggestions.push({
        type: 'alert',
        bucket: 'savings',
        message: `Savings at ${Math.round(buckets.savings.percentage)}% of income - aim for at least ${CSP_TARGETS.savings.min}%`
      });
    }
  }

  const isOnTrack = monthlyIncome > 0 &&
    buckets.fixedCosts.percentage <= CSP_TARGETS.fixedCosts.max &&
    buckets.guiltFree.percentage <= CSP_TARGETS.guiltFree.max &&
    buckets.investments.percentage >= CSP_TARGETS.investments.min &&
    buckets.savings.percentage >= CSP_TARGETS.savings.min;

  const topCategories = Array.from(categoryTotals.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
    .map(cat => ({ ...cat, monthlyAmount: cat.amount / numMonths }));

  return {
    monthlyIncome,
    totalIncome,
    buckets,
    isOnTrack,
    suggestions,
    topCategories,
    monthsAnalyzed: validMonths.length
  };
}

// ============================================
// Burn Rate Calculation
// ============================================

/**
 * Calculate burn rate metrics from complete months, plus month-to-date spending
 * @param {Array} monthlyHistory - Output of getMonthlyHistory
 * @param {Object} monthToDate - summarize() output for the current month so far
 * @returns {Object} - Burn rate metrics
 */
function calculateBurnRate(monthlyHistory = [], monthToDate = null) {
  const validMonths = monthlyHistory.filter(hasActivity);

  if (validMonths.length === 0) {
    return {
      currentMonth: monthToDate?.spending || 0,
      average: 0,
      trend: 'stable',
      trendPercent: 0,
      monthlyHistory: []
    };
  }

  const average = validMonths.reduce((sum, m) => sum + m.expenses, 0) / validMonths.length;

  // Compare the last 3 complete months to the 3 before them
  let trend = 'stable';
  let trendPercent = 0;

  if (validMonths.length >= 4) {
    const recentMonths = validMonths.slice(-3);
    const previousMonths = validMonths.slice(-6, -3);
    const recentAvg = recentMonths.reduce((sum, m) => sum + m.expenses, 0) / recentMonths.length;
    const previousAvg = previousMonths.reduce((sum, m) => sum + m.expenses, 0) / previousMonths.length;

    if (previousAvg > 0) {
      trendPercent = ((recentAvg - previousAvg) / previousAvg) * 100;
      if (trendPercent > 5) trend = 'increasing';
      else if (trendPercent < -5) trend = 'decreasing';
    }
  }

  return {
    currentMonth: monthToDate?.spending || 0,
    average,
    trend,
    trendPercent: Math.round(trendPercent * 10) / 10,
    monthlyHistory: monthlyHistory.map(m => ({
      month: m.monthName,
      expenses: m.expenses,
      income: m.income,
      investing: m.investing
    }))
  };
}

// ============================================
// Top Spending Categories
// ============================================

function compareToAverage(current, averages) {
  return current.slice(0, 10).map(({ key, name, amount }) => {
    const average = averages.get(key) || 0;
    const vsAverage = average > 0 ? ((amount - average) / average) * 100 : 0;

    return {
      name,
      amount,
      average,
      vsAverage: Math.round(vsAverage),
      vsAverageLabel: vsAverage > 0 ? `+${Math.round(vsAverage)}%` : `${Math.round(vsAverage)}%`
    };
  });
}

/**
 * Month-to-date spending by category vs the category's average complete month
 * @param {Object} monthToDate - summarize() output for the current month so far
 * @param {Array} monthlyHistory - Output of getMonthlyHistory
 * @returns {Array} - Top categories with amounts and vs-average comparison
 */
function getTopSpendingCategories(monthToDate, monthlyHistory = []) {
  if (!monthToDate) return [];

  const validMonths = monthlyHistory.filter(hasActivity);
  const numMonths = Math.max(validMonths.length, 1);
  const totals = new Map();
  validMonths.forEach(month => {
    month.summary.byCategory.forEach(cat => {
      totals.set(cat.key, (totals.get(cat.key) || 0) + cat.amount);
    });
  });

  const averages = new Map();
  totals.forEach((total, key) => averages.set(key, total / numMonths));

  return compareToAverage(monthToDate.byCategory, averages);
}

/**
 * This week's spending by category vs the category's average over the prior 6 weeks
 * Uses the same Sunday-Saturday report week as trends
 * @param {Object} ledger - Output of buildLedger
 * @param {string} today - 'YYYY-MM-DD'
 * @returns {Array} - Top categories with weekly comparison
 */
function getWeeklyTopCategories(ledger, today) {
  const { start: weekStart, end: weekEnd } = reportWeek(today);
  const thisWeek = summarize(ledger.lines, weekStart, weekEnd);
  const history = summarize(ledger.lines, addDays(weekStart, -42), addDays(weekStart, -1));

  const averages = new Map();
  history.byCategory.forEach(cat => averages.set(cat.key, cat.amount / 6));

  return compareToAverage(thisWeek.byCategory, averages);
}

// ============================================
// All Metrics Combined
// ============================================

/**
 * Calculate all newsletter metrics
 * @param {Object} data - YNAB data (accounts, transactions, categories)
 * @param {Object} options - { periodMonths, cspSettings, today ('YYYY-MM-DD'), timeZone }
 * @returns {Object} - All metrics
 */
function calculateAllMetrics(data, options = {}) {
  const { accounts = [] } = data;
  const {
    periodMonths = 6,
    cspSettings = {},
    timeZone = process.env.NEWSLETTER_TIMEZONE || 'America/Los_Angeles'
  } = options;
  const today = options.today || todayKey(timeZone);

  const ledger = buildLedger(data, cspSettings);
  const monthlyHistory = getMonthlyHistory(ledger, today, periodMonths);
  const monthToDate = summarize(ledger.lines, monthStart(today), today);

  const investmentAccountIds = new Set(accounts.filter(isInvestmentAccount).map(acc => acc.id));

  return {
    today,
    ledger,
    netWorth: calculateNetWorth(accounts),
    runway: calculateRunway(accounts, monthlyHistory),
    csp: calculateCSPBuckets(monthlyHistory),
    burnRate: calculateBurnRate(monthlyHistory, monthToDate),
    topCategories: getTopSpendingCategories(monthToDate, monthlyHistory),
    weeklyTopCategories: getWeeklyTopCategories(ledger, today),
    monthlyHistory,
    investmentAccountIds,
    calculatedAt: new Date().toISOString()
  };
}

module.exports = {
  CSP_TARGETS,
  calculateNetWorth,
  calculateRunway,
  calculateCSPBuckets,
  calculateBurnRate,
  getMonthlyHistory,
  getTopSpendingCategories,
  getWeeklyTopCategories,
  calculateAllMetrics
};
