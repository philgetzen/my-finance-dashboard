/**
 * Cash-flow classification for YNAB transactions
 *
 * The one place that decides what counts as income and spending. The dashboard
 * (frontend/src/utils/calculations/cashflow.js) and the weekly newsletter
 * (backend/newsletter/cashflow.js) both use it, so their numbers agree.
 *
 * Plain ES module with no imports: Vite bundles it for the browser and Node
 * loads it with require() on the backend.
 *
 *   income        Inflows categorized to Ready to Assign, minus payees/categories
 *                 excluded on the CSP page (e.g. stock-sale proceeds).
 *   spending      Money that left the household: categorized outflows from budget
 *                 accounts, net of refunds. Includes debt payments.
 *   investing     Contributions to investments: transfers into investment accounts,
 *                 outflows in investment categories, payments to brokerages
 *                 (Vanguard, Altruist) in any category, and payroll contributions
 *                 (401(k), stock purchase plans) recorded in the investment account
 *                 itself. Moving money into your own investments is not spending.
 *   saving        Categorized transfers into tracking savings accounts.
 *   uncategorized Budget-account transactions with no category yet. Not counted as
 *                 income or spending, but surfaced so one unreviewed import can't
 *                 swamp the numbers.
 *
 * Ignored: other tracking-account activity (market moves, dividends, home value
 * updates, loan balance adjustments), transfers between budget accounts,
 * investment withdrawals, starting balances and balance adjustments.
 */

// ============================================
// Categories and CSP buckets
// ============================================

// YNAB's income categories
export const INCOME_CATEGORIES = [
  'Inflow: Ready to Assign',
  'Ready to Assign',
  'To be Budgeted',
  'Deferred Income SubCategory'
];

// Categories that are always investing
export const SAVINGS_INVESTMENT_CATEGORIES = [
  'Investments (Stocks, ETFs, MFs)'
];

export const DEFAULT_FIXED_COST_KEYWORDS = [
  'rent', 'mortgage', 'utilities', 'electric', 'gas', 'water', 'internet',
  'phone', 'insurance', 'car payment', 'auto', 'transportation', 'groceries',
  'subscription', 'netflix', 'spotify', 'gym', 'membership',
  'loan', 'debt', 'payment', 'cable', 'trash', 'sewer', 'hoa'
];

export const DEFAULT_INVESTMENT_KEYWORDS = [
  'investment', 'retirement', '401k', 'ira', 'roth', 'stock', 'etf',
  'mutual fund', 'brokerage', 'investing'
];

export const DEFAULT_SAVINGS_KEYWORDS = [
  'savings', 'emergency', 'vacation', 'travel', 'gift', 'holiday',
  'christmas', 'birthday', 'wedding', 'fund', 'goal', 'reserve',
  'house', 'down payment', 'sinking'
];

