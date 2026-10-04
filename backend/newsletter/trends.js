/**
 * Newsletter Trends Calculator
 * Weekly, Month-over-Month, Year-over-Year, and Annual Progress calculations
 * Uses the classified ledger from cashflow.js (YNAB history back to November 2018)
 */

const {
  addDays,
  daysBetween,
  dayOfWeek,
  startOfWeek,
  monthStart,
  monthEnd,
  sameDayInMonth,
  isLastDayOfMonth,
  formatKey,
  summarize
} = require('./cashflow');

function round1(value) {
  return Math.round(value * 10) / 10;
}

function savingsRate(summary) {
  return summary.income > 0 ? ((summary.income - summary.spending) / summary.income) * 100 : 0;
}

function percentChange(current, previous) {
  return previous > 0 ? ((current - previous) / previous) * 100 : 0;
}

/**
 * Compare spending by category between two summaries
 * @returns {Array} - [{ category, current, previous, change, changePercent }]
 */
function compareCategories(currentSummary, previousSummary) {
  const current = new Map(currentSummary.byCategory.map(c => [c.key, c]));
  const previous = new Map(previousSummary.byCategory.map(c => [c.key, c]));
  const keys = new Set([...current.keys(), ...previous.keys()]);

  return Array.from(keys).map(key => {
    const category = (current.get(key) || previous.get(key)).name;
    const currentAmount = current.get(key)?.amount || 0;
    const previousAmount = previous.get(key)?.amount || 0;
    const change = currentAmount - previousAmount;
    const changePercent = previousAmount > 0
      ? (change / previousAmount) * 100
      : (currentAmount > 0 ? 100 : 0);

    return { category, current: currentAmount, previous: previousAmount, change, changePercent: Math.round(changePercent) };
  });
}

/**
 * Compare the month-to-date with the same days of another month.
 * On the last day of the month, compares full months.
 */
function comparisonRange(today, monthsBack) {
  const start = monthStart(today, -monthsBack);
  const end = isLastDayOfMonth(today) ? monthEnd(today, -monthsBack) : sameDayInMonth(today, -monthsBack);
  return { start, end };
}

function periodName(start, end, isPartialMonth) {
  const month = formatKey(start, { month: 'long' });
  const year = start.slice(0, 4);
  return isPartialMonth
    ? `${month} 1-${Number(end.slice(8, 10))}, ${year}`
    : `${month} ${year}`;
}

// ============================================
// Month-over-Month Trends
// ============================================

/**
 * Calculate month-over-month trends
 * @param {Object} ledger - Output of buildLedger
 * @param {string} today - 'YYYY-MM-DD'
 * @returns {Object} - MoM comparison data
 */
function calculateMonthOverMonth(ledger, today) {
  const currentStart = monthStart(today);
  const previous = comparisonRange(today, 1);
  const isPartialMonth = !isLastDayOfMonth(today);

  const current = summarize(ledger.lines, currentStart, today);
  const prior = summarize(ledger.lines, previous.start, previous.end);

  const currentSavingsRate = savingsRate(current);
  const previousSavingsRate = savingsRate(prior);

  const categoryChanges = compareCategories(current, prior)
    .filter(c => Math.abs(c.change) > 10)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  return {
    available: true,
    isPartialMonth,
    daysCompared: Number(today.slice(8, 10)),
    currentMonth: {
      name: periodName(currentStart, today, isPartialMonth),
      income: current.income,
      expenses: current.spending,
      investing: current.investing,
      net: current.net,
      savingsRate: round1(currentSavingsRate)
    },
    previousMonth: {
      name: periodName(previous.start, previous.end, isPartialMonth),
      income: prior.income,
      expenses: prior.spending,
      investing: prior.investing,
      net: prior.net,
      savingsRate: round1(previousSavingsRate)
    },
    changes: {
      income: current.income - prior.income,
      incomePercent: round1(percentChange(current.income, prior.income)),
      expenses: current.spending - prior.spending,
      expensesPercent: round1(percentChange(current.spending, prior.spending)),
      net: current.net - prior.net,
      savingsRate: round1(currentSavingsRate - previousSavingsRate) // percentage points
    },
    topCategoryChanges: categoryChanges.slice(0, 5)
  };
}

