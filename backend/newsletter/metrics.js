/**
 * Newsletter Metrics Calculator
 * Core metrics: netWorth, runway, CSP buckets, burnRate
 * Ported from frontend hooks for backend newsletter generation
 */

const {
  milliunitsToAmount,
  getTransactionAmount,
  isIncomeCategory,
  shouldExcludeTransaction,
  getMonthKey,
  getMonthlyRangeData,
  processTransactions
} = require('./helpers');

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

// Map YNAB group names to CSP buckets (matches frontend constants.js GROUP_NAME_TO_BUCKET)
const GROUP_NAME_TO_BUCKET = {
  // Fixed Costs variations
  'fixed costs': 'fixedCosts',
  'fixed': 'fixedCosts',
  'bills': 'fixedCosts',
  'monthly bills': 'fixedCosts',
  // Investments variations
  'investments': 'investments',
  'investing': 'investments',
  'post tax investments': 'investments',
  'post-tax investments': 'investments',
  // Savings variations
  'savings': 'savings',
  'saving': 'savings',
  'savings goals': 'savings',
  'true expenses': 'guiltFree', // Common YNAB pattern - irregular but expected expenses
  // Guilt-free variations
  'guilt-free': 'guiltFree',
  'guilt free': 'guiltFree',
  'guilt-free spending': 'guiltFree',
  'discretionary': 'guiltFree',
  'fun money': 'guiltFree',
  'spending': 'guiltFree',
  'variable expenses': 'guiltFree',
};

// Default keyword-based mappings for CSP bucket inference (category name only)
// Matches frontend constants.js DEFAULT_FIXED_COST_KEYWORDS
const DEFAULT_FIXED_COST_KEYWORDS = [
  'rent', 'mortgage', 'utilities', 'electric', 'gas', 'water', 'internet',
  'phone', 'insurance', 'car payment', 'auto', 'transportation', 'groceries',
  'subscription', 'netflix', 'spotify', 'gym', 'membership',
  'loan', 'debt', 'payment', 'cable', 'trash', 'sewer', 'hoa'
];

// Matches frontend constants.js DEFAULT_INVESTMENT_KEYWORDS
const DEFAULT_INVESTMENT_KEYWORDS = [
  'investment', 'retirement', '401k', 'ira', 'roth', 'stock', 'etf',
  'mutual fund', 'brokerage', 'investing'
];

// Matches frontend constants.js DEFAULT_SAVINGS_KEYWORDS
const DEFAULT_SAVINGS_KEYWORDS = [
  'savings', 'emergency', 'vacation', 'travel', 'gift', 'holiday',
  'christmas', 'birthday', 'wedding', 'fund', 'goal', 'reserve',
  'house', 'down payment', 'sinking'
];

// ============================================
// Net Worth Calculation
// ============================================

/**
 * Calculate net worth from YNAB accounts
 * @param {Array} accounts - YNAB accounts array
 * @returns {Object} - { total, assets, investments, savings, debt, breakdown }
 */
