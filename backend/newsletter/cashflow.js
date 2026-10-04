/**
 * Newsletter Cash-Flow Ledger
 *
 * Every YNAB line item is classified once, here, so every number in the
 * newsletter uses the same definitions:
 *
 *   income        Inflows categorized to Ready to Assign, minus payees/categories
 *                 the user excluded on the CSP page (e.g. stock-sale proceeds).
 *   spending      Money that left the household: categorized outflows from budget
 *                 accounts, net of refunds. Includes debt payments.
 *   investing     Transfers into investment accounts and outflows in investment
 *                 categories. Moving money into your own investments is not spending.
 *   saving        Categorized transfers into tracking savings accounts.
 *   uncategorized Budget-account transactions with no category yet. Not counted as
 *                 income or spending, but surfaced so one unreviewed import can't
 *                 swamp the numbers.
 *
 * Ignored entirely: tracking-account activity (market moves, home value updates,
 * loan balance adjustments), transfers between budget accounts, investment
 * withdrawals, starting balances and balance adjustments.
 */

// ============================================
// Calendar dates
// ============================================
// YNAB dates are calendar dates ('YYYY-MM-DD'). Parsing them with new Date()
// gives UTC midnight, which lands on the previous day west of UTC. All period
// math here works on 'YYYY-MM-DD' strings, which compare correctly as strings.

const DAY_MS = 24 * 60 * 60 * 1000;