// YNAB group names → CSP buckets, matched after normalizeGroupName()
export const GROUP_NAME_TO_BUCKET = {
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

export function isIncomeCategory(categoryName) {
  return INCOME_CATEGORIES.includes(categoryName);
}

/**
 * Normalize a YNAB group name for matching. Strips emoji and punctuation so
 * "🔗 Fixed Costs" matches "fixed costs".
 * @param {string} groupName - YNAB category group name
 * @returns {string}
 */
export function normalizeGroupName(groupName) {
  return (groupName || '')
    .toLowerCase()
    .replace(/[^a-z0-9&\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Map a category group name to a CSP bucket
 * @param {string} groupName - YNAB category group name
 * @returns {string|null} - Bucket key, or null if no match
 */
export function mapGroupNameToBucket(groupName) {
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
 * Infer a CSP bucket from a category name using keywords
 * @param {string} categoryName
 * @returns {string} - Bucket key (defaults to 'guiltFree')
 */
export function inferBucketFromKeywords(categoryName) {
  if (!categoryName) return 'guiltFree';
  const normalized = categoryName.toLowerCase().trim();

  if (DEFAULT_INVESTMENT_KEYWORDS.some(kw => normalized.includes(kw))) return 'investments';
  if (DEFAULT_SAVINGS_KEYWORDS.some(kw => normalized.includes(kw))) return 'savings';
  if (DEFAULT_FIXED_COST_KEYWORDS.some(kw => normalized.includes(kw))) return 'fixedCosts';
  return 'guiltFree';
}

/**
 * Pick a CSP bucket for a category.
 * Priority: custom mapping → group name → keywords (if enabled) → guilt-free
 */
export function getBucketForCategory(categoryId, categoryName, groupName, categoryMappings = {}, useKeywordFallback = false) {
  if (categoryId && categoryMappings[categoryId]) return categoryMappings[categoryId];
  if (categoryName && categoryMappings[categoryName]) return categoryMappings[categoryName];
  if (SAVINGS_INVESTMENT_CATEGORIES.includes(categoryName)) return 'investments';

  const groupBucket = mapGroupNameToBucket(groupName);
  if (groupBucket) return groupBucket;

  if (useKeywordFallback && categoryName) return inferBucketFromKeywords(categoryName);
  return 'guiltFree';
}

// ============================================
// Accounts
// ============================================

// YNAB loan account types (balances move on their own: interest, escrow, adjustments)
const LOAN_TYPES = new Set([
  'mortgage', 'autoloan', 'studentloan', 'personalloan', 'medicaldebt',
  'otherdebt', 'otherliability', 'loan'
]);
const DEBT_TYPES = new Set([...LOAN_TYPES, 'creditcard', 'lineofcredit', 'credit']);

const INVESTMENT_NAME_PATTERN =
  /401\s*\(?k\)?|403\s*\(?b\)?|\b457\b|\bira\b|roth|\bhsa\b|brokerage|investment|\bstock|\brsu\b|espp|fidelity|vanguard|schwab|altruist|retirement|\b529\b|\bsip\b/;

// Raw YNAB accounts use type; the dashboard's normalized accounts use account_type
const accountType = acc => (acc?.type || acc?.account_type || '').toLowerCase();
const accountName = acc => (acc?.name || '').toLowerCase();

export function isOnBudget(acc) {
  return acc?.on_budget !== false;
}

export function isLoanAccount(acc) {
  return LOAN_TYPES.has(accountType(acc));
}

export function isDebtAccount(acc) {
  const name = accountName(acc);
  return DEBT_TYPES.has(accountType(acc)) ||
    name.includes('mortgage') || name.includes('loan') || name.includes('credit card');
}

export function isHomeValueAccount(acc) {
  const name = accountName(acc);
  return ['home value', 'house value', 'redfin', 'zillow', 'property value', 'real estate']
    .some(term => name.includes(term));
}

/**
 * Investment accounts are tracking (off-budget) accounts holding investments.
 * A budget account is cash no matter what it's called: "Schwab Investor
 * Checking" is a checking account, not a brokerage.
 */
export function isInvestmentAccount(acc) {
  if (!acc || isOnBudget(acc) || isDebtAccount(acc) || isHomeValueAccount(acc)) return false;
  return accountType(acc) === 'otherasset' || INVESTMENT_NAME_PATTERN.test(accountName(acc));
}

// ============================================
// Classification
// ============================================

// Balance bookkeeping, not cash flow
const SYSTEM_PAYEES = new Set([
  'Starting Balance',
  'Reconciliation Balance Adjustment',
  'Manual Balance Adjustment'
]);

// Payroll deductions (401(k), stock purchase plans) never pass through a budget
// account. Brokerage imports record them as a "Contribution" inflow in the
// investment account.
const CONTRIBUTION_PAYEE = /contribution/i;

// Money sent to your own brokerage is investing whatever category it carries
const BROKERAGE_PAYEE = /\b(vanguard|altruist)\b/i;

// Some cached transactions store a missing transfer account as the string 'null'
function transferAccountOf(line) {
  const id = line.transfer_account_id;
  return id && id !== 'null' ? id : null;
}

export function isPayrollContribution(line, account) {
  return (line.amount || 0) > 0 && !transferAccountOf(line) &&
    isInvestmentAccount(account) && CONTRIBUTION_PAYEE.test(line.payee_name || '');
}

export function isBrokeragePayment(line) {
  return (line.amount || 0) < 0 && !transferAccountOf(line) && BROKERAGE_PAYEE.test(line.payee_name || '');
}

function isUncategorized(line) {
  return !line.category_id ||
    line.category_name === 'Uncategorized' ||
    (line.category_name || '').startsWith('Split (Multiple Categories)');
}

function toSet(value) {
  if (value instanceof Set) return value;
  return new Set(Array.isArray(value) ? value : []);
}

/**
 * Expand split transactions into their subtransactions and drop deleted items.
 * The split parent carries the total under a "Split" pseudo-category, so using
 * it directly would mislabel every line. Lines keep YNAB's field names.
 * @param {Array} transactions - YNAB transactions
 * @returns {Array} - Line items
 */
export function flattenLines(transactions = []) {
  const lines = [];

  (transactions || []).forEach(txn => {
    if (!txn || txn.deleted) return;
    const subs = (txn.subtransactions || []).filter(sub => !sub.deleted);

    if (subs.length === 0) {
      lines.push(txn);
      return;
    }

    subs.forEach(sub => lines.push({
      ...sub,
      date: txn.date,
      account_id: txn.account_id,
      account_name: txn.account_name,
      payee_name: sub.payee_name || txn.payee_name,
      cleared: txn.cleared,
      approved: txn.approved,
      _parentId: txn.id
    }));
  });

  return lines;
}

function categoryIndex(categories) {
  const byId = new Map();
  (categories?.category_groups || []).forEach(group => {
    (group.categories || []).forEach(cat => byId.set(cat.id, { name: cat.name, groupName: group.name }));
  });
  return byId;
}

function accountIndex(accounts) {
  return new Map((accounts || []).map(acc => [acc.id || acc.account_id, acc]));
}

/**
 * Build a classifier for a budget
 * @param {Object} options
 * @param {Array} options.accounts - YNAB accounts (raw or normalized; needs id, type, on_budget)
 * @param {Object} [options.categories] - YNAB categories response ({ category_groups })
 * @param {Object} [options.cspSettings] - { categoryMappings, excludedPayees, excludedCategories, excludedExpenseCategories, useKeywordFallback or settings.useKeywordFallback }
 * @returns {Function} - line => { kind, bucket, groupName, payroll? }
 */
export function createClassifier({ accounts = [], categories = null, cspSettings = {} } = {}) {
  const accountsById = accountIndex(accounts);
  const categoriesById = categoryIndex(categories);

  const categoryMappings = cspSettings.categoryMappings || {};
  const excludedPayees = toSet(cspSettings.excludedPayees);
  const excludedCategories = toSet(cspSettings.excludedCategories);
  const excludedExpenseCategories = toSet(cspSettings.excludedExpenseCategories);
  const useKeywordFallback = cspSettings.settings?.useKeywordFallback ?? cspSettings.useKeywordFallback ?? false;

  return function classify(line) {
    const amount = line.amount || 0;
    const account = accountsById.get(line.account_id);
    const categoryInfo = categoriesById.get(line.category_id);
    const groupName = categoryInfo?.groupName || '';
    const categoryName = categoryInfo?.name || line.category_name;
    const bucketFor = () => getBucketForCategory(
      line.category_id, categoryName, groupName, categoryMappings, useKeywordFallback
    );
    const result = (kind, bucket = null) => ({ kind, bucket, groupName });

    if (SYSTEM_PAYEES.has(line.payee_name)) return result('ignored');

    if (isPayrollContribution(line, account)) return { ...result('investing', 'investments'), payroll: true };

    // Tracking accounts: market moves, home value updates, loan adjustments.
    // Money entering them from the budget is captured on the budget side.
    if (account && !isOnBudget(account)) return result('ignored');

    if (isBrokeragePayment(line)) {
      return excludedExpenseCategories.has(line.category_id) ? result('ignored') : result('investing', 'investments');
    }

    const transferAccountId = transferAccountOf(line);
    if (transferAccountId) {
      const counterpart = accountsById.get(transferAccountId);

      // Contributions to your own investments are not spending, and money
      // coming back out of them is not income
      if (isInvestmentAccount(counterpart)) {
        return amount < 0 ? result('investing', 'investments') : result('transfer');
      }

      // Transfers between budget accounts (credit card payments, checking →
      // savings) can't carry a category in YNAB. A categorized transfer is
      // money leaving the budget: a mortgage or loan payment, or a deposit to
      // a tracking savings account.
      if (!line.category_id || isIncomeCategory(categoryName) || amount > 0) return result('transfer');
      if (excludedExpenseCategories.has(line.category_id)) return result('ignored');

      const bucket = bucketFor();
      if (bucket === 'investments') return result('investing', bucket);
      if (bucket === 'savings') return result('saving', bucket);
      return result('spending', bucket);
    }

    if (isIncomeCategory(categoryName)) {
      const excluded = excludedPayees.has(line.payee_name || 'Unknown') || excludedCategories.has(line.category_id);
      return result(excluded ? 'excludedIncome' : 'income');
    }

    if (isUncategorized(line)) {
      // Balance adjustments inside loan accounts aren't cash flow
      if (account && isLoanAccount(account)) return result('ignored');
      return result('uncategorized');
    }

    if (excludedExpenseCategories.has(line.category_id)) return result('ignored');

    // An outflow in an investment category (e.g. paying an untracked brokerage)
    // is investing. An inflow there (e.g. stock-sale proceeds) is a withdrawal,
    // not income. Everything else that leaves to a payee is spending, including
    // purchases funded from savings categories.
    const bucket = bucketFor();
    if (bucket === 'investments') return amount < 0 ? result('investing', bucket) : result('transfer');
    return result('spending', bucket);
  };
}

/**
 * Display label for each category. Categories that share a name get their
 * group appended, e.g. "Gifts (Savings)". Computed from the whole budget so
 * every summary and every month uses the same label.
 * @param {Object} categories - YNAB categories response ({ category_groups })
 * @returns {Map} - id -> label
 */
export function categoryLabels(categories) {
  const categoriesById = categoryIndex(categories);

  const counts = new Map();
  categoriesById.forEach(({ name }) => counts.set(name, (counts.get(name) || 0) + 1));

  const labels = new Map();
  categoriesById.forEach(({ name, groupName }, id) => {
    const group = (groupName || '').replace(/[^\p{L}\p{N}&\s-]/gu, '').trim();
    labels.set(id, counts.get(name) > 1 && group ? `${name} (${group})` : name);
  });
  return labels;
}

/**
 * Flatten and classify transactions
 * @param {Array} transactions - YNAB transactions
 * @param {Object} options - Same as createClassifier
 * @returns {Array} - YNAB line items with kind, bucket, groupName, payroll,
 *   categoryLabel, amountDollars and monthKey added
 */
export function classifyTransactions(transactions, options = {}) {
  const classify = createClassifier(options);
  const labels = categoryLabels(options.categories);
  const lines = flattenLines(transactions).map(line => {
    const { kind, bucket, groupName, payroll = false } = classify(line);
    return {
      ...line,
      kind,
      bucket,
      groupName,
      payroll,
      categoryLabel: labels.get(line.category_id) || line.category_name,
      amountDollars: (line.amount || 0) / 1000,
      monthKey: String(line.date || '').slice(0, 7)
    };
  });
  dropDuplicateContributions(lines, accountIndex(options.accounts));
  return lines;
}

const keyToUtc = key => {
  const [y, m, d] = String(key).slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const daysApart = (a, b) => Math.round(Math.abs(keyToUtc(a) - keyToUtc(b)) / 86400000);

/**
 * A contribution paid from a budget account can also show up as a
 * "Contribution" in the brokerage import. Count it once: drop the brokerage
 * side when a payment of the same amount went to that account within 5 days.
 * A transfer names its account; a payment to a payee matches an account whose
 * name contains the payee's first word ("Vanguard" -> "Vanguard IRA").
 */
function dropDuplicateContributions(lines, accountsById) {
  const budgetSide = lines.filter(line => line.kind === 'investing' && !line.payroll);
  if (budgetSide.length === 0) return;
  const used = new Set();

  const paidTo = (paid, accountId) => {
    const transferAccountId = transferAccountOf(paid);
    if (transferAccountId) return transferAccountId === accountId;
    const firstWord = (paid.payee_name || '').toLowerCase().match(/[a-z0-9]{3,}/)?.[0];
    return Boolean(firstWord) && accountName(accountsById.get(accountId)).includes(firstWord);
  };

  lines.forEach(line => {
    if (!line.payroll || line.kind !== 'investing') return;
    const match = budgetSide.find(paid => !used.has(paid) &&
      paid.amount === -line.amount && daysApart(paid.date, line.date) <= 5 &&
      paidTo(paid, line.account_id));
    if (match) {
      used.add(match);
      line.kind = 'ignored';
      line.bucket = null;
    }
  });
}

// ============================================
// Summaries
// ============================================

/**
 * Summarize classified lines, optionally within an inclusive date range.
 * Spending is netted per category (refunds reduce their category) and floored
 * at zero, so category amounts always add up to the spending total.
 * @param {Array} lines - Output of classifyTransactions
 * @param {string} [start] - 'YYYY-MM-DD' inclusive
 * @param {string} [end] - 'YYYY-MM-DD' inclusive
 * @returns {Object} - { income, excludedIncome, spending, investing, saving, net,
 *   byCategory, bucketTotals, uncategorized }
 */
export function summarizeLines(lines, start = null, end = null) {
  let income = 0;
  let excludedIncome = 0;
  let investing = 0;
  let saving = 0;
  const uncategorized = { count: 0, outflow: 0, inflow: 0, items: [] };
  // Keyed by category ID: two categories can share a name in different groups
  const spendingByCategory = new Map();

  lines.forEach(line => {
    const date = String(line.date || '').slice(0, 10);
    if ((start && date < start) || (end && date > end)) return;
    const amount = line.amountDollars ?? (line.amount || 0) / 1000;

    switch (line.kind) {
      case 'income':
        income += amount;
        break;
      case 'excludedIncome':
        excludedIncome += amount;
        break;
      case 'spending': {
        const key = line.category_id || `name:${line.category_name}`;
        const entry = spendingByCategory.get(key) ||
          { name: line.categoryLabel || line.category_name || 'Uncategorized', bucket: line.bucket, amount: 0 };
        entry.amount -= amount;
        spendingByCategory.set(key, entry);
        break;
      }
      case 'investing':
        // Budget-side contributions are outflows; payroll contributions are
        // inflows to the investment account
        investing += line.payroll ? amount : -amount;
        break;
      case 'saving':
        saving -= amount;
        break;
      case 'uncategorized':
        uncategorized.count++;
        if (amount < 0) uncategorized.outflow -= amount;
        else uncategorized.inflow += amount;
        uncategorized.items.push({ date: line.date, payee: line.payee_name || '', amount });
        break;
      default:
        break;
    }
  });

  const byCategory = [];
  const bucketTotals = { fixedCosts: 0, investments: 0, savings: 0, guiltFree: 0 };
  let spending = 0;
  spendingByCategory.forEach(({ name, bucket, amount }, key) => {
    if (amount <= 0) return;
    const entryBucket = bucket || 'guiltFree';
    byCategory.push({ key, name, amount, bucket: entryBucket });
    bucketTotals[entryBucket] = (bucketTotals[entryBucket] || 0) + amount;
    spending += amount;
  });
  byCategory.sort((a, b) => b.amount - a.amount);

  investing = Math.max(0, investing);
  saving = Math.max(0, saving);
  bucketTotals.investments += investing;
  bucketTotals.savings += saving;

  // The newsletter lists the three largest
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