function calculateNetWorth(accounts) {
  if (!accounts?.length) {
    return {
      total: 0,
      assets: 0,
      investments: 0,
      savings: 0,
      debt: 0,
      breakdown: { assets: [], investments: [], savings: [], debt: [] }
    };
  }

  const netWorthAccounts = {
    assets: [],
    investments: [],
    savings: [],
    debt: []
  };

  accounts.forEach(acc => {
    // Skip closed accounts
    if (acc.closed) return;

    const balance = milliunitsToAmount(acc.balance || 0);
    const accType = (acc.type || '').toLowerCase();
    const accName = (acc.name || '').toLowerCase();
    const isOnBudget = acc.on_budget !== false;

    const accountInfo = {
      id: acc.id,
      name: acc.name,
      balance,
      type: accType,
      isOnBudget
    };

    // Categorize accounts
    const isHomeValue = accName.includes('home value') || accName.includes('redfin') ||
      accName.includes('zillow') || accName.includes('property value') || accName.includes('real estate');

    const isDebt = accType === 'otherliability' || accType === 'mortgage' || accType === 'loan' ||
      accType === 'creditcard' || accType === 'lineofcredit' ||
      accName.includes('mortgage') || accName.includes('loan') || accName.includes('credit card');

    const isInvestment = !isHomeValue && !isDebt && (
      accType === 'otherasset' ||
      accName.includes('401k') || accName.includes('401(k)') || accName.includes('ira') ||
      accName.includes('roth') || accName.includes('hsa') || accName.includes('brokerage') ||
      accName.includes('investment') || accName.includes('stock') || accName.includes('rsu') ||
      accName.includes('espp') || accName.includes('fidelity') || accName.includes('vanguard') ||
      accName.includes('schwab') || accName.includes('altruist') || accName.includes('retirement')
    );

    const isSavings = !isHomeValue && !isDebt && !isInvestment && (
      accType === 'savings' || accName.includes('savings') || accName.includes('emergency') ||
      accName.includes('hysa') || accName.includes('high yield')
    );

    // Assign to categories
    if (isDebt) {
      netWorthAccounts.debt.push(accountInfo);
    } else if (isHomeValue) {
      netWorthAccounts.assets.push(accountInfo);
    } else if (isInvestment) {
      netWorthAccounts.investments.push(accountInfo);
    } else if (isSavings || accType === 'checking' || accName.includes('checking')) {
      netWorthAccounts.savings.push(accountInfo);
    } else if (!isOnBudget) {
      netWorthAccounts.assets.push(accountInfo);
    } else {
      netWorthAccounts.savings.push(accountInfo);
    }
  });

  const assets = netWorthAccounts.assets.reduce((sum, acc) => sum + acc.balance, 0);
  const investments = netWorthAccounts.investments.reduce((sum, acc) => sum + acc.balance, 0);
  const savings = netWorthAccounts.savings.reduce((sum, acc) => sum + acc.balance, 0);
  const debt = netWorthAccounts.debt.reduce((sum, acc) => sum + Math.abs(acc.balance), 0);
  const total = assets + investments + savings - debt;

  return {
    total,
    assets,
    investments,
    savings,
    debt,
    breakdown: netWorthAccounts
  };
}

// ============================================
// Cash Runway Calculation
// ============================================

/**
 * Calculate cash runway metrics
 * @param {Array} accounts - YNAB accounts array
 * @param {Object} monthlyData - Monthly income/expense data
 * @param {number} periodMonths - Number of months to average (default 6)
 * @returns {Object} - Runway metrics
 */
function calculateRunway(accounts, monthlyData, periodMonths = 6) {
  if (!accounts?.length) {
    return {
      cashReserves: 0,
      cashBreakdown: { checking: 0, savings: 0, cash: 0 },
      avgMonthlyExpenses: 0,
      avgMonthlyIncome: 0,
      avgMonthlyNet: 0,
      pureRunwayMonths: 0,
      netRunwayMonths: 0,
      runwayHealth: 'critical'
    };
  }

  // Calculate cash reserves (checking + savings, not investments)
  let checking = 0;
  let savings = 0;
  let cash = 0;

  accounts.forEach(acc => {
    if (acc.closed) return;

    const balance = milliunitsToAmount(acc.balance || 0);
    const accType = (acc.type || '').toLowerCase();
    const accName = (acc.name || '').toLowerCase();

    // Skip debt accounts
    if (accType === 'creditcard' || accType === 'loan' || accType === 'mortgage' ||
        accType === 'otherliability' || accType === 'lineofcredit') {
      return;
    }

    // Skip investment accounts (YNAB uses 'otherasset' for investment/tracking accounts)
    if (accType === 'otherasset' || accName.includes('401k') || accName.includes('ira') ||
        accName.includes('roth') || accName.includes('brokerage') || accName.includes('investment')) {
      return;
    }

    // Skip property/asset tracking accounts
    if (accName.includes('home value') || accName.includes('property') || accName.includes('redfin')) {
      return;
    }

    // Categorize cash accounts
    if (accType === 'checking' || accName.includes('checking')) {
      checking += balance;
    } else if (accType === 'savings' || accName.includes('savings') || accName.includes('hysa')) {
      savings += balance;
    } else if (accType === 'cash' || acc.on_budget !== false) {
      cash += balance;
    }
  });

  const cashReserves = checking + savings + cash;

  // Get historical data for selected period
  const historicalData = getMonthlyRangeData(monthlyData, periodMonths);
  const validMonths = historicalData.filter(m => m.income > 0 || m.expenses > 0);
  const numMonths = Math.max(validMonths.length, 1);

  // Calculate averages
  const totalExpenses = validMonths.reduce((sum, m) => sum + m.expenses, 0);
  const totalIncome = validMonths.reduce((sum, m) => sum + m.income, 0);

  const avgMonthlyExpenses = totalExpenses / numMonths;
  const avgMonthlyIncome = totalIncome / numMonths;
  const avgMonthlyNet = avgMonthlyIncome - avgMonthlyExpenses;

  // Calculate runway months
  const pureRunwayMonths = avgMonthlyExpenses > 0
    ? cashReserves / avgMonthlyExpenses
    : Infinity;

  const netRunwayMonths = avgMonthlyNet >= 0
    ? Infinity
    : cashReserves / Math.abs(avgMonthlyNet);

  // Determine health status based on realistic runway (accounts for income)
  // If income exceeds expenses, runway is effectively unlimited
  let runwayHealth = 'excellent';
  if (netRunwayMonths === Infinity || avgMonthlyNet >= 0) {
    runwayHealth = 'excellent'; // Positive cash flow = unlimited runway
  } else if (netRunwayMonths < 3) {
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
    avgMonthlyNet,
    pureRunwayMonths,
    netRunwayMonths,
    runwayHealth
  };
}