function keyToUtc(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function makeKey(year, monthIndex, day) {
  return utcToKey(Date.UTC(year, monthIndex, day));
}

/**
 * Today's date in the given timezone
 * @param {string} timeZone - IANA timezone (e.g., 'America/Los_Angeles')
 * @param {Date} now - Reference instant
 * @returns {string} - 'YYYY-MM-DD'
 */
function todayKey(timeZone = 'America/Los_Angeles', now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

function addDays(key, days) {
  return utcToKey(keyToUtc(key) + days * DAY_MS);
}

function daysBetween(startKey, endKey) {
  return Math.round((keyToUtc(endKey) - keyToUtc(startKey)) / DAY_MS);
}

function dayOfWeek(key) {
  return new Date(keyToUtc(key)).getUTCDay();
}

/** Sunday on or before the given date */
function startOfWeek(key) {
  return addDays(key, -dayOfWeek(key));
}

function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function parts(key) {
  const [y, m, d] = key.split('-').map(Number);
  return { year: y, monthIndex: m - 1, day: d };
}

/** First day of the month `offset` months from the given date's month */
function monthStart(key, offset = 0) {
  const { year, monthIndex } = parts(key);
  return makeKey(year, monthIndex + offset, 1);
}

/** Last day of the month `offset` months from the given date's month */
function monthEnd(key, offset = 0) {
  const { year, monthIndex } = parts(key);
  return makeKey(year, monthIndex + offset + 1, 0);
}

/**
 * Same day-of-month `offset` months away, clamped to that month's length
 * (Mar 31 → Feb 28, not Mar 3)
 */
function sameDayInMonth(key, offset) {
  const { year, monthIndex, day } = parts(key);
  const target = new Date(Date.UTC(year, monthIndex + offset, 1));
  const maxDay = daysInMonth(target.getUTCFullYear(), target.getUTCMonth());
  return makeKey(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, maxDay));
}

function isLastDayOfMonth(key) {
  const { year, monthIndex, day } = parts(key);
  return day === daysInMonth(year, monthIndex);
}

/**
 * The last `count` complete calendar months before the month containing `key`,
 * oldest first
 * @returns {Array<{monthKey, start, end}>}
 */
function completeMonths(key, count) {
  const months = [];
  for (let i = count; i >= 1; i--) {
    const start = monthStart(key, -i);
    months.push({ monthKey: start.slice(0, 7), start, end: monthEnd(key, -i) });
  }
  return months;
}

/**
 * Format a date key for display without timezone drift
 * @param {string} key - 'YYYY-MM-DD'
 * @param {Object} options - Intl.DateTimeFormat options
 */
function formatKey(key, options) {
  return new Date(keyToUtc(key)).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
}

// ============================================
// Accounts
// ============================================

// YNAB loan account types (balances move on their own: interest, escrow, adjustments)
const LOAN_TYPES = new Set([
  'mortgage', 'autoloan', 'studentloan', 'personalloan', 'medicaldebt',
  'otherdebt', 'otherliability', 'loan'
]);
const DEBT_TYPES = new Set([...LOAN_TYPES, 'creditcard', 'lineofcredit']);

const INVESTMENT_NAME_PATTERN =
  /401\s*\(?k\)?|403\s*\(?b\)?|\b457\b|\bira\b|roth|\bhsa\b|brokerage|investment|\bstock|\brsu\b|espp|fidelity|vanguard|schwab|altruist|retirement|\b529\b|\bsip\b/;

function accountType(acc) {
  return (acc?.type || '').toLowerCase();
}

function accountName(acc) {
  return (acc?.name || '').toLowerCase();
}

function isLoanAccount(acc) {
  return LOAN_TYPES.has(accountType(acc));
}

function isDebtAccount(acc) {
  const name = accountName(acc);
  return DEBT_TYPES.has(accountType(acc)) ||
    name.includes('mortgage') || name.includes('loan') || name.includes('credit card');
}

function isHomeValueAccount(acc) {
  const name = accountName(acc);
  return ['home value', 'house value', 'redfin', 'zillow', 'property value', 'real estate']
    .some(term => name.includes(term));
}

function isOnBudget(acc) {
  return acc?.on_budget !== false;
}

/**
 * Investment accounts are tracking (off-budget) accounts holding investments.
 * A budget account is cash no matter what it's called: "Schwab Investor
 * Checking" is a checking account, not a brokerage.
 */
function isInvestmentAccount(acc) {
  if (!acc || isOnBudget(acc) || isDebtAccount(acc) || isHomeValueAccount(acc)) return false;
  return accountType(acc) === 'otherasset' || INVESTMENT_NAME_PATTERN.test(accountName(acc));
}

/**
 * Cash available for runway: budget accounts that aren't debt, plus tracking
 * checking/savings/cash accounts
 */
function isCashAccount(acc) {
  if (!acc || acc.closed || isDebtAccount(acc) || isHomeValueAccount(acc)) return false;
  if (isOnBudget(acc)) return true;
  return ['checking', 'savings', 'cash'].includes(accountType(acc));
}

// ============================================
// Categories and CSP buckets
// ============================================

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

// Categories that are always investing (matches frontend constants.js)
const SAVINGS_INVESTMENT_CATEGORIES = [
  'Investments (Stocks, ETFs, MFs)'
];

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

/**
 * Normalize a YNAB group name for matching. Strips emoji and punctuation so
 * "🔗 Fixed Costs" matches "fixed costs".
 */
function normalizeGroupName(groupName) {
  return (groupName || '')
    .toLowerCase()
    .replace(/[^a-z0-9&\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Map a category group name to a CSP bucket
 * @param {string} groupName - YNAB category group name
 * @returns {string|null} - Bucket key or null if no match
 */
function bucketFromGroupName(groupName) {
  const normalized = normalizeGroupName(groupName);
  if (!normalized) return null;
  if (GROUP_NAME_TO_BUCKET[normalized]) return GROUP_NAME_TO_BUCKET[normalized];

  // Decorated names like "Family Guilt Free Spending" or "Retirement Investments"
  if (normalized.includes('invest')) return 'investments';
  if (normalized.includes('guilt')) return 'guiltFree';
  if (normalized.includes('fixed') || normalized.includes('bills')) return 'fixedCosts';
  if (normalized.includes('saving')) return 'savings';
  return null;
}

/**
 * Categorize a category into a CSP bucket
 * Matches frontend getCategoryBucket() priority: custom mapping → group name → keyword (if enabled) → default
 * @param {string} categoryName - Category name
 * @param {string} categoryGroupName - Category group name
 * @param {Object} customMappings - Custom category-to-bucket mappings (by category ID or name)
 * @param {boolean} useKeywordFallback - Whether to use keyword inference (default false)
 * @param {string} categoryId - Category ID for custom mapping lookup
 * @returns {string} - Bucket name
 */
function categorizeTransaction(categoryName, categoryGroupName, customMappings = {}, useKeywordFallback = false, categoryId = null) {
  if (categoryId && customMappings[categoryId]) return customMappings[categoryId];
  if (categoryName && customMappings[categoryName]) return customMappings[categoryName];
  if (!categoryName) return 'guiltFree';
  if (SAVINGS_INVESTMENT_CATEGORIES.includes(categoryName)) return 'investments';

  const groupBucket = bucketFromGroupName(categoryGroupName);
  if (groupBucket) return groupBucket;

  if (useKeywordFallback) {
    const lowerCategory = categoryName.toLowerCase().trim();
    if (DEFAULT_INVESTMENT_KEYWORDS.some(kw => lowerCategory.includes(kw))) return 'investments';
    if (DEFAULT_SAVINGS_KEYWORDS.some(kw => lowerCategory.includes(kw))) return 'savings';
    if (DEFAULT_FIXED_COST_KEYWORDS.some(kw => lowerCategory.includes(kw))) return 'fixedCosts';
  }

  return 'guiltFree';
}

// Income categories from YNAB
const YNAB_INCOME_CATEGORIES = [
  'Inflow: Ready to Assign',
  'Ready to Assign',
  'To be Budgeted',
  'Deferred Income SubCategory'
];

function isIncomeCategory(categoryName) {
  return YNAB_INCOME_CATEGORIES.includes(categoryName);
}

// Balance bookkeeping, not cash flow
const SYSTEM_PAYEES = new Set([
  'Starting Balance',
  'Reconciliation Balance Adjustment',
  'Manual Balance Adjustment'
]);

function isUncategorized(line) {
  return !line.categoryId ||
    line.categoryName === 'Uncategorized' ||
    (line.categoryName || '').startsWith('Split (Multiple Categories)');
}

// ============================================
// Ledger
// ============================================

/**
 * Expand split transactions into their subtransactions and drop deleted items.
 * The split parent carries the total under a "Split" pseudo-category, so using
 * it directly would mislabel every line.
 */
function flattenTransactions(transactions = []) {
  const lines = [];

  transactions.forEach(txn => {
    if (!txn || txn.deleted) return;

    const subs = (txn.subtransactions || []).filter(sub => !sub.deleted);
    const items = subs.length > 0
      ? subs.map(sub => ({
        ...sub,
        date: txn.date,
        account_id: txn.account_id,
        payee_name: sub.payee_name || txn.payee_name,
        parentId: txn.id
      }))
      : [txn];

    items.forEach(item => lines.push({
      id: item.id,
      date: item.date,
      accountId: item.account_id,
      amount: (item.amount || 0) / 1000,
      payee: item.payee_name || '',
      categoryId: item.category_id || null,
      categoryName: item.category_name || null,
      transferAccountId: item.transfer_account_id || null,
      parentId: item.parentId || null
    }));
  });

  return lines;
}

/**
 * Classify one flattened line
 * @returns {{kind: string, bucket: string|null}}
 */
function classifyLine(line, ctx) {
  const account = ctx.accountsById.get(line.accountId);

  if (SYSTEM_PAYEES.has(line.payee)) return { kind: 'ignored', bucket: null };

  // Tracking accounts: market moves, home value updates, loan adjustments.
  // Money entering them from the budget is captured on the budget side.
  if (account && !isOnBudget(account)) return { kind: 'ignored', bucket: null };

  const categoryInfo = ctx.categoriesById.get(line.categoryId);
  const groupName = categoryInfo?.groupName || '';

  if (line.transferAccountId) {
    const counterpart = ctx.accountsById.get(line.transferAccountId);

    // Contributions to your own investments are not spending, and money coming
    // back out of them is not income
    if (isInvestmentAccount(counterpart)) {
      return line.amount < 0
        ? { kind: 'investing', bucket: 'investments' }
        : { kind: 'transfer', bucket: null };
    }

    // Transfers between budget accounts (credit card payments, checking → savings)
    // can't carry a category in YNAB. A categorized transfer is money leaving the
    // budget: a mortgage or loan payment, or a deposit to a tracking savings account.
    if (!line.categoryId || isIncomeCategory(line.categoryName) || line.amount > 0) {
      return { kind: 'transfer', bucket: null };
    }

    if (ctx.excludedExpenseCategories.has(line.categoryId)) return { kind: 'ignored', bucket: null };

    const bucket = categorizeTransaction(
      line.categoryName, groupName, ctx.categoryMappings, ctx.useKeywordFallback, line.categoryId
    );
    if (bucket === 'investments') return { kind: 'investing', bucket };
    if (bucket === 'savings') return { kind: 'saving', bucket };
    return { kind: 'spending', bucket };
  }

  if (isIncomeCategory(line.categoryName)) {
    const excluded = ctx.excludedPayees.has(line.payee || 'Unknown') ||
      ctx.excludedCategories.has(line.categoryId);
    return { kind: excluded ? 'excludedIncome' : 'income', bucket: null };
  }

  if (isUncategorized(line)) {
    // Balance adjustments inside loan accounts aren't cash flow
    if (account && isLoanAccount(account)) return { kind: 'ignored', bucket: null };
    return { kind: 'uncategorized', bucket: null };
  }

  if (ctx.excludedExpenseCategories.has(line.categoryId)) return { kind: 'ignored', bucket: null };

  const bucket = categorizeTransaction(
    line.categoryName, groupName, ctx.categoryMappings, ctx.useKeywordFallback, line.categoryId
  );

  // An outflow in an investment category (e.g. paying an untracked brokerage)
  // is investing. Everything else that leaves to a payee is spending, including
  // purchases funded from savings categories.
  if (bucket === 'investments') return { kind: 'investing', bucket };
  return { kind: 'spending', bucket };
}

/**
 * Build the classified ledger for a budget
 * @param {Object} data - { accounts, transactions, categories } from YNAB
 * @param {Object} cspSettings - CSP settings (mappings and exclusions)
 * @returns {Object} - { lines, accountsById, categoriesById }
 */
function buildLedger(data = {}, cspSettings = {}) {
  const { accounts = [], transactions = [], categories = {} } = data;

  const accountsById = new Map(accounts.map(acc => [acc.id, acc]));

  const categoriesById = new Map();
  (categories.category_groups || []).forEach(group => {
    (group.categories || []).forEach(cat => {
      categoriesById.set(cat.id, { name: cat.name, groupName: group.name });
    });
  });

  const ctx = {
    accountsById,
    categoriesById,
    categoryMappings: cspSettings.categoryMappings || {},
    excludedPayees: toSet(cspSettings.excludedPayees),
    excludedCategories: toSet(cspSettings.excludedCategories),
    excludedExpenseCategories: toSet(cspSettings.excludedExpenseCategories),
    useKeywordFallback: cspSettings.useKeywordFallback ?? false
  };

  const lines = flattenTransactions(transactions).map(line => {
    const categoryInfo = categoriesById.get(line.categoryId);
    const { kind, bucket } = classifyLine(line, ctx);
    return {
      ...line,
      categoryName: categoryInfo?.name || line.categoryName,
      groupName: categoryInfo?.groupName || '',
      kind,
      bucket
    };
  });

  return { lines, accountsById, categoriesById };
}

/**
 * Label categories that share a name with their group, e.g. "Gifts (Savings)"
 */
function disambiguateNames(categories) {
  const counts = new Map();
  categories.forEach(cat => counts.set(cat.name, (counts.get(cat.name) || 0) + 1));
  categories.forEach(cat => {
    if (counts.get(cat.name) > 1 && cat.groupName) {
      const group = cat.groupName.replace(/[^\p{L}\p{N}&\s-]/gu, '').trim();
      cat.name = `${cat.name} (${group})`;
    }
  });
}

function toSet(value) {
  if (value instanceof Set) return value;
  return new Set(Array.isArray(value) ? value : []);
}

/**
 * Summarize ledger lines in an inclusive date range
 * Spending is netted per category (refunds reduce that category) and floored at
 * zero, so category amounts always add up to the spending total.
 * @param {Array} lines - Ledger lines
 * @param {string} start - 'YYYY-MM-DD' inclusive
 * @param {string} end - 'YYYY-MM-DD' inclusive
 */
function summarize(lines, start, end) {
  let income = 0;
  let excludedIncome = 0;
  // Keyed by category ID: two categories can share a name in different groups
  const spendingByCategory = new Map();
  let investing = 0;
  let saving = 0;
  const uncategorized = { count: 0, outflow: 0, inflow: 0, items: [] };

  lines.forEach(line => {
    if (line.date < start || line.date > end) return;

    switch (line.kind) {
      case 'income':
        income += line.amount;
        break;
      case 'excludedIncome':
        excludedIncome += line.amount;
        break;
      case 'spending': {
        const key = line.categoryId || `name:${line.categoryName}`;
        const entry = spendingByCategory.get(key) ||
          { name: line.categoryName || 'Uncategorized', groupName: line.groupName, bucket: line.bucket, amount: 0 };
        entry.amount -= line.amount;
        spendingByCategory.set(key, entry);
        break;
      }
      case 'investing':
        investing -= line.amount;
        break;
      case 'saving':
        saving -= line.amount;
        break;
      case 'uncategorized':
        uncategorized.count++;
        if (line.amount < 0) uncategorized.outflow += -line.amount;
        else uncategorized.inflow += line.amount;
        uncategorized.items.push({ date: line.date, payee: line.payee, amount: line.amount });
        break;
      default:
        break;
    }
  });

  const byCategory = [];
  const bucketTotals = { fixedCosts: 0, investments: 0, savings: 0, guiltFree: 0 };
  let spending = 0;
  spendingByCategory.forEach(({ name, groupName, bucket = 'guiltFree', amount }, key) => {
    if (amount <= 0) return;
    byCategory.push({ key, name, groupName, amount, bucket });
    bucketTotals[bucket] = (bucketTotals[bucket] || 0) + amount;
    spending += amount;
  });
  disambiguateNames(byCategory);
  byCategory.sort((a, b) => b.amount - a.amount);

  investing = Math.max(0, investing);
  saving = Math.max(0, saving);
  bucketTotals.investments += investing;
  bucketTotals.savings += saving;

  uncategorized.items.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  uncategorized.items = uncategorized.items.slice(0, 3);

  return {
    income,
    excludedIncome,
    spending,
    investing,
    saving,
    net: income - spending,
    byCategory,
    bucketTotals,
    uncategorized
  };
}

module.exports = {
  // Dates
  todayKey,
  addDays,
  daysBetween,
  dayOfWeek,
  startOfWeek,
  daysInMonth,
  monthStart,
  monthEnd,
  sameDayInMonth,
  isLastDayOfMonth,
  completeMonths,
  formatKey,

  // Accounts
  isOnBudget,
  isDebtAccount,
  isLoanAccount,
  isHomeValueAccount,
  isInvestmentAccount,
  isCashAccount,

  // Categories
  GROUP_NAME_TO_BUCKET,
  YNAB_INCOME_CATEGORIES,
  normalizeGroupName,
  bucketFromGroupName,
  categorizeTransaction,
  isIncomeCategory,

  // Ledger
  flattenTransactions,
  classifyLine,
  buildLedger,
  summarize
};
