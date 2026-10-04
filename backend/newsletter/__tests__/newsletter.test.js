const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const cashflow = require('../cashflow');
const { calculateAllMetrics } = require('../metrics');
const { calculateAllTrends } = require('../trends');
const { generateNewsletterHtml } = require('../template');
const { generateTemplateAnalysis } = require('../../services/aiAnalysisService');

// --------------------------------------------
// Fixture: accounts and categories shaped like the YNAB API
// --------------------------------------------

const accounts = [
  { id: 'checking', name: 'BoA Checking Joint', type: 'checking', on_budget: true, balance: 60000000 },
  { id: 'schwab', name: 'Schwab Investor Checking Phil', type: 'checking', on_budget: true, balance: 20000000 },
  { id: 'card', name: 'Chase Sapphire Reserve', type: 'creditCard', on_budget: true, balance: -2000000 },
  { id: 'brokerage', name: "Phillip Getzen's Individual", type: 'otherAsset', on_budget: false, balance: 500000000 },
  { id: 'k401', name: 'APPLE 401(K) PLAN', type: 'otherAsset', on_budget: false, balance: 0 },
  { id: 'vanguard', name: 'Vanguard Roth IRA', type: 'otherAsset', on_budget: false, balance: 0 },
  { id: 'home', name: '8331 Home Value', type: 'otherAsset', on_budget: false, balance: 1200000000 },
  { id: 'mortgage', name: '8331 Mortgage', type: 'mortgage', on_budget: false, balance: -600000000 },
  { id: 'loan', name: 'Kia Loan', type: 'autoLoan', on_budget: true, balance: -20000000 }
];

const categories = {
  category_groups: [
    { name: 'Internal Master Category', categories: [
      { id: 'rta', name: 'Inflow: Ready to Assign' },
      { id: 'uncat', name: 'Uncategorized' }
    ] },
    { name: '🔗 Fixed Costs', categories: [
      { id: 'mortgage-cat', name: '8331 Mortgage' },
      { id: 'kia-cat', name: 'Kia Loan' },
      { id: 'nanny', name: 'Nanny Salary' },
      { id: 'groceries', name: 'Groceries' }
    ] },
    { name: '👩🏽‍❤️‍👨🏼 Family Guilt Free Spending', categories: [
      { id: 'dining', name: 'Dining Out' },
      { id: 'household', name: 'Household Goods' }
    ] },
    { name: '💵 Savings', categories: [
      { id: 'trip', name: 'Japan Trip' }
    ] },
    { name: '🤑 Post Tax Investments', categories: [
      { id: 'invest', name: 'Investments (Stocks, ETFs, MFs)' }
    ] }
  ]
};

let seq = 0;
function txn(date, accountId, dollars, fields = {}) {
  seq++;
  const categoryName = fields.category_id
    ? categories.category_groups.flatMap(g => g.categories).find(c => c.id === fields.category_id)?.name
    : null;
  return {
    id: `t${seq}`,
    date,
    account_id: accountId,
    amount: Math.round(dollars * 1000),
    payee_name: 'Payee',
    category_id: null,
    category_name: categoryName,
    transfer_account_id: null,
    subtransactions: [],
    deleted: false,
    ...fields
  };
}

const income = (date, dollars, payee = 'Disney') =>
  txn(date, 'checking', dollars, { category_id: 'rta', payee_name: payee });
const spend = (date, dollars, category_id, accountId = 'card') =>
  txn(date, accountId, -dollars, { category_id });

/** Six steady months (Apr-Sep 2026) plus the first days of October */
function steadyBudget() {
  const transactions = [];
  ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].forEach(month => {
    transactions.push(income(`${month}-01`, 10000));
    transactions.push(spend(`${month}-01`, 3000, 'mortgage-cat', 'checking'));
    transactions.push(spend(`${month}-10`, 1000, 'groceries'));
    transactions.push(spend(`${month}-15`, 1000, 'dining'));
  });
  transactions.push(spend('2026-10-01', 100, 'dining'));
  return transactions;
}

function run(transactions, { today = '2026-10-02', cspSettings = {}, snapshots = [], goals = {} } = {}) {
  const metrics = calculateAllMetrics({ accounts, transactions, categories }, { today, cspSettings });
  const trends = calculateAllTrends(metrics, snapshots, goals);
  return { metrics, trends };
}

function classify(transactions, cspSettings = {}) {
  return cashflow.buildLedger({ accounts, transactions, categories }, cspSettings).lines;
}