// ============================================
// CSP Bucket Calculation
// ============================================

/**
 * Categorize a transaction into a CSP bucket
 * Matches frontend getCategoryBucket() priority: custom mapping → group name → keyword (if enabled) → default
 * @param {string} categoryName - Category name
 * @param {string} categoryGroupName - Category group name
 * @param {Object} customMappings - Custom category-to-bucket mappings (by category ID)
 * @param {boolean} useKeywordFallback - Whether to use keyword inference (default false)
 * @param {string} categoryId - Category ID for custom mapping lookup
 * @returns {string} - Bucket name
 */
function categorizeTransaction(categoryName, categoryGroupName, customMappings = {}, useKeywordFallback = false, categoryId = null) {
  if (!categoryName) return 'guiltFree';

  // Priority 1: Custom mappings by category ID or name (matches frontend getCategoryBucket)
  if (categoryId && customMappings[categoryId]) {
    return customMappings[categoryId];
  }
  if (customMappings[categoryName]) {
    return customMappings[categoryName];
  }

  // Priority 2: Group name mapping (matches frontend mapGroupNameToBucket)
  if (categoryGroupName) {
    const normalizedGroup = categoryGroupName.toLowerCase().trim();
    const groupBucket = GROUP_NAME_TO_BUCKET[normalizedGroup];
    if (groupBucket) {
      return groupBucket;
    }
  }

  // Priority 3: Keyword inference on category name only (if enabled)
  if (useKeywordFallback) {
    const lowerCategory = categoryName.toLowerCase().trim();

    // Check investment keywords first (most specific)
    if (DEFAULT_INVESTMENT_KEYWORDS.some(kw => lowerCategory.includes(kw))) {
      return 'investments';
    }

    // Check savings keywords
    if (DEFAULT_SAVINGS_KEYWORDS.some(kw => lowerCategory.includes(kw))) {
      return 'savings';
    }

    // Check fixed cost keywords
    if (DEFAULT_FIXED_COST_KEYWORDS.some(kw => lowerCategory.includes(kw))) {
      return 'fixedCosts';
    }
  }

  // Default: guilt-free spending
  return 'guiltFree';
}

/**
 * Calculate CSP bucket data from YNAB transactions
 * @param {Array} transactions - YNAB transactions array
 * @param {Object} categories - YNAB categories object
 * @param {number} periodMonths - Number of months to analyze
 * @param {Object} cspSettings - Custom CSP settings (category mappings, exclusions)
 * @returns {Object} - CSP data with buckets, percentages, and suggestions
 */