// ============================================
// Year-over-Year Comparison
// ============================================

/**
 * Pick the snapshot closest to a target date
 * @param {Array} snapshots - Newsletter snapshots
 * @param {string} targetKey - 'YYYY-MM-DD'
 * @param {number} maxDistanceDays - Ignore snapshots further away than this
 */
function findSnapshotNear(snapshots, targetKey, maxDistanceDays) {
  let best = null;
  let bestDistance = Infinity;

  snapshots.forEach(snapshot => {
    const key = snapshotDateKey(snapshot);
    if (!key) return;
    const distance = Math.abs(daysBetween(targetKey, key));
    if (distance < bestDistance) {
      best = snapshot;
      bestDistance = distance;
    }
  });

  return bestDistance <= maxDistanceDays ? best : null;
}

/** Calendar date a snapshot was taken ('YYYY-MM-DD') */
function snapshotDateKey(snapshot) {
  if (snapshot?.dateKey) return snapshot.dateKey;
  if (snapshot?.createdAt) return String(snapshot.createdAt).slice(0, 10);
  return null;
}

/**
 * Calculate year-over-year comparison
 * @param {Object} ledger - Output of buildLedger
 * @param {string} today - 'YYYY-MM-DD'
 * @param {Object} currentMetrics - Current metrics (for net worth)
 * @param {Array} snapshots - Historical newsletter snapshots (for net worth YoY)
 * @returns {Object} - YoY comparison data
 */