// --------------------------------------------
// Inflows and outflows
// --------------------------------------------

describe('cash-flow classification', () => {
  test('uncategorized outflows are flagged, not counted as spending', () => {
    // Sep 19, 2026 newsletter: a $250,361 uncategorized outflow showed as weekly spending
    const transactions = [
      spend('2026-09-14', 200, 'groceries'),
      txn('2026-09-15', 'checking', -250361, { category_id: 'uncat', category_name: 'Uncategorized', payee_name: 'Wire Out' })
    ];
    const { trends } = run(transactions, { today: '2026-09-19' });

    assert.equal(trends.weekly.currentWeek.spending, 200);
    assert.equal(trends.weekly.currentWeek.uncategorized.count, 1);
    assert.equal(trends.weekly.currentWeek.uncategorized.outflow, 250361);
  });

  test('tracking-account activity is ignored (home value, market moves, loan adjustments)', () => {
    const lines = classify([
      txn('2026-08-25', 'home', -16726, { payee_name: 'Redfin estimate' }),
      txn('2026-08-25', 'brokerage', -13679, { payee_name: 'Etf Sell' }),
      txn('2026-08-25', 'mortgage', -1118, { payee_name: 'Manual Balance Adjustment' })
    ]);
    assert.deepEqual(lines.map(l => l.kind), ['ignored', 'ignored', 'ignored']);
  });

  test('investment contributions are investing, not spending', () => {
    const lines = classify([
      txn('2026-09-01', 'checking', -5000, { transfer_account_id: 'brokerage', category_id: 'invest', payee_name: 'Transfer : Brokerage' }),
      spend('2026-09-02', 5, 'invest', 'schwab')
    ]);
    assert.deepEqual(lines.map(l => l.kind), ['investing', 'investing']);
  });

  test('money coming back from investments is not income', () => {
    const lines = classify([
      txn('2026-09-01', 'checking', 20000, { transfer_account_id: 'brokerage', category_id: 'rta', payee_name: 'Transfer : Brokerage' })
    ]);
    assert.equal(lines[0].kind, 'transfer');
  });

  test('payroll contributions recorded in the investment account are investing', () => {
    // Oct 3, 2026 newsletter: 401(k) and SIP deductions never touch a budget
    // account, so YTD investing showed $0
    const lines = classify([
      txn('2026-09-11', 'k401', 1375.84, { payee_name: 'Contribution' }),
      txn('2026-09-11', 'k401', 42.10, { payee_name: 'Dividend' }),
      txn('2026-09-11', 'k401', -1375.84, { payee_name: 'Vanguard Target 2050 Buy' }),
      txn('2026-09-11', 'home', 5000, { payee_name: 'Contribution' })
    ]);
    assert.deepEqual(lines.map(l => l.kind), ['investing', 'ignored', 'ignored', 'ignored']);
    assert.equal(cashflow.summarize(lines, '2026-09-01', '2026-09-30').investing, 1375.84);
  });

  test('payments to Vanguard or Altruist are investing in any category, even uncategorized', () => {
    const lines = classify([
      spend('2026-09-04', 500, 'trip', 'schwab'),
      txn('2026-09-11', 'checking', -2500, { payee_name: 'ALTRUIST FINANCIAL ACH' }),
      txn('2026-09-12', 'checking', 800, { category_id: 'rta', payee_name: 'Vanguard' })
    ].map((t, i) => (i === 0 ? { ...t, payee_name: 'Vanguard' } : t)));
    assert.deepEqual(lines.map(l => l.kind), ['investing', 'investing', 'income']);
    assert.equal(cashflow.summarize(lines, '2026-09-01', '2026-09-30').investing, 3000);
  });

  test('Poppins nanny payroll stays spending', () => {
    const lines = classify([
      txn('2026-09-11', 'checking', -1500, { category_id: 'nanny', payee_name: 'Poppins Payroll' })
    ]);
    assert.deepEqual(lines.map(l => [l.kind, l.bucket]), [['spending', 'fixedCosts']]);
  });

  test('a contribution paid from the budget and imported by the brokerage counts once', () => {
    const lines = classify([
      txn('2026-04-01', 'schwab', -7000, { category_id: 'invest', payee_name: 'Vanguard' }),
      txn('2026-04-03', 'vanguard', 7000, { payee_name: 'Contribution' }),
      txn('2026-05-01', 'checking', -500, { transfer_account_id: 'brokerage', payee_name: 'Transfer : Individual' }),
      txn('2026-05-02', 'brokerage', 500, { payee_name: 'Contribution' })
    ]);
    assert.deepEqual(lines.map(l => l.kind), ['investing', 'ignored', 'investing', 'ignored']);
    assert.equal(cashflow.summarize(lines, '2026-04-01', '2026-05-31').investing, 7500);
  });

  test('equal contributions to different accounts, or more than 5 days apart, both count', () => {
    const lines = classify([
      txn('2026-10-01', 'checking', -500, { category_id: 'invest', payee_name: 'Vanguard' }),
      txn('2026-10-03', 'k401', 500, { payee_name: 'Contribution' }),
      txn('2026-10-05', 'checking', -600, { transfer_account_id: 'brokerage', payee_name: 'Transfer : Individual' }),
      txn('2026-10-06', 'vanguard', 600, { payee_name: 'Contribution' }),
      txn('2026-11-01', 'checking', -700, { category_id: 'invest', payee_name: 'Vanguard' }),
      txn('2026-11-09', 'vanguard', 700, { payee_name: 'Contribution' })
    ]);
    assert.ok(lines.every(l => l.kind === 'investing'));
    assert.equal(cashflow.summarize(lines, '2026-10-01', '2026-11-30').investing, 3600);
  });

  test('a brokerage payment in a CSP-excluded category is ignored', () => {
    const lines = classify(
      [txn('2026-09-04', 'checking', -250, { category_id: 'dining', payee_name: 'Vanguard' })],
      { excludedExpenseCategories: ['dining'] }
    );
    assert.equal(lines[0].kind, 'ignored');
  });

  test('stock-sale proceeds in an investment category are a withdrawal, not negative investing', () => {
    // Netting the sale against contributions zeroed out a year of investing
    const lines = classify([
      txn('2026-03-01', 'k401', 2000, { payee_name: 'Contribution' }),
      txn('2026-03-05', 'schwab', 30000, { category_id: 'invest', payee_name: 'Stock Sale' })
    ]);
    assert.deepEqual(lines.map(l => l.kind), ['investing', 'transfer']);
    const summary = cashflow.summarize(lines, '2026-01-01', '2026-12-31');
    assert.equal(summary.investing, 2000);
    assert.equal(summary.income, 0);
  });

  test('categorized debt payments are spending whether the loan is on or off budget', () => {
    const lines = classify([
      txn('2026-09-01', 'checking', -3000, { transfer_account_id: 'mortgage', category_id: 'mortgage-cat' }),
      txn('2026-09-01', 'checking', -450, { transfer_account_id: 'loan', category_id: 'kia-cat' }),
      txn('2026-09-01', 'loan', 450, { transfer_account_id: 'checking' })
    ]);
    assert.deepEqual(lines.map(l => [l.kind, l.bucket]), [
      ['spending', 'fixedCosts'],
      ['spending', 'fixedCosts'],
      ['transfer', null]
    ]);
  });

  test('transfers between budget accounts are ignored (credit card payments)', () => {
    const lines = classify([
      txn('2026-09-05', 'checking', -2000, { transfer_account_id: 'card' }),
      txn('2026-09-05', 'card', 2000, { transfer_account_id: 'checking' })
    ]);
    assert.deepEqual(lines.map(l => l.kind), ['transfer', 'transfer']);
  });

  test('a budget checking account named "Schwab" is cash, not an investment account', () => {
    const lines = classify([spend('2026-09-05', 1154, 'nanny', 'schwab')]);
    assert.equal(lines[0].kind, 'spending');
    assert.equal(cashflow.isInvestmentAccount(accounts[1]), false);
  });

  test('split transactions are expanded into their categories', () => {
    const lines = classify([
      txn('2026-09-05', 'card', -300, {
        category_name: 'Split (Multiple Categories)...',
        category_id: 'split',
        subtransactions: [
          { id: 's1', amount: -200000, category_id: 'groceries', category_name: 'Groceries' },
          { id: 's2', amount: -100000, category_id: 'household', category_name: 'Household Goods' }
        ]
      })
    ]);
    assert.deepEqual(lines.map(l => [l.category_name, l.amountDollars, l.date]), [
      ['Groceries', -200, '2026-09-05'],
      ['Household Goods', -100, '2026-09-05']
    ]);
  });

  test('refunds reduce spending in their category', () => {
    const lines = classify([spend('2026-09-05', 100, 'dining'), spend('2026-09-06', -40, 'dining')]);
    const summary = cashflow.summarize(lines, '2026-09-01', '2026-09-30');
    assert.equal(summary.spending, 60);
    assert.deepEqual(summary.byCategory.map(c => [c.name, c.amount]), [['Dining Out', 60]]);
  });

  test('income from payees excluded on the CSP page is not counted', () => {
    const lines = classify(
      [income('2026-09-01', 59237, 'Merrill Lynch Funds Transfer'), income('2026-09-01', 8000, 'Disney')],
      { excludedPayees: new Set(['Merrill Lynch Funds Transfer']) }
    );
    assert.equal(cashflow.summarize(lines, '2026-09-01', '2026-09-30').income, 8000);
  });

  test('emoji-prefixed YNAB group names map to CSP buckets', () => {
    assert.equal(cashflow.mapGroupNameToBucket('🔗 Fixed Costs'), 'fixedCosts');
    assert.equal(cashflow.mapGroupNameToBucket('💵 Savings'), 'savings');
    assert.equal(cashflow.mapGroupNameToBucket('🤑 Post Tax Investments'), 'investments');
    assert.equal(cashflow.mapGroupNameToBucket('👩🏽‍❤️‍👨🏼 Family Guilt Free Spending'), 'guiltFree');
    assert.equal(cashflow.mapGroupNameToBucket('✅ True Expenses'), 'guiltFree');
  });

  test('same-named categories in different groups keep their own buckets', () => {
    const cats = {
      category_groups: [
        { name: '💵 Savings', categories: [{ id: 'gift-save', name: 'Gifts' }] },
        { name: 'Guilt Free', categories: [{ id: 'gift-fun', name: 'Gifts' }] }
      ]
    };
    const lines = cashflow.buildLedger({
      accounts,
      categories: cats,
      transactions: [
        txn('2026-09-01', 'card', -100, { category_id: 'gift-save', category_name: 'Gifts' }),
        txn('2026-09-02', 'card', -40, { category_id: 'gift-fun', category_name: 'Gifts' })
      ]
    }).lines;
    const summary = cashflow.summarize(lines, '2026-09-01', '2026-09-30');

    assert.equal(summary.bucketTotals.savings, 100);
    assert.equal(summary.bucketTotals.guiltFree, 40);
    assert.deepEqual(summary.byCategory.map(c => c.name), ['Gifts (Savings)', 'Gifts (Guilt Free)']);
  });

  test('same-named categories keep their group label across months', () => {
    // Each month has only one of the two Gifts; labels must still match
    const cats = {
      category_groups: [
        { name: 'Internal Master Category', categories: [{ id: 'rta', name: 'Inflow: Ready to Assign' }] },
        { name: '💵 Savings', categories: [{ id: 'gift-save', name: 'Gifts' }] },
        { name: 'Guilt Free', categories: [{ id: 'gift-fun', name: 'Gifts' }] }
      ]
    };
    const transactions = [
      txn('2026-08-01', 'checking', 5000, { category_id: 'rta', category_name: 'Inflow: Ready to Assign' }),
      txn('2026-08-03', 'card', -100, { category_id: 'gift-save', category_name: 'Gifts' }),
      txn('2026-09-01', 'checking', 5000, { category_id: 'rta', category_name: 'Inflow: Ready to Assign' }),
      txn('2026-09-03', 'card', -40, { category_id: 'gift-fun', category_name: 'Gifts' })
    ];
    const metrics = calculateAllMetrics({ accounts, transactions, categories: cats }, { today: '2026-10-02', periodMonths: 2 });

    assert.deepEqual(
      metrics.csp.topCategories.map(c => [c.name, c.amount, c.bucket]),
      [['Gifts (Savings)', 100, 'savings'], ['Gifts (Guilt Free)', 40, 'guiltFree']]
    );
  });

  test('custom category mappings still win over group names', () => {
    const lines = classify([spend('2026-09-05', 50, 'dining')], { categoryMappings: { dining: 'fixedCosts' } });
    assert.equal(lines[0].bucket, 'fixedCosts');
  });
});