function calculateCSPBuckets(transactions, categories, periodMonths = 6, cspSettings = {}, investmentAccountIds = new Set()) {
  const {
    categoryMappings = {},
    excludedCategories = new Set(),
    excludedPayees = new Set(),
    excludedExpenseCategories = new Set(),
    useKeywordFallback = false
  } = cspSettings;

  if (!transactions?.length) {
    return {
      monthlyIncome: 0,
      buckets: {
        fixedCosts: { amount: 0, percentage: 0, isOnTarget: true },
        investments: { amount: 0, percentage: 0, isOnTarget: false },
        savings: { amount: 0, percentage: 0, isOnTarget: false },
        guiltFree: { amount: 0, percentage: 0, isOnTarget: true }
      },
      isOnTrack: false,
      suggestions: []
    };
  }

  // Build category lookup map
  const categoryMap = new Map();
  if (categories?.category_groups) {
    categories.category_groups.forEach(group => {
      if (group.categories) {
        group.categories.forEach(cat => {
          categoryMap.set(cat.id, { name: cat.name, groupName: group.name });
        });
      }
    });
  }

  // Calculate date range
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - periodMonths + 1, 1);

  // Process transactions
  let totalIncome = 0;
  const bucketTotals = {
    fixedCosts: 0,
    investments: 0,
    savings: 0,
    guiltFree: 0
  };
  const categoryTotals = new Map();

  transactions.forEach(txn => {
    const txnDate = new Date(txn.date);

    if (txnDate < startDate) return;

    // Skip investment account transactions
    if (investmentAccountIds.has(txn.account_id)) return;

    // Skip excluded transactions
    if (shouldExcludeTransaction(txn)) return;

    const amount = getTransactionAmount(txn);
    const categoryInfo = categoryMap.get(txn.category_id) || { name: txn.category_name, groupName: '' };

    // Check if income
    if (isIncomeCategory(txn.category_name)) {
      const payeeName = txn.payee_name || 'Unknown';
      const isPayeeExcluded = excludedPayees.has(payeeName);
      const isCategoryExcluded = excludedCategories.has(txn.category_id);

      if (!isPayeeExcluded && !isCategoryExcluded) {
        totalIncome += amount;
      }
      return;
    }

    // Process expenses
    if (amount < 0) {
      const expenseAmount = Math.abs(amount);
      const isExpenseCategoryExcluded = excludedExpenseCategories.has(txn.category_id);

      if (!isExpenseCategoryExcluded) {
        // Determine bucket using unified categorization (matches frontend getCategoryBucket)
        const bucket = categorizeTransaction(
          categoryInfo.name, categoryInfo.groupName, categoryMappings, useKeywordFallback, txn.category_id
        );

        bucketTotals[bucket] += expenseAmount;

        // Track by category
        const catKey = categoryInfo.name || 'Uncategorized';
        if (!categoryTotals.has(catKey)) {
          categoryTotals.set(catKey, { name: catKey, amount: 0, bucket });
        }
        categoryTotals.get(catKey).amount += expenseAmount;
      }
    }
  });

  // Calculate monthly averages
  const numMonths = Math.max(1, periodMonths);
  const monthlyIncome = totalIncome / numMonths;

  // Build bucket data
  const buckets = {};
  Object.entries(bucketTotals).forEach(([key, total]) => {
    const monthlyAmount = total / numMonths;
    const percentage = monthlyIncome > 0 ? (monthlyAmount / monthlyIncome) * 100 : 0;

    // Determine if on target
    let isOnTarget;
    if (key === 'fixedCosts' || key === 'guiltFree') {
      isOnTarget = percentage <= CSP_TARGETS[key].max;
    } else {
      isOnTarget = percentage >= CSP_TARGETS[key].min;
    }

    buckets[key] = {
      amount: monthlyAmount,
      total,
      percentage: Math.round(percentage * 10) / 10,
      target: CSP_TARGETS[key],
      isOnTarget
    };
  });

  // Generate suggestions
  const suggestions = [];

  if (buckets.fixedCosts.percentage > CSP_TARGETS.fixedCosts.max) {
    suggestions.push({
      type: 'warning',
      bucket: 'fixedCosts',
      message: `Fixed costs at ${Math.round(buckets.fixedCosts.percentage)}% - consider reducing to under ${CSP_TARGETS.fixedCosts.max}%`
    });
  }

  if (buckets.guiltFree.percentage > CSP_TARGETS.guiltFree.max) {
    suggestions.push({
      type: 'warning',
      bucket: 'guiltFree',
      message: `Guilt-free spending at ${Math.round(buckets.guiltFree.percentage)}% - consider reducing to under ${CSP_TARGETS.guiltFree.max}%`
    });
  }

  if (buckets.investments.percentage < CSP_TARGETS.investments.min) {
    suggestions.push({
      type: 'alert',
      bucket: 'investments',
      message: `Investing only ${Math.round(buckets.investments.percentage)}% - try to reach at least ${CSP_TARGETS.investments.min}%`
    });
  }

  if (buckets.savings.percentage < CSP_TARGETS.savings.min) {
    suggestions.push({
      type: 'alert',
      bucket: 'savings',
      message: `Savings at ${Math.round(buckets.savings.percentage)}% - aim for at least ${CSP_TARGETS.savings.min}%`
    });
  }

  // Check if overall plan is on track
  const isOnTrack =
    buckets.fixedCosts.percentage <= CSP_TARGETS.fixedCosts.max &&
    buckets.guiltFree.percentage <= CSP_TARGETS.guiltFree.max &&
    buckets.investments.percentage >= CSP_TARGETS.investments.min &&
    buckets.savings.percentage >= CSP_TARGETS.savings.min;

  // Top categories
  const topCategories = Array.from(categoryTotals.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
    .map(cat => ({
      ...cat,
      monthlyAmount: cat.amount / numMonths
    }));

  return {
    monthlyIncome,
    totalIncome,
    buckets,
    isOnTrack,
    suggestions,
    topCategories
  };
}

