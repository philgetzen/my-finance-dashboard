/**
 * Newsletter Cash-Flow Ledger
 *
 * The classification rules (what counts as income, spending, investing and
 * saving) live in shared/cashflow.mjs, which the dashboard uses too, so the
 * email and the dashboard agree. This file adds the newsletter's calendar math
 * (dates in the newsletter timezone) and runway's cash-account rule.
 *
 * Ledger lines keep YNAB's field names (payee_name, category_id, amount in
 * milliunits) plus kind, bucket, payroll, categoryLabel, amountDollars and
 * monthKey.
 */

// The shared rules are an ES module. Vercel's function runtime can't
// require() one, so it loads with import(). Await loadSharedRules() before
// building a ledger.
let shared = null;
let loading = null;

function loadSharedRules() {
  loading ??= import('../../shared/cashflow.mjs').then(mod => {
    shared = mod;
    return mod;
  });
  return loading;
}

function rules() {
  if (!shared) throw new Error('Shared cash-flow rules not loaded: await loadSharedRules() first');
  return shared;
}

const isOnBudget = acc => rules().isOnBudget(acc);
const isLoanAccount = acc => rules().isLoanAccount(acc);
const isDebtAccount = acc => rules().isDebtAccount(acc);
const isHomeValueAccount = acc => rules().isHomeValueAccount(acc);
const isInvestmentAccount = acc => rules().isInvestmentAccount(acc);

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

/**
 * The Sunday-Saturday week a newsletter reports on: the current week when it
 * runs on Saturday (the scheduled day), otherwise the last full week
 */
function reportWeek(today) {
  const end = dayOfWeek(today) === 6 ? today : addDays(startOfWeek(today), -1);
  return { start: addDays(end, -6), end };
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

/**
 * Cash available for runway: budget accounts that aren't debt, plus tracking
 * checking/savings/cash accounts
 */
function isCashAccount(acc) {
  if (!acc || acc.closed || isDebtAccount(acc) || isHomeValueAccount(acc)) return false;
  if (isOnBudget(acc)) return true;
  return ['checking', 'savings', 'cash'].includes((acc.type || '').toLowerCase());
}

// ============================================
// Ledger
// ============================================

/**
 * Build the classified ledger for a budget
 * @param {Object} data - { accounts, transactions, categories } from YNAB
 * @param {Object} cspSettings - CSP settings (mappings and exclusions)
 * @returns {Object} - { lines }
 */
function buildLedger(data = {}, cspSettings = {}) {
  const { accounts = [], transactions = [], categories = {} } = data;
  return { lines: rules().classifyTransactions(transactions, { accounts, categories, cspSettings }) };
}

/**
 * Summarize ledger lines in an inclusive date range
 * @param {Array} lines - Ledger lines
 * @param {string} start - 'YYYY-MM-DD' inclusive
 * @param {string} end - 'YYYY-MM-DD' inclusive
 */
function summarize(lines, start, end) {
  return rules().summarizeLines(lines, start, end);
}

module.exports = {
  // Dates
  todayKey,
  addDays,
  daysBetween,
  dayOfWeek,
  startOfWeek,
  reportWeek,
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

  // Ledger
  loadSharedRules,
  buildLedger,
  summarize
};