// --------------------------------------------
// Dates
// --------------------------------------------

describe('calendar math', () => {
  test('same day last month clamps to the month length', () => {
    assert.equal(cashflow.sameDayInMonth('2026-03-31', -1), '2026-02-28');
    assert.equal(cashflow.sameDayInMonth('2028-02-29', -12), '2027-02-28');
    assert.equal(cashflow.sameDayInMonth('2026-10-02', -1), '2026-09-02');
  });

  test('weeks start on Sunday and complete months exclude the current month', () => {
    assert.equal(cashflow.startOfWeek('2026-09-19'), '2026-09-13');
    assert.equal(cashflow.startOfWeek('2026-09-13'), '2026-09-13');
    assert.deepEqual(
      cashflow.completeMonths('2026-01-15', 2).map(m => [m.start, m.end]),
      [['2025-11-01', '2025-11-30'], ['2025-12-01', '2025-12-31']]
    );
  });

  test('the report week is the current week on Saturday, otherwise the last full week', () => {
    assert.deepEqual(cashflow.reportWeek('2026-10-03'), { start: '2026-09-27', end: '2026-10-03' });
    // Oct 4, 2026 ad hoc run: a Sunday showed an empty Oct 4 - Oct 10 week
    assert.deepEqual(cashflow.reportWeek('2026-10-04'), { start: '2026-09-27', end: '2026-10-03' });
    // Every other weekday reports the same last full week
    ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'].forEach(day =>
      assert.deepEqual(cashflow.reportWeek(day), { start: '2026-09-27', end: '2026-10-03' }));
    assert.deepEqual(cashflow.reportWeek('2026-10-10'), { start: '2026-10-04', end: '2026-10-10' });
  });

  test('today is taken in the newsletter timezone', () => {
    // 2026-10-03 02:00 UTC is still Friday Oct 2 in Los Angeles
    assert.equal(cashflow.todayKey('America/Los_Angeles', new Date('2026-10-03T02:00:00Z')), '2026-10-02');
  });
});

