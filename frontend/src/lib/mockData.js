// Mock financial data representing average American household finances
// Based on 2024 financial statistics and realistic spending patterns

export const mockUser = {
  uid: 'demo-user-123',
  email: 'demo@healthywealth.app',
  displayName: 'Demo User',
  isDemoMode: true
};

export const mockAccounts = [
  {
    id: 'demo-checking-001',
    name: 'Main Checking',
    type: 'checking',
    balance: 2800, // $2,800
    institution: 'Chase Bank',
    mask: '1234',
    subtype: 'checking',
    isActive: true,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-06-26T00:00:00Z'
  },
  {
    id: 'demo-savings-001',
    name: 'Emergency Savings',
    type: 'savings',
    balance: 8000, // $8,000
    institution: 'Chase Bank',
    mask: '5678',
    subtype: 'savings',
    isActive: true,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-06-26T00:00:00Z'
  },
  {
    id: 'demo-credit-001',
    name: 'Chase Freedom Credit Card',
    type: 'credit',
    balance: -7321, // -$7,321 debt
    institution: 'Chase Bank',
    mask: '9012',
    subtype: 'credit card',
    isActive: true,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-06-26T00:00:00Z'
  },
  {
    id: 'demo-loan-001',
    name: 'Honda Civic Auto Loan',
    type: 'loan',
    balance: -25000, // -$25,000 debt
    institution: 'Honda Financial',
    mask: '3456',
    subtype: 'auto',
    isActive: true,
    createdAt: '2022-08-15T00:00:00Z',
    updatedAt: '2024-06-26T00:00:00Z'
  },
  {
    id: 'demo-mortgage-001',
    name: 'Home Mortgage',
    type: 'loan',
    balance: -252505, // -$252,505 debt
    institution: 'Wells Fargo Mortgage',
    mask: '7890',
    subtype: 'mortgage',
    isActive: true,
    createdAt: '2021-03-15T00:00:00Z',
    updatedAt: '2024-06-26T00:00:00Z'
  },
  {
    id: 'demo-investment-001',
    name: 'Vanguard 401(k)',
    type: 'investment',
    balance: 45000, // $45,000
    institution: 'Vanguard',
    mask: '2468',
    subtype: '401k',
    isActive: true,
    createdAt: '2020-01-15T00:00:00Z',
    updatedAt: '2024-06-26T00:00:00Z'
  }
];

// Mock manual accounts (user-created)
export const mockManualAccounts = [
  {
    id: 'demo-manual-001',
    userId: 'demo-user-123',
    accountName: 'Cash Wallet',
    accountType: 'cash',
    balance: 150, // $150
    isActive: true,
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-06-26T00:00:00Z'
  },
  {
    id: 'demo-manual-002',
    userId: 'demo-user-123',
    accountName: 'Crypto Portfolio',
    accountType: 'investment',
    balance: 2500, // $2,500
    isActive: true,
    createdAt: '2024-02-15T00:00:00Z',
    updatedAt: '2024-06-26T00:00:00Z'
  }
];

// Merchant names and categories for realistic transactions
const merchants = {
  groceries: ['Whole Foods Market', 'Safeway', 'Target', 'Kroger', 'Trader Joe\'s', 'Costco Wholesale', 'Walmart Supercenter'],
  restaurants: ['Chipotle Mexican Grill', 'Starbucks', 'McDonald\'s', 'Subway', 'Panera Bread', 'Olive Garden', 'Local Pizza Co', 'Thai Garden Restaurant'],
  gas: ['Shell', 'Chevron', 'Exxon Mobil', 'BP', '76', 'Arco', 'Valero'],
  utilities: ['PG&E Electric Bill', 'Comcast Internet', 'Verizon Wireless', 'Water District', 'Waste Management', 'AT&T'],
  entertainment: ['Netflix', 'Spotify Premium', 'AMC Theatres', 'Amazon Prime Video', 'Disney+', 'Hulu', 'Apple Music'],
  shopping: ['Amazon.com', 'Target', 'Best Buy', 'Home Depot', 'Macy\'s', 'REI Co-op', 'Apple Store'],
  transportation: ['Uber', 'Lyft', 'Bay Area Rapid Transit', 'Metro Transit', 'Parking Meter'],
  healthcare: ['Kaiser Permanente', 'CVS Pharmacy', 'Walgreens', 'Dr. Smith Medical', 'Dental Care Plus'],
  insurance: ['State Farm Insurance', 'Geico Auto Insurance', 'Health Insurance Premium'],
  income: ['Acme Corp Payroll', 'Freelance Payment', 'Tax Refund', 'Investment Dividend']
};

