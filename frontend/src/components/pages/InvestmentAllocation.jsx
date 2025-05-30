import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { useYNAB, usePrivacy } from '../../contexts/YNABDataContext';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import Button from '../ui/Button';
import PageTransition from '../ui/PageTransition';
import {
  BanknotesIcon,
  ChartPieIcon,
  ArrowTrendingUpIcon, 
  CalendarIcon,
  CurrencyDollarIcon,
  PlusIcon,
  FunnelIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

const COLORS = ['#3B82F6', '#8B5CF6', '#EF4444', '#10B981', '#F59E0B', '#06B6D4', '#EC4899', '#8B5CF6'];

// Mock investment data - you can replace this with real data from your investment provider
const mockHoldings = [
  { id: 1, symbol: 'VTSAX', name: 'Vanguard Total Stock Market', shares: 150.5, price: 102.45, value: 15418.73, type: 'Stock', sector: 'Diversified', account: 'Vanguard 401k' },
  { id: 2, symbol: 'VTIAX', name: 'Vanguard Total International Stock', shares: 85.2, price: 35.80, value: 3050.16, type: 'Stock', sector: 'International', account: 'Vanguard 401k' },
  { id: 3, symbol: 'VBTLX', name: 'Vanguard Total Bond Market', shares: 120.8, price: 10.15, value: 1226.12, type: 'Bond', sector: 'Fixed Income', account: 'Vanguard 401k' },
  { id: 4, symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', shares: 45.0, price: 245.30, value: 11038.50, type: 'ETF', sector: 'Diversified', account: 'Fidelity IRA' },
  { id: 5, symbol: 'VXUS', name: 'Vanguard Total International Stock ETF', shares: 30.0, price: 58.90, value: 1767.00, type: 'ETF', sector: 'International', account: 'Fidelity IRA' },
  { id: 6, symbol: 'BND', name: 'Vanguard Total Bond Market ETF', shares: 25.0, price: 78.45, value: 1961.25, type: 'ETF', sector: 'Fixed Income', account: 'Fidelity IRA' },
  { id: 7, symbol: 'AAPL', name: 'Apple Inc.', shares: 12.0, price: 175.20, value: 2102.40, type: 'Stock', sector: 'Technology', account: 'Taxable Account' },
  { id: 8, symbol: 'MSFT', name: 'Microsoft Corporation', shares: 8.0, price: 378.50, value: 3028.00, type: 'Stock', sector: 'Technology', account: 'Taxable Account' },
  { id: 9, symbol: 'GOOGL', name: 'Alphabet Inc.', shares: 5.0, price: 142.80, value: 714.00, type: 'Stock', sector: 'Technology', account: 'Taxable Account' },
  { id: 10, symbol: 'REIT', name: 'Real Estate Investment Trust', shares: 50.0, price: 45.60, value: 2280.00, type: 'REIT', sector: 'Real Estate', account: 'Taxable Account' },
];

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
  const { isPrivacyMode } = usePrivacy();
  const [selectedPeriod, setSelectedPeriod] = useState('1Y');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [groupBy, setGroupBy] = useState('type');
  const [showAddHoldingModal, setShowAddHoldingModal] = useState(false);

  // Calculate totals and allocations
  const totalValue = useMemo(() => {
    return mockHoldings.reduce((sum, holding) => sum + holding.value, 0);
  }, []);

  // Filter holdings by selected account
  const filteredHoldings = useMemo(() => {
    if (selectedAccount === 'all') return mockHoldings;
    return mockHoldings.filter(holding => holding.account === selectedAccount);
  }, [selectedAccount]);

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
  const accounts = [...new Set(mockHoldings.map(h => h.account))];

  // Calculate performance metrics
  const currentValue = mockPerformanceData[mockPerformanceData.length - 1].portfolio;
  const previousValue = mockPerformanceData[0].portfolio;
  const totalReturn = ((currentValue - previousValue) / previousValue) * 100;
  const benchmarkReturn = ((mockPerformanceData[mockPerformanceData.length - 1].benchmark - mockPerformanceData[0].benchmark) / mockPerformanceData[0].benchmark) * 100;

  const HoldingCard = ({ holding }) => (
    <div className="glass-chart p-4 rounded-lg hover:scale-[1.02] transition-all duration-200">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{holding.symbol}</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{holding.name}</p>
        </div>
        <div className="text-right ml-2">
          <p className={`font-semibold text-sm text-green-600 dark:text-green-400 ${isPrivacyMode ? 'privacy-blur' : ''}`}>
            ${formatCurrency(holding.value)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {holding.shares} shares
          </p>
        </div>
      </div>
      <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
        <span>{holding.type} • {holding.sector}</span>
        <span className={isPrivacyMode ? 'privacy-blur' : ''}>
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
          <div className="flex gap-3 overflow-x-auto pb-2">
            <Button 
              onClick={() => setShowAddHoldingModal(true)}
              className="glass-card-emerald px-4 py-2 min-w-max rounded-lg flex items-center gap-2 text-sm font-medium text-white"
            >
              <PlusIcon className="h-4 w-4" />
              Add Holding
            </Button>
            <Button className="glass-button px-4 py-2 min-w-max rounded-lg flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
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
                <p className={`text-2xl font-bold text-green-600 dark:text-green-400 ${isPrivacyMode ? 'privacy-blur' : ''}`}>
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
                <p className={`text-2xl font-bold ${totalReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} ${isPrivacyMode ? 'privacy-blur' : ''}`}>
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
                <p className={`text-2xl font-bold ${(totalReturn - benchmarkReturn) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} ${isPrivacyMode ? 'privacy-blur' : ''}`}>
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
                className="glass-input px-3 py-1 text-sm rounded-lg text-gray-900 dark:text-white"
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
                className="glass-input px-3 py-1 text-sm rounded-lg text-gray-900 dark:text-white"
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
                className="glass-input px-3 py-1 text-sm rounded-lg text-gray-900 dark:text-white"
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
                      if (isPrivacyMode) return ['***', name];
                      return [`$${formatCurrency(value)}`, name];
                    }}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                    }}
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
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value, name) => {
                      if (isPrivacyMode) return ['***', name];
                      return [`$${formatCurrency(value)}`, name];
                    }}
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

        {/* Risk Analysis & Holdings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value) => [`${value}/100`, 'Score']}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Holdings */}
          <div className="glass-card p-6">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 glass-card-blue rounded-lg flex items-center justify-center glow-blue mr-3">
                <BanknotesIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Holdings</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Largest positions</p>
              </div>
            </div>
            
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {filteredHoldings
                .sort((a, b) => b.value - a.value)
                .slice(0, 8)
                .map(holding => (
                  <HoldingCard key={holding.id} holding={holding} />
                ))}
            </div>
          </div>
        </div>

        {/* Add Holding Modal */}
        {showAddHoldingModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-card p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Add New Investment
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Investment entry form would go here.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowAddHoldingModal(false)}
                  className="glass-button px-4 py-2 text-sm rounded-lg text-gray-600 dark:text-gray-400"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => setShowAddHoldingModal(false)}
                  className="glass-card-emerald px-4 py-2 text-sm rounded-lg text-white"
                >
                  Add Investment
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}