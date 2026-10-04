/**
 * Cash-flow classification for YNAB transactions
 *
 * Every line item is classified once so every page agrees on what counts as
 * income and spending (the weekly newsletter uses the same rules in
 * backend/newsletter/cashflow.js):
 *
 *   income        Inflows categorized to Ready to Assign, minus payees/categories
 *                 excluded on the CSP page.
 *   spending      Money that left the household: categorized outflows from budget
 *                 accounts, net of refunds. Includes debt payments.
 *   investing     Transfers into investment accounts and outflows in investment
 *                 categories. Moving money into your own investments is not spending.
 *   saving        Categorized transfers into tracking savings accounts.
 *   uncategorized Budget-account transactions with no category yet.
 *
 * Ignored: tracking-account activity (market moves, home value updates, loan
 * balance adjustments), transfers between budget accounts, investment
 * withdrawals, starting balances and balance adjustments.
 */

import { INCOME_CATEGORIES, SAVINGS_INVESTMENT_CATEGORIES } from './constants';
import { mapGroupNameToBucket, inferBucketFromKeywords } from './categories';

// ============================================
// Calendar dates
// ============================================

/**
 * Parse a YNAB 'YYYY-MM-DD' date as local midnight.
 * new Date('2026-08-01') is UTC midnight, which is July 31 in US time zones.
 * @param {string} dateString - 'YYYY-MM-DD'
 * @returns {Date}
 */
