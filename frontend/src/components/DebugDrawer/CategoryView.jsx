import { useState, useMemo } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { MatchIndicator, formatCurrency, amountsMatch } from './DebugDrawer';

/**
 * Category View - Detailed category-by-category comparison
 * Sorted by largest discrepancy first
 */
export default function CategoryView({ data = {}, isLoading }) {
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [sortBy, setSortBy] = useState('discrepancy'); // 'discrepancy', 'amount', 'name'
  const [showOnlyMismatches, setShowOnlyMismatches] = useState(false);

  const { app = {}, ynab = {} } = data;
  const appCategories = app.categories || {};
  const ynabCategories = ynab.categories || {};

  // Merge and sort categories
  const sortedCategories = useMemo(() => {
    const allCategoryNames = new Set([
      ...Object.keys(appCategories),
      ...Object.keys(ynabCategories),
    ]);

    let categories = Array.from(allCategoryNames).map((name) => {
      const appData = appCategories[name] || { total: 0, count: 0 };
      const ynabData = ynabCategories[name] || {};
      const appTotal = appData.total || 0;
      const ynabTotal = ynabData.total;
      const discrepancy = ynabTotal !== undefined ? Math.abs(appTotal - ynabTotal) : 0;
      const isMatch = ynabTotal === undefined || amountsMatch(appTotal, ynabTotal);

      return {
        name,
        appTotal,
        ynabTotal,
        appCount: appData.count || 0,
        discrepancy,
        isMatch,
        bucket: appData.bucket || 'unknown',
      };
    });

    // Filter if showing only mismatches
    if (showOnlyMismatches) {
      categories = categories.filter((c) => !c.isMatch);
    }

    // Sort
    switch (sortBy) {
      case 'discrepancy':
        categories.sort((a, b) => b.discrepancy - a.discrepancy);
        break;
      case 'amount':
        categories.sort((a, b) => Math.abs(b.appTotal) - Math.abs(a.appTotal));
        break;
      case 'name':
        categories.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return categories;
  }, [appCategories, ynabCategories, sortBy, showOnlyMismatches]);

  const toggleExpanded = (categoryName) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-400">
        <div className="animate-pulse">Loading categories...</div>
      </div>
    );
  }

  if (sortedCategories.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400">
        <p className="mb-2">No category data</p>
        <p className="text-xs">Click Refresh to load comparison data</p>
      </div>
    );
  }

  const mismatchCount = sortedCategories.filter((c) => !c.isMatch).length;
  const totalDiscrepancy = sortedCategories.reduce((sum, c) => sum + c.discrepancy, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="p-3 border-b border-gray-700 bg-gray-800/50 space-y-2">
        {/* Summary Stats */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">
            {mismatchCount} of {sortedCategories.length} categories differ
          </span>
          {totalDiscrepancy > 0.01 && (
            <span className="text-yellow-400">
              Total diff: {formatCurrency(totalDiscrepancy)}
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={showOnlyMismatches}
              onChange={(e) => setShowOnlyMismatches(e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-gray-900"
            />
            <span className="text-gray-400">Only mismatches</span>
          </label>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="discrepancy">Sort by discrepancy</option>
            <option value="amount">Sort by amount</option>
            <option value="name">Sort by name</option>
          </select>
        </div>
      </div>

      {/* Category List */}
      <div className="flex-1 overflow-y-auto">
        {sortedCategories.map((category) => (
          <CategoryRow
            key={category.name}
            category={category}
            isExpanded={expandedCategories.has(category.name)}
            onToggle={() => toggleExpanded(category.name)}
            appCategoryData={appCategories[category.name]}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Individual category row with expandable details
 */
function CategoryRow({ category, isExpanded, onToggle, appCategoryData }) {
  const { name, appTotal, ynabTotal, appCount, discrepancy, isMatch, bucket } = category;
  const diff = ynabTotal !== undefined ? appTotal - ynabTotal : 0;

  return (
    <div className={`border-b border-gray-800 ${!isMatch ? 'bg-yellow-900/10' : ''}`}>
      {/* Main Row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800/50 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDownIcon className="h-3 w-3 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronRightIcon className="h-3 w-3 text-gray-500 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-200 truncate">{name}</span>
            <span className="text-xs text-gray-600">({appCount})</span>
          </div>
          <div className="text-xs text-gray-500">{bucket}</div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <div className="text-sm font-mono text-gray-100">
              {formatCurrency(appTotal)}
            </div>
            {ynabTotal !== undefined && (
              <div className="text-xs font-mono text-gray-500">
                vs {formatCurrency(ynabTotal)}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <MatchIndicator isMatch={isMatch} />
            {!isMatch && (
              <span className={`text-xs ${diff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {diff > 0 ? '+' : ''}{formatCurrency(diff)}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && appCategoryData?.transactions && (
        <div className="px-4 pb-3 pt-1 bg-gray-800/30">
          <div className="text-xs text-gray-500 mb-2">
            Recent transactions in this category:
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {appCategoryData.transactions.slice(0, 10).map((txn, i) => (
              <div
                key={txn.id || i}
                className="flex items-center justify-between text-xs py-1 px-2 bg-gray-900/50 rounded"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-gray-300 truncate">{txn.payee_name}</div>
                  <div className="text-gray-600">{txn.date}</div>
                </div>
                <div className="font-mono text-gray-400">
                  {formatCurrency((txn.amount || 0) / 1000)}
                </div>
              </div>
            ))}
            {appCategoryData.transactions.length > 10 && (
              <div className="text-xs text-gray-600 text-center py-1">
                +{appCategoryData.transactions.length - 10} more transactions
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