// ============================================
// Burn Rate Calculation
// ============================================

/**
 * Calculate burn rate metrics
 * @param {Object} monthlyData - Monthly income/expense data
 * @param {number} periodMonths - Number of months to analyze
 * @returns {Object} - Burn rate metrics
 */
function calculateBurnRate(monthlyData, periodMonths = 6) {
  const historicalData = getMonthlyRangeData(monthlyData, periodMonths);

  if (historicalData.length === 0) {
    return {
      currentMonth: 0,
      average: 0,
      trend: 'stable',
      trendPercent: 0,
      monthlyHistory: []
    };
  }

  // Calculate average
  const total = historicalData.reduce((sum, m) => sum + m.expenses, 0);
  const average = total / historicalData.length;

  // Get current month (most recent)
  const currentMonth = historicalData[historicalData.length - 1]?.expenses || 0;

  // Calculate trend (compare last 3 months to previous 3 months)
  let trend = 'stable';
  let trendPercent = 0;

  if (historicalData.length >= 4) {
    const recentMonths = historicalData.slice(-3);
    const previousMonths = historicalData.slice(-6, -3);

    if (previousMonths.length > 0) {
      const recentAvg = recentMonths.reduce((sum, m) => sum + m.expenses, 0) / recentMonths.length;
      const previousAvg = previousMonths.reduce((sum, m) => sum + m.expenses, 0) / previousMonths.length;

      if (previousAvg > 0) {
        trendPercent = ((recentAvg - previousAvg) / previousAvg) * 100;

        if (trendPercent > 5) {
          trend = 'increasing';
        } else if (trendPercent < -5) {
          trend = 'decreasing';
        }
      }
    }
  }

  return {
    currentMonth,
    average,
    trend,
    trendPercent: Math.round(trendPercent * 10) / 10,
    monthlyHistory: historicalData.map(m => ({
      month: m.monthName,
      expenses: m.expenses,
      income: m.income
    }))
  };
}

// ============================================
// Top Spending Categories
// ============================================

/**
 * Check if a category should be counted as a true expense (not investment/savings)
 * @param {string} categoryName - Category name
 * @param {string} categoryGroupName - Category group name (optional)
 * @param {Object} cspSettings - CSP settings for categorization
 * @param {string} categoryId - Category ID for custom mapping lookup
 * @returns {boolean} - True if this is a real expense
 */
function isTrueExpense(categoryName, categoryGroupName = '', cspSettings = {}, categoryId = null) {
  const { categoryMappings = {}, useKeywordFallback = false } = cspSettings;
  const bucket = categorizeTransaction(categoryName, categoryGroupName, categoryMappings, useKeywordFallback, categoryId);
  // Only count fixed costs and guilt-free as true expenses
  // Investments and savings are wealth-building, not spending
  return bucket === 'fixedCosts' || bucket === 'guiltFree';
}

/**
 * Get top spending categories with comparison to averages
 * @param {Array} transactions - YNAB transactions array
 * @param {Object} monthlyData - Monthly data for average calculation
 * @param {number} periodMonths - Period for average calculation
 * @param {Set} investmentAccountIds - Account IDs to exclude
 * @param {Object} cspSettings - CSP settings for categorization
 * @returns {Array} - Top categories with amounts and vs-average comparison
 */