export function parseLocalDate(dateString) {
  if (!dateString) return new Date(NaN);
  const [year, month, day] = String(dateString).slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Local calendar date as 'YYYY-MM-DD'
 * @param {Date} date
 * @returns {string}
 */
export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Local month as 'YYYY-MM'
 * @param {Date} date
 * @returns {string}
 */
export function toMonthKey(date) {
  return toDateKey(date).slice(0, 7);
}

// ============================================
// Accounts
// ============================================

const LOAN_TYPES = new Set([
  'mortgage', 'autoloan', 'studentloan', 'personalloan', 'medicaldebt',
  'otherdebt', 'otherliability', 'loan'
]);
const DEBT_TYPES = new Set([...LOAN_TYPES, 'creditcard', 'lineofcredit', 'credit']);

const INVESTMENT_NAME_PATTERN =
  /401\s*\(?k\)?|403\s*\(?b\)?|\b457\b|\bira\b|roth|\bhsa\b|brokerage|investment|\bstock|\brsu\b|espp|fidelity|vanguard|schwab|altruist|retirement|\b529\b|\bsip\b/;

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

const SYSTEM_PAYEES = new Set([
  'Starting Balance',
  'Reconciliation Balance Adjustment',
  'Manual Balance Adjustment'
]);

const isIncomeCategory = name => INCOME_CATEGORIES.includes(name);

// Payroll deductions (401(k), stock purchase plans) never pass through a budget
// account. Brokerage imports record them as a "Contribution" inflow in the
// investment account. Mirrors backend/newsletter/cashflow.js.
const CONTRIBUTION_PAYEE = /contribution/i;

function isPayrollContribution(line, account) {
  const transferAccountId = line.transfer_account_id && line.transfer_account_id !== 'null';
  return (line.amount || 0) > 0 && !transferAccountId &&
    isInvestmentAccount(account) && CONTRIBUTION_PAYEE.test(line.payee_name || '');
}

// Money sent to your own brokerage is investing whatever category it carries
const BROKERAGE_PAYEE = /\b(vanguard|altruist)\b/i;

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

/**
 * Expand split transactions into their subtransactions and drop deleted items.
 * Lines keep YNAB's field names so UI code can render them directly.
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

/**
 * Build a classifier for a budget
 * @param {Object} options
 * @param {Array} options.accounts - YNAB accounts (raw or normalized; needs id, type, on_budget)
 * @param {Object} [options.categories] - YNAB categories response ({ category_groups })
 * @param {Object} [options.cspSettings] - { categoryMappings, excludedPayees, excludedCategories, excludedExpenseCategories, settings }
 * @returns {Function} - line => { kind, bucket, groupName }
 */
export function createClassifier({ accounts = [], categories = null, cspSettings = {} } = {}) {
  const accountsById = new Map((accounts || []).map(acc => [acc.id || acc.account_id, acc]));

  const groupByCategoryId = new Map();
  (categories?.category_groups || []).forEach(group => {
    (group.categories || []).forEach(cat => groupByCategoryId.set(cat.id, group.name));
  });

  const categoryMappings = cspSettings.categoryMappings || {};
  const excludedPayees = toSet(cspSettings.excludedPayees);
  const excludedCategories = toSet(cspSettings.excludedCategories);
  const excludedExpenseCategories = toSet(cspSettings.excludedExpenseCategories);
  const useKeywordFallback = cspSettings.settings?.useKeywordFallback ?? cspSettings.useKeywordFallback ?? false;

  return function classify(line) {
    const amount = (line.amount || 0) / 1000;
    const account = accountsById.get(line.account_id);
    const groupName = groupByCategoryId.get(line.category_id) || '';
    const bucketFor = () => getBucketForCategory(
      line.category_id, line.category_name, groupName, categoryMappings, useKeywordFallback
    );
    const result = (kind, bucket = null) => ({ kind, bucket, groupName });

    if (SYSTEM_PAYEES.has(line.payee_name)) return result('ignored');

    if (isPayrollContribution(line, account)) return { ...result('investing', 'investments'), payroll: true };

    // Tracking accounts: market moves, home value updates, loan adjustments.
    // Money entering them from the budget is captured on the budget side.
    if (account && !isOnBudget(account)) return result('ignored');

    const transferAccountId = line.transfer_account_id && line.transfer_account_id !== 'null'
      ? line.transfer_account_id
      : null;

    if (amount < 0 && !transferAccountId && BROKERAGE_PAYEE.test(line.payee_name || '')) {
      return excludedExpenseCategories.has(line.category_id) ? result('ignored') : result('investing', 'investments');
    }

    if (transferAccountId) {
      const counterpart = accountsById.get(transferAccountId);

      // Contributions to your own investments are not spending, and money
      // coming back out of them is not income
      if (isInvestmentAccount(counterpart)) {
        return amount < 0 ? result('investing', 'investments') : result('transfer');
      }

      // Transfers between budget accounts can't carry a category in YNAB. A
      // categorized transfer is money leaving the budget: a mortgage or loan
      // payment, or a deposit to a tracking savings account.
      if (!line.category_id || isIncomeCategory(line.category_name) || amount > 0) return result('transfer');
      if (excludedExpenseCategories.has(line.category_id)) return result('ignored');

      const bucket = bucketFor();
      if (bucket === 'investments') return result('investing', bucket);
      if (bucket === 'savings') return result('saving', bucket);
      return result('spending', bucket);
    }

    if (isIncomeCategory(line.category_name)) {
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
    // not income. Everything else that leaves to a payee is spending.
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
  const all = [];
  (categories?.category_groups || []).forEach(group => {
    (group.categories || []).forEach(cat => all.push({ id: cat.id, name: cat.name, groupName: group.name }));
  });

  const counts = new Map();
  all.forEach(({ name }) => counts.set(name, (counts.get(name) || 0) + 1));

  const labels = new Map();
  all.forEach(({ id, name, groupName }) => {
    const group = (groupName || '').replace(/[^\p{L}\p{N}&\s-]/gu, '').trim();
    labels.set(id, counts.get(name) > 1 && group ? `${name} (${group})` : name);
  });
  return labels;
}

/**
 * Flatten and classify transactions
 * @returns {Array} - Lines with kind, bucket, groupName, amountDollars, and monthKey added
 */
export function classifyTransactions(transactions, options = {}) {
  const classify = createClassifier(options);
  const labels = categoryLabels(options.categories);
  const accountsById = new Map((options.accounts || []).map(acc => [acc.id, acc]));
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
  dropDuplicateContributions(lines, accountsById);
  return lines;
}

const daysApart = (a, b) => Math.round(Math.abs(parseLocalDate(a) - parseLocalDate(b)) / 86400000);

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
    const transferAccountId = paid.transfer_account_id && paid.transfer_account_id !== 'null'
      ? paid.transfer_account_id
      : null;
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

/**
 * Summarize classified lines. Spending is netted per category (refunds reduce
 * their category) and floored at zero, so categories add up to the total.
 * @param {Array} lines - Output of classifyTransactions
 * @returns {Object} - { income, spending, investing, saving, uncategorized, byCategory }
 */
export function summarizeLines(lines) {
  let income = 0;
  let investing = 0;
  let saving = 0;
  const uncategorized = { count: 0, outflow: 0, inflow: 0 };
  // Keyed by category ID: two categories can share a name in different groups
  const spendingByCategory = new Map();

  lines.forEach(line => {
    const amount = line.amountDollars ?? (line.amount || 0) / 1000;
    switch (line.kind) {
      case 'income':
        income += amount;
        break;
      case 'spending': {
        const key = line.category_id || `name:${line.category_name}`;
        const entry = spendingByCategory.get(key) ||
          { name: line.categoryLabel || line.category_name || 'Uncategorized', amount: 0, bucket: line.bucket };
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
        break;
      default:
        break;
    }
  });

  const byCategory = Array.from(spendingByCategory.values())
    .filter(cat => cat.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const spending = byCategory.reduce((sum, cat) => sum + cat.amount, 0);

  return {
    income,
    spending,
    investing: Math.max(0, investing),
    saving: Math.max(0, saving),
    net: income - spending,
    uncategorized,
    byCategory
  };
}