// Generate transactions for the last 3 months
const generateTransactions = () => {
  const transactions = [];
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  
  let currentDate = new Date(threeMonthsAgo);
  let transactionId = 1000;

  while (currentDate <= now) {
    // Generate 2-5 transactions per day on average
    const transactionsToday = Math.floor(Math.random() * 4) + 2;
    
    for (let i = 0; i < transactionsToday; i++) {
      const transaction = generateSingleTransaction(currentDate, transactionId++);
      if (transaction) {
        transactions.push(transaction);
      }
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
};

const generateSingleTransaction = (date, id) => {
  // Weight transaction types based on realistic frequency
  const transactionTypes = [
    { category: 'groceries', weight: 15 },
    { category: 'restaurants', weight: 12 },
    { category: 'gas', weight: 8 },
    { category: 'shopping', weight: 10 },
    { category: 'utilities', weight: 3 },
    { category: 'entertainment', weight: 6 },
    { category: 'transportation', weight: 5 },
    { category: 'healthcare', weight: 2 },
    { category: 'insurance', weight: 1 },
    { category: 'income', weight: 3 }
  ];

  // Calculate total weight and select random category
  const totalWeight = transactionTypes.reduce((sum, type) => sum + type.weight, 0);
  let random = Math.random() * totalWeight;
  
  let selectedCategory = 'groceries';
  for (const type of transactionTypes) {
    random -= type.weight;
    if (random <= 0) {
      selectedCategory = type.category;
      break;
    }
  }

  // Generate amount based on category
  const amounts = {
    groceries: { min: 15, max: 150 },
    restaurants: { min: 8, max: 85 },
    gas: { min: 35, max: 75 },
    shopping: { min: 20, max: 300 },
    utilities: { min: 45, max: 200 },
    entertainment: { min: 10, max: 50 },
    transportation: { min: 8, max: 45 },
    healthcare: { min: 25, max: 500 },
    insurance: { min: 150, max: 400 },
    income: { min: 1500, max: 3500 }
  };

  const range = amounts[selectedCategory];
  const amount = Math.floor(Math.random() * (range.max - range.min) + range.min); // Dollar amounts
  
  // Determine account based on transaction type
  let accountId;
  if (selectedCategory === 'income') {
    accountId = 'demo-checking-001'; // Income goes to checking
  } else if (['groceries', 'restaurants', 'shopping', 'entertainment'].includes(selectedCategory)) {
    // Mix of checking and credit card for daily expenses
    accountId = Math.random() > 0.4 ? 'demo-credit-001' : 'demo-checking-001';
  } else if (selectedCategory === 'gas') {
    accountId = 'demo-credit-001'; // Gas usually on credit card
  } else {
    accountId = 'demo-checking-001'; // Utilities, insurance, etc. from checking
  }

  // Select random merchant from category
  const merchantList = merchants[selectedCategory];
  const merchant = merchantList[Math.floor(Math.random() * merchantList.length)];

  // Add time to date
  const transactionDate = new Date(date);
  transactionDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));

  return {
    id: `demo-transaction-${id}`,
    account_id: accountId,
    amount: selectedCategory === 'income' ? amount : -amount, // Income positive, expenses negative
    date: transactionDate.toISOString().split('T')[0],
    datetime: transactionDate.toISOString(),
    name: merchant,
    merchant_name: merchant,
    category: [selectedCategory === 'income' ? 'Payroll' : selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)],
    subcategory: selectedCategory === 'income' ? 'Payroll' : 'General',
    authorized_date: transactionDate.toISOString().split('T')[0],
    pending: Math.random() < 0.05, // 5% chance of pending
    iso_currency_code: 'USD',
    account_owner: null
  };
};

// Generate the transactions
export const mockTransactions = generateTransactions();

// Calculate account summaries
export const mockAccountSummary = {
  totalAssets: mockAccounts
    .filter(acc => ['checking', 'savings', 'investment'].includes(acc.type))
    .reduce((sum, acc) => sum + Math.max(0, acc.balance), 0) +
    mockManualAccounts.reduce((sum, acc) => sum + Math.max(0, acc.balance), 0),
  
  totalLiabilities: mockAccounts
    .filter(acc => ['credit', 'loan'].includes(acc.type))
    .reduce((sum, acc) => sum + Math.abs(Math.min(0, acc.balance)), 0),
  
  netWorth: 0 // Will be calculated
};

// Calculate net worth
mockAccountSummary.netWorth = mockAccountSummary.totalAssets - mockAccountSummary.totalLiabilities;

// YNAB-style mock data
export const mockYNABData = {
  budgets: [
    {
      id: 'demo-budget-001',
      name: 'Demo Family Budget',
      last_modified_on: '2024-06-26T00:00:00Z',
      first_month: '2024-01-01',
      last_month: '2024-12-01',
      date_format: {
        format: 'MM/DD/YYYY'
      },
      currency_format: {
        iso_code: 'USD',
        example_format: '123,456.78',
        decimal_digits: 2,
        decimal_separator: '.',
        symbol_first: true,
        group_separator: ',',
        currency_symbol: '$',
        display_symbol: true
      }
    }
  ],
  categories: [
    { id: 'cat-001', name: 'Groceries', category_group_id: 'group-001', budgeted: 50000, activity: -45000, balance: 5000 },
    { id: 'cat-002', name: 'Restaurants', category_group_id: 'group-001', budgeted: 25000, activity: -28000, balance: -3000 },
    { id: 'cat-003', name: 'Gas', category_group_id: 'group-002', budgeted: 20000, activity: -18000, balance: 2000 },
    { id: 'cat-004', name: 'Entertainment', category_group_id: 'group-003', budgeted: 15000, activity: -12000, balance: 3000 }
  ],
  isConnected: false, // Default to not connected in demo mode
  error: null
};

export default {
  mockUser,
  mockAccounts,
  mockManualAccounts,
  mockTransactions,
  mockAccountSummary,
  mockYNABData
};