function getTopSpendingCategories(transactions, monthlyData, periodMonths = 6, investmentAccountIds = new Set(), cspSettings = {}) {
  if (!transactions?.length) return [];

  const now = new Date();
  const currentMonthKey = getMonthKey(now);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get current month spending by category
  const currentMonthSpending = {};
  transactions.forEach(txn => {
    const txnDate = new Date(txn.date);
    if (txnDate < startOfMonth) return;
    if (investmentAccountIds.has(txn.account_id)) return;
    if (shouldExcludeTransaction(txn)) return;
    if (isIncomeCategory(txn.category_name)) return;
    if (!isTrueExpense(txn.category_name, txn.category_group_name, cspSettings, txn.category_id)) return;

    const amount = Math.abs(getTransactionAmount(txn));
    const category = txn.category_name || 'Uncategorized';

    currentMonthSpending[category] = (currentMonthSpending[category] || 0) + amount;
  });

  // Get historical averages by category
  const historicalData = getMonthlyRangeData(monthlyData, periodMonths);
  const categoryAverages = {};

  // Calculate average from all transactions in the period
  const periodStart = new Date(now.getFullYear(), now.getMonth() - periodMonths, 1);
  const periodCategoryTotals = {};

  transactions.forEach(txn => {
    const txnDate = new Date(txn.date);
    if (txnDate < periodStart || txnDate >= startOfMonth) return; // Exclude current month
    if (investmentAccountIds.has(txn.account_id)) return;
    if (shouldExcludeTransaction(txn)) return;
    if (isIncomeCategory(txn.category_name)) return;
    if (!isTrueExpense(txn.category_name, txn.category_group_name, cspSettings, txn.category_id)) return;

    const amount = Math.abs(getTransactionAmount(txn));
    const category = txn.category_name || 'Uncategorized';

    periodCategoryTotals[category] = (periodCategoryTotals[category] || 0) + amount;
  });

  // Calculate averages
  const months = Math.max(1, periodMonths - 1); // Exclude current month
  Object.entries(periodCategoryTotals).forEach(([cat, total]) => {
    categoryAverages[cat] = total / months;
  });

  // Build top categories with comparison
  return Object.entries(currentMonthSpending)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, amount]) => {
      const average = categoryAverages[name] || 0;
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
 * Get top spending categories for the CURRENT WEEK (matches newsletter hero)
 * Uses Sunday-Saturday week definition (matches template and trends)
 * Compares this week's spending to 6-week weekly average by category
 * @param {Array} transactions - All transactions
 * @param {Set} investmentAccountIds - Account IDs to exclude
 * @param {Object} cspSettings - CSP settings for categorization
 * @returns {Array} - Top categories with weekly comparison
 */
function getWeeklyTopCategories(transactions, investmentAccountIds = new Set(), cspSettings = {}) {
  if (!transactions?.length) return [];

  const now = new Date();

  // Calculate this week's date range: Sunday-Saturday (matches template and trends)
  const dayOfWeek = now.getDay(); // 0=Sunday
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Get this week's spending by category
  const thisWeekSpending = {};
  transactions.forEach(txn => {
    const txnDate = new Date(txn.date);
    if (txnDate < weekStart || txnDate > weekEnd) return;
    if (investmentAccountIds.has(txn.account_id)) return;
    if (shouldExcludeTransaction(txn)) return;
    if (isIncomeCategory(txn.category_name)) return;
    if (!isTrueExpense(txn.category_name, txn.category_group_name, cspSettings, txn.category_id)) return;

    const amount = Math.abs(getTransactionAmount(txn));
    const category = txn.category_name || 'Uncategorized';

    thisWeekSpending[category] = (thisWeekSpending[category] || 0) + amount;
  });

  // Calculate 6-week historical average by category (excluding current week)
  const sixWeeksAgo = new Date(weekStart);
  sixWeeksAgo.setDate(sixWeeksAgo.getDate() - (6 * 7));

  const lastWeekEnd = new Date(weekStart);
  lastWeekEnd.setMilliseconds(-1);

  const historicalCategoryTotals = {};
  transactions.forEach(txn => {
    const txnDate = new Date(txn.date);
    if (txnDate < sixWeeksAgo || txnDate > lastWeekEnd) return;
    if (investmentAccountIds.has(txn.account_id)) return;
    if (shouldExcludeTransaction(txn)) return;
    if (isIncomeCategory(txn.category_name)) return;
    if (!isTrueExpense(txn.category_name, txn.category_group_name, cspSettings, txn.category_id)) return;

    const amount = Math.abs(getTransactionAmount(txn));
    const category = txn.category_name || 'Uncategorized';

    historicalCategoryTotals[category] = (historicalCategoryTotals[category] || 0) + amount;
  });

  // Calculate weekly averages (divide by 6 weeks)
  const categoryWeeklyAverages = {};
  Object.entries(historicalCategoryTotals).forEach(([cat, total]) => {
    categoryWeeklyAverages[cat] = total / 6;
  });

  // Build top categories with weekly comparison
  return Object.entries(thisWeekSpending)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, amount]) => {
      const weeklyAverage = categoryWeeklyAverages[name] || 0;
      const vsAverage = weeklyAverage > 0 ? ((amount - weeklyAverage) / weeklyAverage) * 100 : 0;

      return {
        name,
        amount,
        average: weeklyAverage,
        vsAverage: Math.round(vsAverage),
        vsAverageLabel: vsAverage > 0 ? `+${Math.round(vsAverage)}%` : `${Math.round(vsAverage)}%`
      };
    });
}