// --------------------------------------------
// Metrics and trends
// --------------------------------------------

describe('newsletter metrics', () => {
  test('runway and burn rate average complete months only', () => {
    // On Oct 2 the month-to-date has $100 of spending. Averaging it in would
    // understate burn by ~16%.
    const { metrics } = run(steadyBudget());

    assert.equal(metrics.runway.avgMonthlyExpenses, 5000);
    assert.equal(metrics.runway.avgMonthlyIncome, 10000);
    assert.equal(metrics.runway.avgMonthlyNet, 5000);
    assert.equal(metrics.runway.netRunwayMonths, Infinity);
    assert.equal(metrics.runway.cashReserves, 80000); // two checking accounts; card debt isn't cash
    assert.equal(metrics.burnRate.average, 5000);
    assert.equal(metrics.burnRate.currentMonth, 100);
    assert.equal(metrics.burnRate.trend, 'stable');
  });

  test('investing lowers neither income nor runway, and is reported separately', () => {
    const transactions = steadyBudget();
    ['2026-07', '2026-08', '2026-09'].forEach(month => transactions.push(
      txn(`${month}-20`, 'checking', -2000, { transfer_account_id: 'brokerage', category_id: 'invest' })
    ));
    const { metrics } = run(transactions);

    assert.equal(metrics.runway.avgMonthlyExpenses, 5000);
    assert.equal(metrics.runway.avgMonthlyInvesting, 1000);
    assert.equal(metrics.csp.buckets.investments.total, 6000);
    assert.equal(metrics.csp.buckets.investments.percentage, 10);
    assert.equal(metrics.csp.buckets.fixedCosts.percentage, 40); // mortgage + groceries
    assert.equal(metrics.csp.buckets.guiltFree.percentage, 10);
  });

  test('YTD investments are this year\'s contributions, not a 6-month CSP total', () => {
    const transactions = steadyBudget();
    transactions.push(txn('2025-12-20', 'checking', -9000, { transfer_account_id: 'brokerage', category_id: 'invest' }));
    transactions.push(txn('2026-02-20', 'checking', -4000, { transfer_account_id: 'brokerage', category_id: 'invest' }));
    const { trends } = run(transactions);

    assert.equal(trends.annualProgress.ytd.investments, 4000);
  });

  test('YTD investments include payroll contributions', () => {
    const transactions = steadyBudget();
    ['2026-01-09', '2026-01-23', '2026-02-06'].forEach(date =>
      transactions.push(txn(date, 'k401', 1375.84, { payee_name: 'Contribution' })));
    const { trends } = run(transactions);

    assert.equal(Math.round(trends.annualProgress.ytd.investments * 100) / 100, 4127.52);
  });

  test('an ad hoc run on Sunday reports the week that just ended', () => {
    const transactions = [spend('2026-09-29', 300, 'dining'), spend('2026-10-04', 50, 'dining')];
    const { metrics, trends } = run(transactions, { today: '2026-10-04' });

    assert.equal(trends.weekly.weekStart, '2026-09-27');
    assert.equal(trends.weekly.weekEnd, '2026-10-03');
    assert.equal(trends.weekly.currentWeek.spending, 300);
    assert.deepEqual(metrics.weeklyTopCategories.map(c => [c.name, c.amount]), [['Dining Out', 300]]);
  });

  test('weekly top categories compare against the 6 prior full weeks', () => {
    const transactions = [];
    for (let week = 1; week <= 6; week++) {
      transactions.push(spend(cashflow.addDays('2026-09-13', -7 * week + 1), 60, 'dining'));
    }
    transactions.push(spend('2026-09-14', 90, 'dining'));
    const { metrics, trends } = run(transactions, { today: '2026-09-19' });

    assert.equal(trends.weekly.sixWeekAverage, 60);
    assert.deepEqual(metrics.weeklyTopCategories.map(c => [c.name, c.amount, c.average, c.vsAverage]), [
      ['Dining Out', 90, 60, 50]
    ]);
  });

  test('month-over-month compares the same days, clamped at month end', () => {
    const transactions = [
      spend('2026-02-27', 100, 'dining'),
      spend('2026-02-28', 100, 'dining'),
      spend('2026-03-01', 50, 'dining'),
      spend('2026-03-02', 999, 'dining')
    ];
    const { trends } = run(transactions, { today: '2026-03-31' });

    assert.equal(trends.monthOverMonth.isPartialMonth, false);
    assert.equal(trends.monthOverMonth.previousMonth.expenses, 200);
    assert.equal(trends.monthOverMonth.currentMonth.expenses, 1049);
  });

  test('month-over-month category changes ignore income', () => {
    const transactions = [income('2026-10-01', 10000), spend('2026-10-01', 100, 'dining'), income('2026-09-01', 5000)];
    const { trends } = run(transactions);
    assert.deepEqual(trends.monthOverMonth.topCategoryChanges.map(c => c.category), ['Dining Out']);
  });

  test('net worth subtracts debt with its sign', () => {
    const { metrics } = run([]);
    // cash 80k + brokerage 500k + home 1.2M - (card 2k + mortgage 600k + loan 20k)
    assert.equal(metrics.netWorth.total, 80000 + 500000 + 1200000 - 622000);
    assert.equal(metrics.netWorth.debt, 622000);
  });

  test('net worth progress uses the first snapshot of the year', () => {
    const snapshots = [
      { dateKey: '2026-09-26', netWorth: 1150000 },
      { createdAt: '2026-02-14T17:00:00.000Z', netWorth: 1000000 },
      { dateKey: '2026-06-06', netWorth: 1100000 }
    ];
    const { trends } = run([], { snapshots });

    assert.equal(trends.annualProgress.netWorthProgress.since, '2026-02-14');
    assert.equal(trends.annualProgress.netWorthProgress.startOfYear, 1000000);
  });
});

