import { MatchIndicator, formatCurrency, amountsMatch } from './DebugDrawer';

/**
 * Summary View - High-level comparison of App vs YNAB totals
 * Displays programmatically fetched YNAB values from months data
 */
export default function SummaryView({ data = {}, isLoading }) {
  const { app = {}, ynab = {} } = data;

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-400">
        <div className="animate-pulse">Loading data...</div>
      </div>
    );
  }

  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="p-4 text-center text-gray-400">
        <p className="mb-2">No data loaded</p>
        <p className="text-xs">Click Refresh to load comparison data</p>
      </div>
    );
  }

  const hasYnabData = Object.keys(ynab).length > 0 && ynab.totalIncome !== undefined;

  const metrics = [
    {
      label: 'Total Income',
      appValue: app.totalIncome,
      ynabValue: ynab.totalIncome,
      key: 'totalIncome',
    },
    {
      label: 'Total Expenses',
      appValue: app.totalExpenses,
      ynabValue: ynab.totalExpenses,
      key: 'totalExpenses',
    },
    {
      label: 'Net (Income - Expenses)',
      appValue: app.net,
      ynabValue: ynab.totalIncome !== undefined && ynab.totalExpenses !== undefined
        ? ynab.totalIncome - ynab.totalExpenses
        : undefined,
      key: 'net',
    },
    {
      label: 'Avg Monthly Spend',
      appValue: app.avgMonthlySpend,
      ynabValue: ynab.avgMonthlySpend,
      key: 'avgMonthlySpend',
    },
    {
      label: 'Month Count',
      appValue: app.monthCount,
      ynabValue: ynab.monthCount,
      key: 'monthCount',
      isCount: true,
    },
  ];

  const allMatch = hasYnabData && metrics.every(m =>
    m.ynabValue === undefined ||
    (m.isCount ? m.appValue === m.ynabValue : amountsMatch(m.appValue, m.ynabValue))
  );

  return (
    <div className="p-4">
      {/* Overall Status */}
      <div className={`mb-4 p-3 rounded-lg ${
        !hasYnabData
          ? 'bg-gray-800/50 border border-gray-700'
          : allMatch
            ? 'bg-green-900/30 border border-green-700'
            : 'bg-yellow-900/30 border border-yellow-700'
      }`}>
        <div className="flex items-center gap-2">
          {hasYnabData && <MatchIndicator isMatch={allMatch} />}
          <span className="text-sm font-medium">
            {!hasYnabData
              ? 'YNAB months data not available'
              : allMatch
                ? 'All metrics match!'
                : 'Some metrics differ'}
          </span>
        </div>
        {hasYnabData && ynab.monthsUsed && (
          <div className="mt-2 text-xs text-gray-500">
            YNAB months used: {ynab.monthsUsed.join(', ')}
          </div>
        )}
      </div>

      {/* Metrics Table */}
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-400 pb-2 border-b border-gray-700">
          <div>Metric</div>
          <div className="text-right">App</div>
          <div className="text-right">YNAB</div>
          <div className="text-center">Status</div>
        </div>

        {metrics.map((metric) => {
          const hasYnab = metric.ynabValue !== undefined;
          const isMatch = !hasYnab || (metric.isCount
            ? metric.appValue === metric.ynabValue
            : amountsMatch(metric.appValue, metric.ynabValue));
          const diff = hasYnab && !metric.isCount
            ? (metric.appValue || 0) - (metric.ynabValue || 0)
            : 0;

          return (
            <div
              key={metric.key}
              className={`grid grid-cols-4 gap-2 text-sm py-2 rounded px-1 ${
                hasYnab && !isMatch ? 'bg-yellow-900/20' : ''
              }`}
            >
              <div className="text-gray-300 truncate" title={metric.label}>
                {metric.label}
              </div>
              <div className="text-right font-mono text-gray-100">
                {metric.isCount ? metric.appValue : formatCurrency(metric.appValue)}
              </div>
              <div className="text-right font-mono text-gray-400">
                {hasYnab
                  ? (metric.isCount ? metric.ynabValue : formatCurrency(metric.ynabValue))
                  : '—'}
              </div>
              <div className="flex items-center justify-center gap-1">
                <MatchIndicator isMatch={isMatch} />
                {hasYnab && !isMatch && !metric.isCount && (
                  <span className={`text-xs ${diff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CSP Buckets Summary */}
      {app.buckets && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">CSP Buckets</h3>
          <BucketSummary appBuckets={app.buckets} />
        </div>
      )}

      {/* Discrepancy Diagnostics */}
      {app.diagnostics && (app.diagnostics.budgetedSavingsAdded > 0 || app.diagnostics.excludedIncome > 0) && (
        <div className="mt-6 pt-4 border-t border-gray-700">
          <h3 className="text-sm font-semibold text-yellow-400 mb-3">⚠️ Discrepancy Sources</h3>
          <div className="space-y-3 text-sm">
            {app.diagnostics.budgetedSavingsAdded > 0 && (
              <div className="bg-yellow-900/20 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300">Budgeted Savings (0 txns)</span>
                  <span className="font-mono text-yellow-400">+{formatCurrency(app.diagnostics.budgetedSavingsAdded)}</span>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  These amounts are added from YNAB budgeted amounts, not actual transactions.
                  This inflates "expenses" compared to YNAB's activity totals.
                </p>
                {app.diagnostics.categoriesWithZeroTxns?.length > 0 && (
                  <div className="space-y-1">
                    {app.diagnostics.categoriesWithZeroTxns.map((cat, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 truncate">{cat.name}</span>
                        <span className="font-mono text-gray-500">{formatCurrency(cat.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {app.diagnostics.excludedIncome > 0 && (
              <div className="bg-blue-900/20 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Excluded Income</span>
                  <span className="font-mono text-blue-400">-{formatCurrency(app.diagnostics.excludedIncome)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Income excluded via payee/category settings. YNAB counts this, app doesn't.
                </p>
              </div>
            )}

            {/* Adjusted Comparison */}
            {hasYnabData && (
              <div className="bg-green-900/20 p-3 rounded-lg mt-3">
                <h4 className="text-xs font-semibold text-green-400 mb-2">Adjusted Comparison</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">App Expenses (txns only)</span>
                    <span className="font-mono text-gray-300">
                      {formatCurrency((app.totalExpenses || 0) - (app.diagnostics.budgetedSavingsAdded || 0))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">vs YNAB Expenses</span>
                    <span className="font-mono text-gray-300">
                      {formatCurrency(ynab.totalExpenses || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-gray-700">
                    <span className="text-gray-400">Gap (App lower)</span>
                    <span className="font-mono text-yellow-400">
                      {formatCurrency((app.totalExpenses - (app.diagnostics?.budgetedSavingsAdded || 0)) - ynab.totalExpenses)}
                    </span>
                  </div>
                  {/* Show skipped transactions comparison */}
                  {app.diagnostics?.skippedTransactions && (() => {
                    const skipped = app.diagnostics.skippedTransactions;
                    const totalSkipped = (skipped.creditCardPayment?.total || 0) +
                                         (skipped.uncategorizedTransfer?.total || 0) +
                                         (skipped.trackingAccount?.total || 0);
                    const expenseGap = (ynab.totalExpenses || 0) - ((app.totalExpenses || 0) - (app.diagnostics?.budgetedSavingsAdded || 0));
                    const unexplainedDiff = expenseGap - totalSkipped;
                    const isExplained = Math.abs(unexplainedDiff) < 5000; // Within $5K is considered explained
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Skipped txns total</span>
                          <span className="font-mono text-orange-400">
                            {formatCurrency(totalSkipped)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Unexplained diff</span>
                          <span className={`font-mono ${isExplained ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(unexplainedDiff)}
                            {isExplained && ' ✓'}
                          </span>
                        </div>
                        {isExplained && (
                          <div className="mt-2 text-gray-500 italic">
                            Gap is explained by skipped CC payments & transfers
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Skipped Transactions Analysis */}
      {app.diagnostics?.skippedTransactions && (
        <SkippedTransactionsSection skipped={app.diagnostics.skippedTransactions} />
      )}

      {/* Income Gap Analysis */}
      {hasYnabData && (
        <IncomeGapAnalysis
          appIncome={app.totalIncome}
          ynabIncome={ynab.totalIncome}
          incomeDiagnostics={app.diagnostics?.incomeDiagnostics}
          skippedIncome={app.diagnostics?.skippedTransactions?.trackingAccountIncome}
          excludedIncome={app.diagnostics?.excludedIncome}
          startingBalanceIncome={app.diagnostics?.skippedTransactions?.startingBalanceIncome}
          reconciliationIncome={app.diagnostics?.skippedTransactions?.reconciliationIncome}
          futureDatedIncome={app.diagnostics?.incomeDiagnostics?.futureDatedIncome}
          transferIncome={app.diagnostics?.incomeDiagnostics?.transferIncome}
          scheduledIncomeDiagnostics={app.diagnostics?.scheduledIncomeDiagnostics}
          scheduledIncomeTotal={app.diagnostics?.scheduledIncomeTotal}
        />
      )}

      {/* Debug Info */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <h3 className="text-xs font-semibold text-gray-500 mb-2">Debug Info</h3>
        <div className="text-xs text-gray-500 space-y-1">
          <div>Transactions processed: {app.transactionCount || 0}</div>
          <div>App month count: {app.monthCount || 0}</div>
          <div>YNAB month count: {ynab.monthCount || 'N/A'}</div>
          <div>App date range: {app.dateRange || 'N/A'}</div>
          {ynab.dateRange && (
            <div>YNAB date range: {ynab.dateRange.start} to {ynab.dateRange.end}</div>
          )}
        </div>
        {/* YNAB Activity Diagnostic */}
        {ynab.sumOfCategoryExpenses !== undefined && (
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            <h4 className="text-xs font-semibold text-gray-500 mb-1">YNAB Activity Breakdown</h4>
            <div className="text-xs text-gray-500 space-y-1">
              <div>month.activity total: {formatCurrency(ynab.totalExpenses)}</div>
              <div>Sum of category activities: {formatCurrency(ynab.sumOfCategoryExpenses)}</div>
              <div className={`${Math.abs(ynab.activityVsCategoryDiff) > 1 ? 'text-yellow-400' : 'text-green-400'}`}>
                Difference: {formatCurrency(ynab.activityVsCategoryDiff)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Skipped Transactions Section - Shows what the app is NOT counting
 */
function SkippedTransactionsSection({ skipped }) {
  const hasSkippedExpenses = skipped.creditCardPayment?.total > 0 ||
                             skipped.uncategorizedTransfer?.total > 0 ||
                             skipped.trackingAccount?.total > 0;
  const hasSkippedIncome = skipped.trackingAccountIncome?.total > 0;

  if (!hasSkippedExpenses && !hasSkippedIncome) return null;

  const totalSkippedExpenses = (skipped.creditCardPayment?.total || 0) +
                               (skipped.uncategorizedTransfer?.total || 0) +
                               (skipped.trackingAccount?.total || 0);

  return (
    <div className="mt-6 pt-4 border-t border-gray-700">
      <h3 className="text-sm font-semibold text-orange-400 mb-3">
        🔍 Skipped Transactions (App doesn't count)
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        These transactions are skipped by the app but may be counted in YNAB's totals.
        {hasSkippedExpenses && (
          <span> Expenses skipped: <span className="font-mono text-orange-400">{formatCurrency(totalSkippedExpenses)}</span></span>
        )}
        {hasSkippedIncome && (
          <span> Income skipped: <span className="font-mono text-blue-400">{formatCurrency(skipped.trackingAccountIncome.total)}</span></span>
        )}
      </p>
      <div className="space-y-3 text-sm">
        {/* Credit Card Payments */}
        {skipped.creditCardPayment?.total > 0 && (
          <div className="bg-orange-900/20 p-3 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Credit Card Payments</span>
              <span className="font-mono text-orange-400">{formatCurrency(skipped.creditCardPayment.total)}</span>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              {skipped.creditCardPayment.count} transfers to credit card accounts (internal moves, not spending)
            </p>
            {skipped.creditCardPayment.samples?.length > 0 && (
              <div className="space-y-1">
                {skipped.creditCardPayment.samples.map((txn, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 truncate">{txn.payee} ({txn.date})</span>
                    <span className="font-mono text-gray-500">{formatCurrency(txn.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Uncategorized Transfers */}
        {skipped.uncategorizedTransfer?.total > 0 && (
          <div className="bg-orange-900/20 p-3 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Uncategorized Transfers</span>
              <span className="font-mono text-orange-400">{formatCurrency(skipped.uncategorizedTransfer.total)}</span>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              {skipped.uncategorizedTransfer.count} transfers without categories (account-to-account moves)
            </p>
            {skipped.uncategorizedTransfer.samples?.length > 0 && (
              <div className="space-y-1">
                {skipped.uncategorizedTransfer.samples.map((txn, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 truncate">{txn.payee} ({txn.date})</span>
                    <span className="font-mono text-gray-500">{formatCurrency(txn.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tracking Account Transactions */}
        {skipped.trackingAccount?.total > 0 && (
          <div className="bg-orange-900/20 p-3 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Tracking Account Txns</span>
              <span className="font-mono text-orange-400">{formatCurrency(skipped.trackingAccount.total)}</span>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              {skipped.trackingAccount.count} transactions in off-budget tracking accounts
            </p>
            {skipped.trackingAccount.samples?.length > 0 && (
              <div className="space-y-1">
                {skipped.trackingAccount.samples.map((txn, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 truncate">{txn.payee} ({txn.date})</span>
                    <span className="font-mono text-gray-500">{formatCurrency(txn.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tracking Account Income (affects income comparison) */}
        {skipped.trackingAccountIncome?.total > 0 && (
          <div className="bg-blue-900/20 p-3 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Tracking Account Income</span>
              <span className="font-mono text-blue-400">{formatCurrency(skipped.trackingAccountIncome.total)}</span>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              {skipped.trackingAccountIncome.count} income transactions in off-budget tracking accounts (may explain income gap)
            </p>
            {skipped.trackingAccountIncome.samples?.length > 0 && (
              <div className="space-y-1">
                {skipped.trackingAccountIncome.samples.map((txn, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 truncate">{txn.payee} ({txn.date})</span>
                    <span className="font-mono text-gray-500">{formatCurrency(txn.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * CSP Bucket comparison summary (app values only for now)
 * YNAB doesn't have bucket concept - buckets are app-side categorization
 */
function BucketSummary({ appBuckets = {} }) {
  const bucketOrder = ['fixedCosts', 'investments', 'savings', 'guiltFree'];
  const bucketLabels = {
    fixedCosts: 'Fixed Costs',
    investments: 'Investments',
    savings: 'Savings',
    guiltFree: 'Guilt-Free',
  };

  return (
    <div className="space-y-2">
      {bucketOrder.map((bucket) => {
        // Handle both number and object formats
        const appTotal = typeof appBuckets[bucket] === 'number'
          ? appBuckets[bucket]
          : (appBuckets[bucket]?.total || 0);

        return (
          <div
            key={bucket}
            className="flex items-center justify-between py-1.5 px-2 rounded text-sm"
          >
            <span className="text-gray-400">{bucketLabels[bucket]}</span>
            <span className="font-mono text-gray-100">
              {formatCurrency(appTotal)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Income Gap Analysis - Shows breakdown of income sources and explains gaps
 */
function IncomeGapAnalysis({ appIncome, ynabIncome, incomeDiagnostics, skippedIncome, excludedIncome, startingBalanceIncome, reconciliationIncome, futureDatedIncome, transferIncome, scheduledIncomeDiagnostics, scheduledIncomeTotal }) {
  const incomeGap = (appIncome || 0) - (ynabIncome || 0);
  const hasGap = Math.abs(incomeGap) > 1; // More than $1 difference

  // Calculate what explains the gap
  const skippedIncomeTotal = skippedIncome?.total || 0;
  const excludedIncomeTotal = excludedIncome || 0;
  const startingBalanceTotal = startingBalanceIncome?.total || 0;
  const reconciliationTotal = reconciliationIncome?.total || 0;
  const futureDatedTotal = futureDatedIncome?.total || 0;
  const transferIncomeTotal = transferIncome?.total || 0;
  const projectedScheduledIncome = scheduledIncomeTotal || 0;

  // Get actual total of positive non-income transactions (refunds, deposits not in income categories)
  // This is the FULL total, not just from samples
  const positiveNonIncomeTotal = incomeDiagnostics?.positiveNonIncomeTotal || 0;

  // Total adjustments that could explain the gap
  const totalSkippedIncome = skippedIncomeTotal + excludedIncomeTotal + startingBalanceTotal + reconciliationTotal;
  const unexplainedGap = incomeGap + totalSkippedIncome; // Add back skipped income to see what's left

  // Gap is explained if:
  // 1. Within $1K tolerance, OR
  // 2. Positive non-income transactions (refunds) are >= 80% of the unexplained gap
  //    (YNAB counts some refunds as income, we don't)
  const gapExplainedByRefunds = positiveNonIncomeTotal >= Math.abs(unexplainedGap) * 0.8;
  const isExplained = Math.abs(unexplainedGap) < 1000 || gapExplainedByRefunds;
  const hasScheduledIncome = projectedScheduledIncome > 0;

  if (!hasGap && !incomeDiagnostics && !hasScheduledIncome) return null;

  return (
    <div className="mt-6 pt-4 border-t border-gray-700">
      <h3 className="text-sm font-semibold text-purple-400 mb-3">
        💰 Income Gap Analysis
      </h3>

      {/* Income Comparison */}
      <div className="bg-blue-900/20 p-3 rounded-lg mb-3">
        <h4 className="text-xs font-semibold text-blue-400 mb-2">
          Income Source Comparison
        </h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">App income (from transactions)</span>
            <span className="font-mono text-gray-300">
              {formatCurrency(appIncome)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">YNAB month.income (budget data)</span>
            <span className="font-mono text-gray-300">
              {formatCurrency(ynabIncome)}
            </span>
          </div>
          <div className={`flex items-center justify-between pt-1 border-t border-gray-700/50 ${hasGap ? 'text-yellow-400' : 'text-green-400'}`}>
            <span>Gap (App - YNAB)</span>
            <span className="font-mono">
              {formatCurrency(incomeGap)}
              {!hasGap && ' ✓'}
            </span>
          </div>
        </div>

        {/* Scheduled Income Info */}
        {hasScheduledIncome && (
          <div className="mt-2 pt-2 border-t border-gray-700/50 text-xs">
            <div className="text-green-400 font-medium mb-1">
              Scheduled Income Included ({scheduledIncomeDiagnostics?.count || 0} occurrences)
            </div>
            <div className="flex items-center justify-between text-green-400">
              <span>Projected from recurring income</span>
              <span className="font-mono">{formatCurrency(projectedScheduledIncome)}</span>
            </div>
            {scheduledIncomeDiagnostics?.samples?.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {scheduledIncomeDiagnostics.samples.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-gray-400">
                    <span className="truncate" title={`${item.payee} (${item.frequency})`}>
                      {item.payee} ({item.occurrences}x)
                    </span>
                    <span className="font-mono text-gray-500">
                      {formatCurrency(item.projectedTotal)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Additional diagnostics */}
        {(futureDatedTotal > 0 || transferIncomeTotal > 0) && (
          <div className="mt-2 pt-2 border-t border-gray-700/50 text-xs">
            <div className="text-gray-500 font-medium mb-1">Additional Income Info:</div>
            {futureDatedTotal > 0 && (
              <div className="flex items-center justify-between text-yellow-400">
                <span>Future-dated income (after today)</span>
                <span className="font-mono">{formatCurrency(futureDatedTotal)}</span>
              </div>
            )}
            {transferIncomeTotal > 0 && (
              <div className="flex items-center justify-between text-blue-400">
                <span>Income from transfers</span>
                <span className="font-mono">{formatCurrency(transferIncomeTotal)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Gap Summary */}
      {hasGap && (
        <div className={`p-3 rounded-lg mb-3 ${isExplained ? 'bg-green-900/20' : 'bg-purple-900/20'}`}>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Income Gap (App - YNAB)</span>
              <span className={`font-mono ${incomeGap < 0 ? 'text-red-400' : 'text-green-400'}`}>
                {formatCurrency(incomeGap)}
              </span>
            </div>
            {startingBalanceTotal > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">+ Starting balance income</span>
                <span className="font-mono text-orange-400">
                  +{formatCurrency(startingBalanceTotal)}
                </span>
              </div>
            )}
            {reconciliationTotal > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">+ Reconciliation income</span>
                <span className="font-mono text-orange-400">
                  +{formatCurrency(reconciliationTotal)}
                </span>
              </div>
            )}
            {skippedIncomeTotal > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">+ Tracking account income</span>
                <span className="font-mono text-blue-400">
                  +{formatCurrency(skippedIncomeTotal)}
                </span>
              </div>
            )}
            {excludedIncomeTotal > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">+ Excluded income (settings)</span>
                <span className="font-mono text-yellow-400">
                  +{formatCurrency(excludedIncomeTotal)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-gray-700">
              <span className="text-gray-400">Unexplained gap</span>
              <span className={`font-mono ${isExplained ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(unexplainedGap)}
                {isExplained && ' ✓'}
              </span>
            </div>
            {isExplained && gapExplainedByRefunds && (
              <div className="text-xs text-green-400 italic">
                ✓ Gap explained by refunds/reimbursements - YNAB counts these as income, we count them in their expense categories
              </div>
            )}
            {isExplained && !gapExplainedByRefunds && !hasScheduledIncome && (
              <div className="text-xs text-gray-500 italic">
                Gap explained by skipped transactions (starting balances, reconciliation, tracking accounts)
              </div>
            )}
            {isExplained && !gapExplainedByRefunds && hasScheduledIncome && (
              <div className="text-xs text-green-400 italic">
                Gap explained - scheduled income from recurring transactions is now included
              </div>
            )}
          </div>
        </div>
      )}

      {/* Income by Category Breakdown */}
      {incomeDiagnostics?.incomeByCategory && Object.keys(incomeDiagnostics.incomeByCategory).length > 0 && (
        <div className="bg-gray-800/50 p-3 rounded-lg">
          <h4 className="text-xs font-semibold text-gray-400 mb-2">
            Income by Category ({incomeDiagnostics.totalIncomeTransactions} transactions)
          </h4>
          <div className="space-y-1 text-xs">
            {Object.entries(incomeDiagnostics.incomeByCategory)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([category, data]) => (
                <div key={category} className="flex items-center justify-between">
                  <span className="text-gray-400 truncate" title={category}>
                    {category} ({data.count})
                  </span>
                  <span className="font-mono text-gray-300">
                    {formatCurrency(data.total)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Positive Non-Income Transactions (potential missed income) */}
      {(incomeDiagnostics?.positiveNonIncomeTotal > 0 || incomeDiagnostics?.positiveNonIncomeTransactions?.length > 0) && (
        <div className="bg-yellow-900/20 p-3 rounded-lg mt-3">
          <h4 className="text-xs font-semibold text-yellow-400 mb-2">
            ⚠️ Positive Txns NOT Counted as Income
          </h4>
          <p className="text-xs text-gray-500 mb-2">
            YNAB's month.income may include some of these refunds/reimbursements that we don't count as income.
          </p>
          {/* Show totals */}
          <div className="flex items-center justify-between text-xs mb-2 p-2 bg-yellow-900/30 rounded">
            <span className="text-yellow-300 font-medium">
              Total: {incomeDiagnostics.positiveNonIncomeCount || 0} transactions
            </span>
            <span className="font-mono text-yellow-400 font-bold">
              {formatCurrency(incomeDiagnostics.positiveNonIncomeTotal || 0)}
            </span>
          </div>
          {/* Check if this explains the gap */}
          {Math.abs(unexplainedGap) > 1 && incomeDiagnostics.positiveNonIncomeTotal > 0 && (
            <div className="text-xs p-2 bg-blue-900/30 rounded mb-2">
              <div className="flex justify-between text-blue-300">
                <span>Unexplained income gap:</span>
                <span className="font-mono">{formatCurrency(Math.abs(unexplainedGap))}</span>
              </div>
              <div className="flex justify-between text-yellow-300">
                <span>Positive non-income txns:</span>
                <span className="font-mono">{formatCurrency(incomeDiagnostics.positiveNonIncomeTotal)}</span>
              </div>
              {incomeDiagnostics.positiveNonIncomeTotal >= Math.abs(unexplainedGap) * 0.8 && (
                <div className="text-green-400 mt-1 text-center">
                  ✓ Likely explains the income gap (refunds counted as income by YNAB)
                </div>
              )}
            </div>
          )}
          {/* Sample transactions */}
          <div className="space-y-1 text-xs">
            {incomeDiagnostics.positiveNonIncomeTransactions?.map((txn, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-gray-400 truncate" title={`${txn.payee} - ${txn.category}`}>
                  {txn.payee} ({txn.category})
                </span>
                <span className="font-mono text-yellow-400">
                  {formatCurrency(txn.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