// ============================================
// All Metrics Combined
// ============================================

/**
 * Calculate all newsletter metrics
 * @param {Object} data - YNAB data (accounts, transactions, categories)
 * @param {Object} options - Calculation options
 * @returns {Object} - All metrics
 */
function calculateAllMetrics(data, options = {}) {
  const {
    accounts = [],
    transactions = [],
    categories = {}
  } = data;

  const {
    periodMonths = 6,
    cspSettings = {}
  } = options;

  // Identify investment account IDs to exclude from expense calculations
  const investmentAccountIds = new Set(
    accounts
      .filter(acc => {
        const type = (acc.type || '').toLowerCase();
        const name = (acc.name || '').toLowerCase();

        // NEVER mark liability accounts as investment accounts
        if (type === 'mortgage' || type === 'otherliability' || type === 'loan' ||
            type === 'creditcard' || type === 'lineofcredit') {
          return false;
        }

        // YNAB "otherAsset" type is typically used for investment/tracking accounts
        if (type === 'otherasset') {
          // Home value accounts should be included in net worth, not treated as investment
          if (name.includes('home value') || name.includes('property') || name.includes('redfin')) {
            return false;
          }
          return true;
        }

        // Also check for investment-related names
        if (name.includes('investment') || name.includes('brokerage') ||
            name.includes('401k') || name.includes('ira') || name.includes('roth') ||
            name.includes('stock') || name.includes('etf') || name.includes('fidelity') ||
            name.includes('vanguard') || name.includes('schwab')) {
          return true;
        }

        return false;
      })
      .map(acc => acc.id)
  );

  // Process transactions into monthly data (excluding investment account transactions)
  const { monthlyData, totals } = processTransactions(transactions, investmentAccountIds);

  // Calculate all metrics
  const netWorth = calculateNetWorth(accounts);
  const runway = calculateRunway(accounts, monthlyData, periodMonths);
  const csp = calculateCSPBuckets(transactions, categories, periodMonths, cspSettings, investmentAccountIds);
  const burnRate = calculateBurnRate(monthlyData, periodMonths);
  const topCategories = getTopSpendingCategories(transactions, monthlyData, periodMonths, investmentAccountIds, cspSettings);
  const weeklyTopCategories = getWeeklyTopCategories(transactions, investmentAccountIds, cspSettings);

  return {
    netWorth,
    runway,
    csp,
    burnRate,
    topCategories,
    weeklyTopCategories,
    monthlyData,
    totals,
    investmentAccountIds, // Expose for use in trends calculations
    calculatedAt: new Date().toISOString()
  };
}

module.exports = {
  CSP_TARGETS,
  GROUP_NAME_TO_BUCKET,
  calculateNetWorth,
  calculateRunway,
  calculateCSPBuckets,
  calculateBurnRate,
  getTopSpendingCategories,
  getWeeklyTopCategories,
  calculateAllMetrics,
  categorizeTransaction,
  isTrueExpense
};
