import React, { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { useYNAB, usePrivacy } from '../../contexts/YNABDataContext';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { getAccountBalance, normalizeYNABAccountType } from '../../utils/ynabHelpers';
import Button from '../ui/Button';
import PageTransition from '../ui/PageTransition';
import AddHoldingModal from '../ui/AddHoldingModal';
import ManageHoldingsModal from '../ui/ManageHoldingsModal';
import {
  BanknotesIcon,
  ChartPieIcon,
  ArrowTrendingUpIcon, 
  CalendarIcon,
  CurrencyDollarIcon,
  PlusIcon,
  FunnelIcon,
  ArrowPathIcon,
  TableCellsIcon,
  Squares2X2Icon,
  PencilSquareIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

const COLORS = ['#3B82F6', '#8B5CF6', '#EF4444', '#10B981', '#F59E0B', '#06B6D4', '#EC4899', '#8B5CF6'];

const mockPerformanceData = [
  { month: 'Jun', portfolio: 38500, benchmark: 37800 },
  { month: 'Jul', portfolio: 39200, benchmark: 38400 },
  { month: 'Aug', portfolio: 38800, benchmark: 38100 },
  { month: 'Sep', portfolio: 40100, benchmark: 39200 },
  { month: 'Oct', portfolio: 41200, benchmark: 40100 },
  { month: 'Nov', portfolio: 41800, benchmark: 40600 },
  { month: 'Dec', portfolio: 40900, benchmark: 39800 },
  { month: 'Jan', portfolio: 42100, benchmark: 41000 },
  { month: 'Feb', portfolio: 41700, benchmark: 40700 },
  { month: 'Mar', portfolio: 43200, benchmark: 41800 },
  { month: 'Apr', portfolio: 42800, benchmark: 41500 },
  { month: 'May', portfolio: 43586, benchmark: 42100 },
];

// Risk analysis data
const riskMetrics = [
  { metric: 'Volatility', value: 65, fullMark: 100 },
  { metric: 'Diversification', value: 85, fullMark: 100 },
  { metric: 'Growth Potential', value: 78, fullMark: 100 },
  { metric: 'Stability', value: 72, fullMark: 100 },
  { metric: 'Liquidity', value: 90, fullMark: 100 },
  { metric: 'Tax Efficiency', value: 68, fullMark: 100 },
];

export default function InvestmentAllocation() {
  const { privacyMode } = usePrivacy();
  const { accounts: ynabAccounts, manualAccounts, user } = useYNAB();
  const [additionalHoldings, setAdditionalHoldings] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('1Y');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [groupBy, setGroupBy] = useState('type');
  const [showAddHoldingModal, setShowAddHoldingModal] = useState(false);
  const [showManageHoldingsModal, setShowManageHoldingsModal] = useState(false);
  const [selectedAccountForManage, setSelectedAccountForManage] = useState(null);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'
  const [accountHoldings, setAccountHoldings] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  
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

  // Group holdings by selected criteria
  const groupedData = useMemo(() => {
    const groups = filteredHoldings.reduce((acc, holding) => {
      const key = holding[groupBy];
      if (!acc[key]) {
        acc[key] = { name: key, value: 0, holdings: [] };
      }
      acc[key].value += holding.value;
      acc[key].holdings.push(holding);
      return acc;
    }, {});

    return Object.values(groups).map(group => ({
      ...group,
      percentage: (group.value / totalValue) * 100
    }));
  }, [filteredHoldings, groupBy, totalValue]);

  // Get unique accounts for filter
  const accounts = [...new Set(holdings.map(h => h.account))];

  // Calculate performance metrics
  const currentValue = mockPerformanceData[mockPerformanceData.length - 1].portfolio;
  const previousValue = mockPerformanceData[0].portfolio;
  const totalReturn = ((currentValue - previousValue) / previousValue) * 100;
  const benchmarkReturn = ((mockPerformanceData[mockPerformanceData.length - 1].benchmark - mockPerformanceData[0].benchmark) / mockPerformanceData[0].benchmark) * 100;
  
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

  const HoldingCard = ({ holding }) => (
    <div className="glass-chart p-4 rounded-lg hover:scale-[1.02] transition-all duration-200">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="flex items-start gap-2">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{holding.symbol}</h4>
            <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
              {holding.account}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{holding.name}</p>
        </div>
        <div className="text-right ml-2">
          <p className={`font-semibold text-sm text-green-600 dark:text-green-400 ${privacyMode ? 'privacy-blur' : ''}`}>
            ${formatCurrency(holding.value)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {holding.shares} shares
          </p>
        </div>
      </div>
      <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
        <span>{holding.type} • {holding.sector}</span>
        <span className={privacyMode ? 'privacy-blur' : ''}>
          ${holding.price.toFixed(2)}
        </span>
      </div>
    </div>
  );

  return (
    <PageTransition>
      <div className="w-full max-w-none space-y-6 pb-4">
        {/* Header */}
        <div className="glass-hero p-6 rounded-2xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 glass-card-purple rounded-xl flex items-center justify-center glow-purple">
              <BanknotesIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                Investment Portfolio
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1">
                Track and analyze your investment allocation
              </p>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-3 flex-wrap">
            <Button 
              onClick={() => setShowAddHoldingModal(true)}
              variant="primary"
              className="flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              Add Holding
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowPathIcon className="h-4 w-4" />
              Refresh Prices
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Value</p>
                <p className={`text-2xl font-bold text-green-600 dark:text-green-400 ${privacyMode ? 'privacy-blur' : ''}`}>
                  ${formatCurrency(totalValue)}
                </p>
              </div>
              <div className="w-12 h-12 glass-card-green rounded-xl flex items-center justify-center glow-emerald">
                <CurrencyDollarIcon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Return</p>
                <p className={`text-2xl font-bold ${totalReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} ${privacyMode ? 'privacy-blur' : ''}`}>
                  {totalReturn >= 0 ? '+' : ''}{formatPercent(totalReturn)}
                </p>
              </div>
              <div className={`w-12 h-12 ${totalReturn >= 0 ? 'glass-card-green' : 'glass-card-red'} rounded-xl flex items-center justify-center ${totalReturn >= 0 ? 'glow-emerald' : ''}`}>
                <ArrowTrendingUpIcon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">vs Benchmark</p>
                <p className={`text-2xl font-bold ${(totalReturn - benchmarkReturn) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} ${privacyMode ? 'privacy-blur' : ''}`}>
                  {(totalReturn - benchmarkReturn) >= 0 ? '+' : ''}{formatPercent(totalReturn - benchmarkReturn)}
                </p>
              </div>
              <div className="w-12 h-12 glass-card-blue rounded-xl flex items-center justify-center glow-blue">
                <ChartPieIcon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Holdings</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {filteredHoldings.length}
                </p>
              </div>
              <div className="w-12 h-12 glass-card-gold rounded-xl flex items-center justify-center glow-gold">
                <BanknotesIcon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="glass-card p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <select 
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="1D">1 Day</option>
                <option value="1W">1 Week</option>  
                <option value="1M">1 Month</option>
                <option value="3M">3 Months</option>
                <option value="6M">6 Months</option>
                <option value="1Y">1 Year</option>
                <option value="ALL">All Time</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <select 
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="px-3 py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Accounts</option>
                {accounts.map(account => (
                  <option key={account} value={account}>{account}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Group by:</span>
              <select 
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="px-3 py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="type">Asset Type</option>
                <option value="sector">Sector</option>
                <option value="account">Account</option>
              </select>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Allocation Chart */}
          <div className="glass-card p-6">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 glass-card-purple rounded-lg flex items-center justify-center glow-purple mr-3">
                <ChartPieIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Allocation by {groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Portfolio breakdown</p>
              </div>
            </div>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={groupedData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius="75%"
                    label={({ name, percentage }) => `${name}: ${formatPercent(percentage)}`}
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth={2}
                  >
                    {groupedData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name) => {
                      if (privacyMode) return ['***', name];
                      return [`${formatCurrency(value)}`, name];
                    }}
                    contentStyle={{
                      borderRadius: '12px',
                    }}
                    wrapperClassName="chart-tooltip glass-tooltip"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Performance Chart */}
          <div className="glass-card p-6">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 glass-card-emerald rounded-lg flex items-center justify-center glow-emerald mr-3">
                <ArrowTrendingUpIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Performance</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Portfolio vs benchmark</p>
              </div>
            </div>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mockPerformanceData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value, name) => {
                      if (privacyMode) return ['***', name];
                      return [`${formatCurrency(value)}`, name];
                    }}
                    contentStyle={{
                      borderRadius: '12px',
                    }}
                    wrapperClassName="chart-tooltip glass-tooltip"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="portfolio" 
                    stroke="#10B981" 
                    strokeWidth={3}
                    name="Portfolio"
                    dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="benchmark" 
                    stroke="#6B7280" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Benchmark"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Risk Analysis */}
        <div className="glass-card p-6">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 glass-card-gold rounded-lg flex items-center justify-center glow-gold mr-3">
              <ChartPieIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Risk Analysis</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Portfolio risk metrics</p>
            </div>
          </div>
          
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={riskMetrics}>
                <PolarGrid className="opacity-30" />
                <PolarAngleAxis 
                  dataKey="metric" 
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                />
                <PolarRadiusAxis 
                  angle={90} 
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: 'currentColor' }}
                />
                <Radar
                  name="Portfolio"
                  dataKey="value"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Tooltip
                  formatter={(value) => [`${value}/100`, 'Score']}
                  contentStyle={{
                    borderRadius: '12px',
                  }}
                  wrapperClassName="chart-tooltip glass-tooltip"
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Investment Accounts Configuration */}
        {holdings.some(h => h.needsConfiguration) && (
          <div className="glass-card p-6 mb-6 border-2 border-amber-500/20 bg-amber-50/50 dark:bg-amber-900/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 glass-card-gold rounded-lg flex items-center justify-center glow-gold">
                <Cog6ToothIcon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Configure Your Holdings</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
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
                    <div key={holding.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{holding.account}</p>
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
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 glass-card-purple rounded-lg flex items-center justify-center glow-purple mr-3">
              <TableCellsIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">All Holdings</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Complete portfolio breakdown by account</p>
            </div>
          </div>
          
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
                        <td className={`px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400`}>
                          {holding.shares}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400 ${privacyMode ? 'privacy-blur' : ''}`}>
                          ${holding.price.toFixed(2)}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-medium text-green-600 dark:text-green-400 ${privacyMode ? 'privacy-blur' : ''}`}>
                          ${formatCurrency(holding.value)}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400 ${privacyMode ? 'privacy-blur' : ''}`}>
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
                  <td className={`px-4 py-3 text-sm font-bold text-green-600 dark:text-green-400 text-right ${privacyMode ? 'privacy-blur' : ''}`}>
                    ${formatCurrency(totalValue)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 text-right">
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