function calculateYearOverYear(ledger, today, currentMetrics, snapshots = []) {
  const currentStart = monthStart(today);
  const lastYear = comparisonRange(today, 12);
  const isPartialMonth = !isLastDayOfMonth(today);

  const hasLastYearData = ledger.lines.some(line => line.date >= lastYear.start && line.date <= lastYear.end);
  if (!hasLastYearData) {
    return {
      available: false,
      message: 'Year-over-year data will be available once you have transaction history from the same month last year.'
    };
  }

  const current = summarize(ledger.lines, currentStart, today);
  const prior = summarize(ledger.lines, lastYear.start, lastYear.end);

  const categoryComparison = compareCategories(current, prior)
    .filter(c => c.current > 50 || c.previous > 50)
    .map(({ previous, ...rest }) => ({ ...rest, lastYear: previous }))
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  // Net worth YoY (requires a snapshot from about a year ago)
  let netWorthYoY = { available: false };
  if (snapshots?.length > 0 && currentMetrics?.netWorth) {
    const yearAgoSnapshot = findSnapshotNear(snapshots, addDays(today, -365), 21);

    if (yearAgoSnapshot && typeof yearAgoSnapshot.netWorth === 'number') {
      const netWorthChange = currentMetrics.netWorth.total - yearAgoSnapshot.netWorth;
      netWorthYoY = {
        available: true,
        current: currentMetrics.netWorth.total,
        lastYear: yearAgoSnapshot.netWorth,
        change: netWorthChange,
        changePercent: yearAgoSnapshot.netWorth !== 0
          ? round1((netWorthChange / Math.abs(yearAgoSnapshot.netWorth)) * 100)
          : 0
      };
    } else {
      netWorthYoY = {
        available: false,
        message: 'Net worth comparison will be available after 12 months of newsletters'
      };
    }
  }

  const monthIndex = Number(today.slice(5, 7)) - 1;
  let seasonalNote = '';
  if (monthIndex === 0) {
    seasonalNote = 'January spending typically drops 15-20% from December holiday spending.';
  } else if (monthIndex === 11) {
    seasonalNote = 'December often sees increased spending due to holidays and gift-giving.';
  } else if (monthIndex >= 5 && monthIndex <= 7) {
    seasonalNote = 'Summer months often see higher travel and entertainment expenses.';
  }

  return {
    available: true,
    isPartialMonth,
    daysCompared: Number(today.slice(8, 10)),
    currentMonth: {
      name: periodName(currentStart, today, isPartialMonth),
      spending: current.spending,
      income: current.income
    },
    lastYearMonth: {
      name: periodName(lastYear.start, lastYear.end, isPartialMonth),
      spending: prior.spending,
      income: prior.income
    },
    spending: {
      change: current.spending - prior.spending,
      changePercent: round1(percentChange(current.spending, prior.spending))
    },
    income: {
      change: current.income - prior.income,
      changePercent: round1(percentChange(current.income, prior.income))
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
 * @param {Object} ledger - Output of buildLedger
 * @param {string} today - 'YYYY-MM-DD'
 * @param {Object} currentMetrics - Current metrics including net worth
 * @param {Array} snapshots - Historical newsletter snapshots
 * @param {Object} goals - User's annual goals (optional)
 * @returns {Object} - Annual progress data
 */
function calculateAnnualProgress(ledger, today, currentMetrics, snapshots = [], goals = {}) {
  const year = Number(today.slice(0, 4));
  const startOfYear = `${year}-01-01`;
  const dayOfYear = daysBetween(startOfYear, today) + 1;
  const daysInYear = daysBetween(startOfYear, `${year + 1}-01-01`);
  const yearProgress = dayOfYear / daysInYear;
  const monthIndex = Number(today.slice(5, 7)) - 1;
  const monthsCompleted = monthIndex + Number(today.slice(8, 10)) /
    new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  const ytd = summarize(ledger.lines, startOfYear, today);
  const ytdIncome = ytd.income;
  const ytdExpenses = ytd.spending;
  const ytdSavings = ytdIncome - ytdExpenses;
  const ytdSavingsRate = savingsRate(ytd);
  const targetSavingsRate = goals.savingsRate || 25;

  // Actual contributions to investments this calendar year
  const ytdInvestments = ytd.investing;
  const annualInvestmentGoal = goals.investmentContributions || 24000;
  const investmentProgress = (ytdInvestments / annualInvestmentGoal) * 100;
  const expectedInvestmentProgress = yearProgress * 100;

  // Net worth progress vs the first newsletter of the year
  let netWorthProgress = { available: false };
  if (currentMetrics?.netWorth && snapshots?.length > 0) {
    const startOfYearSnapshot = snapshots
      .filter(s => (snapshotDateKey(s) || '').startsWith(`${year}-`) && typeof s.netWorth === 'number')
      .sort((a, b) => snapshotDateKey(a).localeCompare(snapshotDateKey(b)))[0];

    if (startOfYearSnapshot) {
      const startingNetWorth = startOfYearSnapshot.netWorth;
      const currentNetWorth = currentMetrics.netWorth.total;
      const netWorthGrowth = currentNetWorth - startingNetWorth;
      // Project from the time actually elapsed since that snapshot
      const elapsedDays = Math.max(daysBetween(snapshotDateKey(startOfYearSnapshot), today), 1);
      const remainingDays = daysBetween(today, `${year}-12-31`);
      const projectedYearEndNetWorth = currentNetWorth + (netWorthGrowth / elapsedDays) * remainingDays;

      netWorthProgress = {
        available: true,
        since: snapshotDateKey(startOfYearSnapshot),
        startOfYear: startingNetWorth,
        current: currentNetWorth,
        growth: netWorthGrowth,
        growthPercent: startingNetWorth !== 0 ? round1((netWorthGrowth / Math.abs(startingNetWorth)) * 100) : 0,
        projectedYearEnd: Math.round(projectedYearEndNetWorth),
        projectedAnnualGrowth: Math.round(projectedYearEndNetWorth - startingNetWorth)
      };
    }
  }

  // Compare to the same point last year
  let vsLastYear = { available: false };
  const lastYearStart = `${year - 1}-01-01`;
  const lastYearSamePoint = sameDayInMonth(today, -12);
  if (ledger.lines.some(line => line.date >= lastYearStart && line.date <= lastYearSamePoint)) {
    const lastYearYtd = summarize(ledger.lines, lastYearStart, lastYearSamePoint);
    const lastYearYtdSavingsRate = savingsRate(lastYearYtd);

    vsLastYear = {
      available: true,
      lastYearYtdSavingsRate: round1(lastYearYtdSavingsRate),
      savingsRateImprovement: round1(ytdSavingsRate - lastYearYtdSavingsRate),
      lastYearYtdExpenses: lastYearYtd.spending,
      expenseChange: ytdExpenses - lastYearYtd.spending,
      expenseChangePercent: Math.round(percentChange(ytdExpenses, lastYearYtd.spending))
    };
  }

  return {
    available: true,
    yearProgress: Math.round(yearProgress * 100),
    monthsCompleted: round1(monthsCompleted),

    ytd: {
      income: ytdIncome,
      expenses: ytdExpenses,
      savings: ytdSavings,
      savingsRate: round1(ytdSavingsRate),
      investments: ytdInvestments
    },

    goals: {
      savingsRate: {
        target: targetSavingsRate,
        actual: round1(ytdSavingsRate),
        onTrack: ytdSavingsRate >= targetSavingsRate
      },
      investments: {
        target: annualInvestmentGoal,
        actual: ytdInvestments,
        progress: Math.round(investmentProgress),
        expectedProgress: Math.round(expectedInvestmentProgress),
        onTrack: investmentProgress >= expectedInvestmentProgress * 0.9 // Allow 10% buffer
      }
    },

    projections: {
      annualIncome: Math.round(ytdIncome / yearProgress),
      annualExpenses: Math.round(ytdExpenses / yearProgress),
      annualSavings: Math.round(ytdSavings / yearProgress),
      annualInvestments: Math.round(ytdInvestments / yearProgress)
    },

    netWorthProgress,
    vsLastYear
  };
}

// ============================================
// Weekly Trends (for weekly newsletter)
// ============================================

/**
 * Calculate week-over-week trends (weeks run Sunday-Saturday)
 * @param {Object} ledger - Output of buildLedger
 * @param {string} today - 'YYYY-MM-DD'
 * @returns {Object} - Weekly comparison data
 */
function calculateWeeklyTrends(ledger, today) {
  const currentWeekStart = startOfWeek(today);
  const lastWeekStart = addDays(currentWeekStart, -7);
  const lastWeekEnd = addDays(currentWeekStart, -1);

  const currentWeek = summarize(ledger.lines, currentWeekStart, today);
  const lastWeek = summarize(ledger.lines, lastWeekStart, lastWeekEnd);

  // Six full weeks before the current one
  const history = summarize(ledger.lines, addDays(currentWeekStart, -42), lastWeekEnd);
  const sixWeekAverage = history.spending / 6;

  const daysElapsed = dayOfWeek(today) + 1;
  const proRateFactor = daysElapsed < 7 ? 7 / daysElapsed : 1;

  return {
    weekStart: currentWeekStart,
    weekEnd: addDays(currentWeekStart, 6),
    currentWeek: {
      spending: currentWeek.spending,
      projectedWeekly: currentWeek.spending * proRateFactor,
      daysElapsed,
      investing: currentWeek.investing,
      uncategorized: currentWeek.uncategorized,
      topCategories: currentWeek.byCategory.slice(0, 5)
    },
    lastWeek: {
      spending: lastWeek.spending,
      topCategories: lastWeek.byCategory.slice(0, 5)
    },
    change: {
      amount: currentWeek.spending - lastWeek.spending,
      percent: lastWeek.spending > 0
        ? Math.round(((currentWeek.spending - lastWeek.spending) / lastWeek.spending) * 100)
        : 0
    },
    sixWeekAverage // Average weekly spending over the past 6 full weeks
  };
}

// ============================================
// All Trends Combined
// ============================================

/**
 * Calculate all trend data for the newsletter
 * @param {Object} metrics - Output of calculateAllMetrics (provides ledger and today)
 * @param {Array} snapshots - Historical newsletter snapshots
 * @param {Object} goals - User's financial goals
 * @returns {Object} - All trend data
 */
function calculateAllTrends(metrics, snapshots = [], goals = {}) {
  const { ledger, today } = metrics;

  return {
    weekly: calculateWeeklyTrends(ledger, today),
    monthOverMonth: calculateMonthOverMonth(ledger, today),
    yearOverYear: calculateYearOverYear(ledger, today, metrics, snapshots),
    annualProgress: calculateAnnualProgress(ledger, today, metrics, snapshots, goals || {}),
    calculatedAt: new Date().toISOString()
  };
}

module.exports = {
  calculateMonthOverMonth,
  calculateYearOverYear,
  calculateAnnualProgress,
  calculateWeeklyTrends,
  calculateAllTrends,
  findSnapshotNear,
  snapshotDateKey
};
