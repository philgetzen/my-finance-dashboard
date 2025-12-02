import React, { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useFinanceData, usePrivacy } from '../../contexts/ConsolidatedDataContext';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { getAccountBalance, normalizeYNABAccountType } from '../../utils/ynabHelpers';
import Button from '../ui/Button';
import PageTransition from '../ui/PageTransition';
import AddHoldingModal from '../ui/AddHoldingModal';
import ManageHoldingsModal from '../ui/ManageHoldingsModal';
import PrivacyCurrency from '../ui/PrivacyCurrency';
import {
  BanknotesIcon,
  ChartPieIcon,
  CurrencyDollarIcon,
  PlusIcon,
  FunnelIcon,
  TableCellsIcon,
  PencilSquareIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

const COLORS = ['#3B82F6', '#8B5CF6', '#EF4444', '#10B981', '#F59E0B', '#06B6D4', '#EC4899', '#8B5CF6'];

export default function InvestmentAllocation() {
  const { privacyMode } = usePrivacy();
  const { accounts: ynabAccounts, manualAccounts, user } = useFinanceData();
  const [additionalHoldings, setAdditionalHoldings] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [groupBy, setGroupBy] = useState('account');
  const [showAddHoldingModal, setShowAddHoldingModal] = useState(false);
  const [showManageHoldingsModal, setShowManageHoldingsModal] = useState(false);
  const [selectedAccountForManage, setSelectedAccountForManage] = useState(null);
  const [accountHoldings, setAccountHoldings] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'value', direction: 'desc' });

  // Load saved holdings data on component mount
  useEffect(() => {
    if (user) {
      const savedHoldings = localStorage.getItem(`investment_holdings_${user.uid}`);
      if (savedHoldings) {
        try {
          setAccountHoldings(JSON.parse(savedHoldings));
        } catch (error) {
          console.error('Error loading saved holdings:', error);
        }
      }
    }
  }, [user]);

  // Save holdings data when it changes
  const saveAccountHoldings = (accountId, holdings) => {
    const newHoldings = {
      ...accountHoldings,
      [accountId]: holdings
    };
    setAccountHoldings(newHoldings);

    if (user) {
      localStorage.setItem(`investment_holdings_${user.uid}`, JSON.stringify(newHoldings));
    }
  };

  // Default stock prices for common stocks (can be updated with real-time data)
  const DEFAULT_STOCK_PRICES = {
    DIS: 112.50,  // Disney stock price
    AAPL: 175.20, // Apple stock price
    MSFT: 420.00, // Microsoft
    GOOGL: 140.00, // Google
    AMZN: 170.00, // Amazon
    TSLA: 240.00, // Tesla
    META: 490.00, // Meta
    NVDA: 880.00, // Nvidia
    BRK: 540000.00, // Berkshire Hathaway
    JPM: 190.00, // JP Morgan
  };

  // Helper function to get clean account name
  const getCleanAccountName = (account) => {
    const name = account.name;
    // Remove common suffixes and clean up the name
    const cleanName = name
      .replace(/\s*-\s*\d+$/g, '') // Remove trailing numbers like "- 31810"
      .replace(/\s*\(.*?\)\s*$/g, '') // Remove parentheses content at end
      .trim();

    // Map common account names to cleaner versions
    const accountMappings = {
      'disney stock': 'Disney Stock (Merrill Edge)',
      'apple stock': 'Apple Stock (E*TRADE)',
      'etrade': 'Apple Stock (E*TRADE)',
      'merrill': 'Disney Stock (Merrill Edge)',
      'merrill edge': 'Disney Stock (Merrill Edge)',
      'altruist': 'Altruist',
      'fidelity': 'Fidelity',
    };

    const lowerName = cleanName.toLowerCase();
    for (const [key, value] of Object.entries(accountMappings)) {
      if (lowerName.includes(key)) {
        return value;
      }
    }

    return cleanName;
  };

  // Generate holdings from YNAB investment accounts
  const holdings = useMemo(() => {
    const allAccounts = [...(ynabAccounts || []), ...(manualAccounts || [])];
    const investmentAccounts = allAccounts.filter(acc =>
      normalizeYNABAccountType(acc.type) === 'investment' && !acc.closed_on
    );

    let holdingsList = [];
    let holdingId = 1;

    investmentAccounts.forEach(account => {
      const balance = getAccountBalance(account);
      const accountName = getCleanAccountName(account);
      const savedHoldings = accountHoldings[account.id] || [];

      // Skip accounts with zero balance
      if (balance === 0) return;

      if (savedHoldings.length > 0) {
        // Use saved holdings for this account
        const totalSavedValue = savedHoldings.reduce((sum, h) => sum + (h.shares * h.price), 0);
        const scaleFactor = totalSavedValue > 0 ? balance / totalSavedValue : 1;

        savedHoldings.forEach(holding => {
          const value = holding.shares * holding.price * scaleFactor;
          // Skip holdings with zero value
          if (value === 0) return;

          const stockInfo = getStockInfo(holding.symbol);
          holdingsList.push({
            id: holdingId++,
            symbol: holding.symbol,
            name: stockInfo.name,
            shares: holding.shares,
            price: holding.price,
            value: value, // Scale to match account balance
            type: stockInfo.type,
            sector: stockInfo.sector,
            account: accountName,
            accountId: account.id
          });
        });
      } else {
        // No saved holdings - create a placeholder
        holdingsList.push({
          id: holdingId++,
          symbol: 'PENDING',
          name: 'Holdings not configured',
          shares: 0,
          price: 0,
          value: balance,
          type: 'Unknown',
          sector: 'Unknown',
          account: accountName,
          accountId: account.id,
          needsConfiguration: true
        });
      }
    });

    // Combine with any additional manually added holdings
    return [...holdingsList, ...additionalHoldings].filter(h => h.value > 0);
  }, [ynabAccounts, manualAccounts, additionalHoldings, accountHoldings]);

  // Helper function to get stock information
  const getStockInfo = (symbol) => {
    const stockDatabase = {
      'AAPL': { name: 'Apple Inc.', type: 'Stock', sector: 'Technology' },
      'MSFT': { name: 'Microsoft Corporation', type: 'Stock', sector: 'Technology' },
      'GOOGL': { name: 'Alphabet Inc.', type: 'Stock', sector: 'Technology' },
      'AMZN': { name: 'Amazon.com Inc.', type: 'Stock', sector: 'Consumer Discretionary' },
      'META': { name: 'Meta Platforms Inc.', type: 'Stock', sector: 'Technology' },
      'TSLA': { name: 'Tesla Inc.', type: 'Stock', sector: 'Consumer Discretionary' },
      'NVDA': { name: 'NVIDIA Corporation', type: 'Stock', sector: 'Technology' },
      'BRK.B': { name: 'Berkshire Hathaway Inc.', type: 'Stock', sector: 'Financials' },
      'JPM': { name: 'JPMorgan Chase & Co.', type: 'Stock', sector: 'Financials' },
      'DIS': { name: 'Walt Disney Company', type: 'Stock', sector: 'Communication Services' },
      'V': { name: 'Visa Inc.', type: 'Stock', sector: 'Financials' },
      'MA': { name: 'Mastercard Inc.', type: 'Stock', sector: 'Financials' },
      'SPY': { name: 'SPDR S&P 500 ETF', type: 'ETF', sector: 'Diversified' },
      'VOO': { name: 'Vanguard S&P 500 ETF', type: 'ETF', sector: 'Diversified' },
      'QQQ': { name: 'Invesco QQQ Trust', type: 'ETF', sector: 'Technology' },
      'VTI': { name: 'Vanguard Total Stock Market ETF', type: 'ETF', sector: 'Diversified' },
    };

    return stockDatabase[symbol.toUpperCase()] || {
      name: symbol,
      type: 'Stock',
      sector: 'Other'
    };
  };

  // Handle adding new holdings
  const handleAddHoldings = (newHoldings) => {
    const processedHoldings = newHoldings.map((holding, index) => {
      const value = holding.shares * (holding.price || 100); // Default price if not provided
      return {
        id: Date.now() + index,
        symbol: holding.ticker,
        name: holding.ticker, // Name will be fetched from API later
        shares: holding.shares,
        price: holding.price || 100,
        value: value,
        type: 'Stock', // Default type, can be enhanced later
        sector: 'Unknown',
        account: holding.account || 'Manual Entry'
      };
    });

    setAdditionalHoldings([...additionalHoldings, ...processedHoldings]);
  };

  // Calculate totals and allocations
  const totalValue = useMemo(() => {
    return holdings.reduce((sum, holding) => sum + holding.value, 0);
  }, [holdings]);

  // Filter holdings by selected account
  const filteredHoldings = useMemo(() => {
    if (selectedAccount === 'all') return holdings;
    return holdings.filter(holding => holding.account === selectedAccount);
  }, [selectedAccount, holdings]);

  // Calculate filtered total for accurate percentages
  const filteredTotalValue = useMemo(() => {
    return filteredHoldings.reduce((sum, holding) => sum + holding.value, 0);
  }, [filteredHoldings]);

  // Group holdings by selected criteria
  const groupedData = useMemo(() => {
    // Only include holdings that are properly configured (not Unknown for type/sector grouping)
    const relevantHoldings = filteredHoldings.filter(holding => {
      if (groupBy === 'type' || groupBy === 'sector') {
        return !holding.needsConfiguration && holding[groupBy] !== 'Unknown';
      }
      return true;
    });

    const relevantTotal = relevantHoldings.reduce((sum, h) => sum + h.value, 0);

    const groups = relevantHoldings.reduce((acc, holding) => {
      const key = holding[groupBy] || 'Unknown';
      if (!acc[key]) {
        acc[key] = { name: key, value: 0, holdings: [] };
      }
      acc[key].value += holding.value;
      acc[key].holdings.push(holding);
      return acc;
    }, {});

    return Object.values(groups)
      .map(group => ({
        ...group,
        percentage: relevantTotal > 0 ? (group.value / relevantTotal) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value); // Sort by value descending
  }, [filteredHoldings, groupBy]);

  // Get unique accounts for filter
  const accounts = [...new Set(holdings.map(h => h.account))];


  // Handle sorting
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Sort holdings based on current sort configuration
  const sortedHoldings = useMemo(() => {
    const sorted = [...filteredHoldings];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Handle numeric values
        if (sortConfig.key === 'value' || sortConfig.key === 'shares' || sortConfig.key === 'price') {
          aValue = parseFloat(aValue) || 0;
          bValue = parseFloat(bValue) || 0;
        }

        // Handle string values
        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sorted;
  }, [filteredHoldings, sortConfig]);

  return (
    <PageTransition>
      <div className="w-full max-w-none space-y-6 pb-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Investments
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Track your investment accounts and holdings
            </p>
          </div>
          <Button
            onClick={() => setShowAddHoldingModal(true)}
            variant="primary"
            className="flex items-center gap-2 self-start sm:self-auto"
          >
            <PlusIcon className="h-4 w-4" />
            Add Holding
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Value</p>
                <p className={`text-2xl font-bold tabular-nums text-green-600 dark:text-green-400 ${privacyMode ? 'privacy-blur' : ''}`}>
                  ${formatCurrency(totalValue)}
                </p>
              </div>
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <CurrencyDollarIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Holdings</p>
                <p className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                  {filteredHoldings.filter(h => !h.needsConfiguration).length}
                </p>
              </div>
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <BanknotesIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Accounts</p>
                <p className="text-2xl font-bold tabular-nums text-purple-600 dark:text-purple-400">
                  {accounts.length}
                </p>
              </div>
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <ChartPieIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-4 sm:items-center overflow-hidden">
          <div className="flex items-center gap-2 min-w-0">
            <FunnelIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Accounts</option>
              {accounts.map(account => (
                <option key={account} value={account}>{account}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">Group by:</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="account">Account</option>
              <option value="type">Asset Type</option>
              <option value="sector">Sector</option>
            </select>
          </div>
        </div>

        {/* Allocation Chart */}
        <div className="glass-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Allocation by {groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}
            </h3>
          </div>

          {groupedData.length > 0 ? (
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={groupedData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius="70%"
                    label={false}
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth={2}
                  >
                    {groupedData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      return (
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg">
                          {payload.map((entry, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: entry.fill }}
                              />
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {entry.name}:
                              </span>
                              <span className={`text-sm font-medium text-gray-900 dark:text-white ${privacyMode ? 'privacy-blur' : ''}`}>
                                ${formatCurrency(entry.value)} ({formatPercent(entry.payload.percentage)})
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 sm:h-72 flex items-center justify-center">
              <div className="text-center">
                <ChartPieIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {groupBy === 'type' || groupBy === 'sector'
                    ? 'Configure holdings to see allocation by ' + groupBy
                    : 'No data available'}
                </p>
              </div>
            </div>
          )}

          {/* Legend below chart for mobile readability */}
          {groupedData.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {groupedData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2 text-sm">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-gray-700 dark:text-gray-300 truncate">
                    {entry.name}
                  </span>
                  <span className={`text-gray-500 dark:text-gray-500 ${privacyMode ? 'privacy-blur' : ''}`}>
                    {formatPercent(entry.percentage)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Investment Accounts Configuration */}
        {holdings.some(h => h.needsConfiguration) && (
          <div className="glass-card p-4 sm:p-6 mb-6 border-2 border-amber-500/20 bg-amber-50/50 dark:bg-amber-900/20">
            <div className="flex items-start sm:items-center gap-3 mb-4">
              <div className="w-10 h-10 glass-card-gold rounded-lg flex items-center justify-center glow-gold flex-shrink-0">
                <Cog6ToothIcon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Configure Your Holdings</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  Some investment accounts need holdings configuration to display accurate data
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {holdings
                .filter(h => h.needsConfiguration)
                .map(holding => {
                  const account = [...(ynabAccounts || []), ...(manualAccounts || [])]
                    .find(acc => acc.id === holding.accountId);
                  return (
                    <div key={holding.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{holding.account}</p>
                        <p className={`text-sm text-green-600 dark:text-green-400 ${privacyMode ? 'privacy-blur' : ''}`}>
                          Balance: ${formatCurrency(holding.value)}
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          setSelectedAccountForManage(account);
                          setShowManageHoldingsModal(true);
                        }}
                        variant="primary"
                        size="sm"
                        className="w-full sm:w-auto flex-shrink-0"
                      >
                        Configure Holdings
                      </Button>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* All Holdings Table */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Holdings
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => handleSort('symbol')}
                  >
                    <div className="flex items-center gap-1">
                      Symbol
                      {sortConfig.key === 'symbol' && (
                        <span className="text-gray-400">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Name
                      {sortConfig.key === 'name' && (
                        <span className="text-gray-400">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => handleSort('account')}
                  >
                    <div className="flex items-center gap-1">
                      Account
                      {sortConfig.key === 'account' && (
                        <span className="text-gray-400">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => handleSort('type')}
                  >
                    <div className="flex items-center gap-1">
                      Type
                      {sortConfig.key === 'type' && (
                        <span className="text-gray-400">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => handleSort('shares')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Shares
                      {sortConfig.key === 'shares' && (
                        <span className="text-gray-400">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => handleSort('price')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Price
                      {sortConfig.key === 'price' && (
                        <span className="text-gray-400">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => handleSort('value')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Value
                      {sortConfig.key === 'value' && (
                        <span className="text-gray-400">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">% of Total</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedHoldings
                  .filter(h => !h.needsConfiguration) // Don't show placeholder holdings
                  .map(holding => {
                    const percentage = (holding.value / totalValue) * 100;
                    const account = [...(ynabAccounts || []), ...(manualAccounts || [])]
                      .find(acc => acc.id === holding.accountId);
                    return (
                      <tr key={holding.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {holding.symbol}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                          {holding.name}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                            {holding.account}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                            {holding.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-600 dark:text-gray-400">
                          {holding.shares.toLocaleString()}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right tabular-nums text-gray-600 dark:text-gray-400 ${privacyMode ? 'privacy-blur' : ''}`}>
                          ${holding.price.toFixed(2)}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right tabular-nums font-medium text-green-600 dark:text-green-400 ${privacyMode ? 'privacy-blur' : ''}`}>
                          ${formatCurrency(holding.value)}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right tabular-nums text-gray-600 dark:text-gray-400 ${privacyMode ? 'privacy-blur' : ''}`}>
                          {formatPercent(percentage)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {account && (
                            <button
                              onClick={() => {
                                setSelectedAccountForManage(account);
                                setShowManageHoldingsModal(true);
                              }}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                              title="Manage holdings for this account"
                            >
                              <PencilSquareIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
                <tr>
                  <td colSpan="6" className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white text-right">
                    Total Portfolio Value:
                  </td>
                  <td className={`px-4 py-3 text-sm font-bold tabular-nums text-green-600 dark:text-green-400 text-right ${privacyMode ? 'privacy-blur' : ''}`}>
                    ${formatCurrency(totalValue)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium tabular-nums text-gray-600 dark:text-gray-400 text-right">
                    100%
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Add Holding Modal */}
        <AddHoldingModal
          show={showAddHoldingModal}
          onClose={() => setShowAddHoldingModal(false)}
          onAddHoldings={handleAddHoldings}
        />

        {/* Manage Holdings Modal */}
        {selectedAccountForManage && (
          <ManageHoldingsModal
            show={showManageHoldingsModal}
            onClose={() => {
              setShowManageHoldingsModal(false);
              setSelectedAccountForManage(null);
            }}
            account={selectedAccountForManage}
            existingHoldings={accountHoldings[selectedAccountForManage.id] || []}
            onSaveHoldings={saveAccountHoldings}
          />
        )}
      </div>
    </PageTransition>
  );
}