// --------------------------------------------
// Rendering
// --------------------------------------------

describe('newsletter rendering', () => {
  test('uncategorized transactions get a callout and the hero shows real spending', () => {
    const transactions = [
      spend('2026-09-14', 200, 'groceries'),
      txn('2026-09-15', 'checking', -250361, { category_id: 'uncat', category_name: 'Uncategorized', payee_name: 'Wire <Out>' })
    ];
    const { metrics, trends } = run(transactions, { today: '2026-09-19' });
    const html = generateNewsletterHtml({ metrics, trends, aiAnalysis: null, weekEnding: 'September 19, 2026' });

    assert.match(html, /\$200</);
    assert.match(html, /1 uncategorized transaction/);
    assert.match(html, /Wire &lt;Out&gt;: -\$250,361/);
    assert.match(html, /Sep 13 - Sep 19/);
  });

  test('fallback insights quote the same runway the newsletter shows', () => {
    const transactions = steadyBudget().filter(t => t.category_id !== 'rta');
    const { metrics, trends } = run(transactions);
    const text = generateTemplateAnalysis({ metrics, trends });

    // $80k cash / $5k monthly burn with no income
    assert.equal(Math.round(metrics.runway.netRunwayMonths * 10) / 10, 16);
    assert.match(text, /16 months cash runway/);
  });
});
