// Mock financial data representing average American household finances
// Based on 2024 financial statistics and realistic spending patterns

export const mockUser = {
  uid: 'demo-user-123',
  email: 'demo@healthywealth.app',
  displayName: 'Demo User',
  photoURL: 'https://ui-avatars.com/api/?name=Demo+User&background=6366f1&color=fff&size=128',
  isDemoMode: true
};

// YNAB-formatted mock accounts (balances in milliunits for YNAB compatibility)
export const mockAccounts = [
  {
    id: 'demo-checking-001',
    account_id: 'demo-checking-001',
    name: 'Main Checking',
    type: 'checking',
    balance: 2800000, // $2,800 in milliunits
    institution: 'Chase Bank',
    mask: '1234',
    subtype: 'checking',
    on_budget: true,
    closed: false,
    isActive: true,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-06-26T00:00:00Z'
  },
  {
    id: 'demo-savings-001',
    account_id: 'demo-savings-001',
    name: 'Emergency Savings',
    type: 'savings',
    balance: 8000000, // $8,000 in milliunits
    institution: 'Chase Bank',
    mask: '5678',
    subtype: 'savings',
    on_budget: true,
    closed: false,
    isActive: true,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-06-26T00:00:00Z'
  },
  {
    id: 'demo-credit-001',
    account_id: 'demo-credit-001',
    name: 'Chase Freedom Credit Card',
    type: 'creditCard',
    balance: -7321000, // -$7,321 in milliunits (debt shown as negative)
    institution: 'Chase Bank',
    mask: '9012',
    subtype: 'credit card',
    on_budget: true,
    closed: false,
    isActive: true,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-06-26T00:00:00Z'
  },
  {
    id: 'demo-loan-001',
    account_id: 'demo-loan-001',
    name: 'Honda Civic Auto Loan',
    type: 'otherLiability',
    balance: -25000000, // -$25,000 in milliunits
    institution: 'Honda Financial',
    mask: '3456',
    subtype: 'auto',
    on_budget: false,
    closed: false,
    isActive: true,
    createdAt: '2022-08-15T00:00:00Z',
    updatedAt: '2024-06-26T00:00:00Z'
  },
  {
    id: 'demo-mortgage-001',
    account_id: 'demo-mortgage-001',
    name: 'Home Mortgage',
    type: 'mortgage',
    balance: -252505000, // -$252,505 in milliunits
    institution: 'Wells Fargo Mortgage',
    mask: '7890',
    subtype: 'mortgage',
    on_budget: false,
    closed: false,
    isActive: true,
    createdAt: '2021-03-15T00:00:00Z',
    updatedAt: '2024-06-26T00:00:00Z'
  },
  {
    id: 'demo-investment-001',
    account_id: 'demo-investment-001',
    name: 'Vanguard 401(k)',
    type: 'otherAsset', // YNAB uses otherAsset for investments
    balance: 45000000, // $45,000 in milliunits
    institution: 'Vanguard',
    mask: '2468',
    subtype: '401k',
    on_budget: false,
    closed: false,
    isActive: true,
    createdAt: '2020-01-15T00:00:00Z',
    updatedAt: '2024-06-26T00:00:00Z'
  },
  {
    id: 'demo-investment-002',
    account_id: 'demo-investment-002',
    name: 'Roth IRA',
    type: 'otherAsset', // YNAB uses otherAsset for investments
    balance: 18500000, // $18,500 in milliunits
    institution: 'Fidelity',
    mask: '1357',
    subtype: 'roth',
    on_budget: false,
    closed: false,
    isActive: true,
    createdAt: '2020-01-15T00:00:00Z',
    updatedAt: '2024-06-26T00:00:00Z'
  },
  {
    id: 'demo-home-value-001',
    account_id: 'demo-home-value-001',
    name: 'Home Value (Redfin Estimate)',
    type: 'otherAsset', // YNAB uses otherAsset for property values
    balance: 425000000, // $425,000 in milliunits
    institution: 'Redfin',
    mask: '0000',
    subtype: 'real estate',
    on_budget: false,
    closed: false,
    isActive: true,
    createdAt: '2021-03-15T00:00:00Z',
    updatedAt: '2024-06-26T00:00:00Z'
  }
];

// Mock manual accounts (user-created)
export const mockManualAccounts = [
  {
    id: 'demo-manual-001',
    userId: 'demo-user-123',
    name: 'Cash Wallet',
    type: 'cash',
    balance: 150, // $150
    isActive: true,
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-06-26T00:00:00Z'
  },
  {
    id: 'demo-manual-002',
    userId: 'demo-user-123',
    name: 'Crypto Portfolio',
    type: 'investment',
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
  // Weight transaction types based on realistic frequency with YNAB category mapping
  const transactionTypes = [
    { category: 'groceries', weight: 15, categoryId: 'cat-groceries' },
    { category: 'restaurants', weight: 12, categoryId: 'cat-restaurants' },
    { category: 'gas', weight: 8, categoryId: 'cat-gas' },
    { category: 'shopping', weight: 10, categoryId: 'cat-general-shopping' },
    { category: 'utilities', weight: 3, categoryId: 'cat-electric' },
    { category: 'entertainment', weight: 6, categoryId: 'cat-streaming' },
    { category: 'transportation', weight: 5, categoryId: 'cat-rideshare' },
    { category: 'healthcare', weight: 2, categoryId: 'cat-medical' },
    { category: 'insurance', weight: 1, categoryId: 'cat-auto-insurance' },
    { category: 'income', weight: 3, categoryId: 'cat-salary' }
  ];

  // Calculate total weight and select random category
  const totalWeight = transactionTypes.reduce((sum, type) => sum + type.weight, 0);
  let random = Math.random() * totalWeight;
  
  let selectedType = transactionTypes[0];
  for (const type of transactionTypes) {
    random -= type.weight;
    if (random <= 0) {
      selectedType = type;
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

  const range = amounts[selectedType.category];
  const amount = Math.floor(Math.random() * (range.max - range.min) + range.min); // Dollar amounts
  
  // Determine account based on transaction type
  let accountId;
  if (selectedType.category === 'income') {
    accountId = 'demo-checking-001'; // Income goes to checking
  } else if (['groceries', 'restaurants', 'shopping', 'entertainment'].includes(selectedType.category)) {
    // Mix of checking and credit card for daily expenses
    accountId = Math.random() > 0.4 ? 'demo-credit-001' : 'demo-checking-001';
  } else if (selectedType.category === 'gas') {
    accountId = 'demo-credit-001'; // Gas usually on credit card
  } else {
    accountId = 'demo-checking-001'; // Utilities, insurance, etc. from checking
  }

  // Select random merchant from category
  const merchantList = merchants[selectedType.category];
  const merchant = merchantList[Math.floor(Math.random() * merchantList.length)];

  // Add time to date
  const transactionDate = new Date(date);
  transactionDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));

  // YNAB milliunits (multiply dollar amount by 1000)
  const ynabAmount = (selectedType.category === 'income' ? amount : -amount) * 1000;

  return {
    id: `demo-transaction-${id}`,
    account_id: accountId,
    amount: ynabAmount, // YNAB uses milliunits
    date: transactionDate.toISOString().split('T')[0],
    datetime: transactionDate.toISOString(),
    name: merchant,
    merchant_name: merchant,
    payee_name: merchant, // Essential for YNAB processing
    category_id: selectedType.categoryId, // Map to YNAB category structure
    category_name: selectedType.category.charAt(0).toUpperCase() + selectedType.category.slice(1),
    category: [selectedType.category === 'income' ? 'Payroll' : selectedType.category.charAt(0).toUpperCase() + selectedType.category.slice(1)],
    subcategory: selectedType.category === 'income' ? 'Payroll' : 'General',
    authorized_date: transactionDate.toISOString().split('T')[0],
    pending: Math.random() < 0.05, // 5% chance of pending
    iso_currency_code: 'USD',
    account_owner: null,
    transfer_account_id: null // Not a transfer
  };
};

// Generate the transactions
export const mockTransactions = generateTransactions();

// Calculate account summaries (balances are in milliunits, convert to dollars)
export const mockAccountSummary = {
  totalAssets: mockAccounts
    .filter(acc => ['checking', 'savings', 'otherAsset'].includes(acc.type))
    .reduce((sum, acc) => sum + Math.max(0, acc.balance / 1000), 0) +
    mockManualAccounts.reduce((sum, acc) => sum + Math.max(0, acc.balance), 0),

  totalLiabilities: mockAccounts
    .filter(acc => ['creditCard', 'otherLiability', 'mortgage'].includes(acc.type))
    .reduce((sum, acc) => sum + Math.abs(Math.min(0, acc.balance / 1000)), 0),

  netWorth: 0 // Will be calculated
};

// Calculate net worth
mockAccountSummary.netWorth = mockAccountSummary.totalAssets - mockAccountSummary.totalLiabilities;

// Generate mock months data for the last 12 months
const generateMockMonths = () => {
  const months = [];
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = monthDate.toISOString().slice(0, 10);

    // Vary income and expenses slightly each month
    const baseIncome = 8500000; // $8,500 in milliunits
    const baseExpenses = 6500000; // $6,500 in milliunits
    const variance = 500000; // +/- $500

    const income = baseIncome + Math.floor((Math.random() - 0.5) * variance * 2);
    const budgeted = baseExpenses + Math.floor((Math.random() - 0.5) * variance * 2);
    const activity = -budgeted + Math.floor((Math.random() - 0.5) * variance); // Slight over/under spending

    months.push({
      month: monthStr,
      note: null,
      income: income,
      budgeted: budgeted,
      activity: activity,
      to_be_budgeted: income + activity - budgeted,
      age_of_money: 45 + Math.floor(Math.random() * 20), // 45-65 days
      deleted: false,
      categories: [] // Simplified - categories handled separately
    });
  }

  return months;
};

export const mockMonths = generateMockMonths();

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
  accounts: mockAccounts,
  transactions: mockTransactions,
  categories: {
    category_groups: [
      {
        id: 'group-income',
        name: 'Income Sources',
        categories: [
          { id: 'cat-salary', name: 'Salary', budgeted: 0, balance: 0, activity: 0 },
          { id: 'cat-freelance', name: 'Freelance', budgeted: 0, balance: 0, activity: 0 },
          { id: 'cat-investment', name: 'Investment Income', budgeted: 0, balance: 0, activity: 0 },
          { id: 'cat-other-income', name: 'Other Income', budgeted: 0, balance: 0, activity: 0 }
        ]
      },
      {
        id: 'group-food',
        name: 'Food & Dining',
        categories: [
          { id: 'cat-groceries', name: 'Groceries', budgeted: 600000, balance: 150000, activity: -450000 }, // $600 budgeted, $150 left
          { id: 'cat-restaurants', name: 'Restaurants', budgeted: 300000, balance: 75000, activity: -225000 } // $300 budgeted, $75 left
        ]
      },
      {
        id: 'group-transportation',
        name: 'Transportation',
        categories: [
          { id: 'cat-gas', name: 'Gas & Fuel', budgeted: 200000, balance: 50000, activity: -150000 },
          { id: 'cat-parking', name: 'Parking', budgeted: 50000, balance: 20000, activity: -30000 },
          { id: 'cat-rideshare', name: 'Rideshare', budgeted: 100000, balance: 40000, activity: -60000 },
          { id: 'cat-transit', name: 'Public Transit', budgeted: 120000, balance: 60000, activity: -60000 }
        ]
      },
      {
        id: 'group-entertainment',
        name: 'Entertainment',
        categories: [
          { id: 'cat-streaming', name: 'Streaming Services', budgeted: 50000, balance: 10000, activity: -40000 },
          { id: 'cat-movies', name: 'Movies & Theater', budgeted: 75000, balance: 25000, activity: -50000 },
          { id: 'cat-music', name: 'Music', budgeted: 20000, balance: 5000, activity: -15000 }
        ]
      },
      {
        id: 'group-utilities',
        name: 'Bills & Utilities',
        categories: [
          { id: 'cat-electric', name: 'Electricity', budgeted: 150000, balance: 0, activity: -150000 },
          { id: 'cat-internet', name: 'Internet', budgeted: 80000, balance: 0, activity: -80000 },
          { id: 'cat-phone', name: 'Phone', budgeted: 100000, balance: 0, activity: -100000 },
          { id: 'cat-water', name: 'Water', budgeted: 60000, balance: 0, activity: -60000 },
          { id: 'cat-waste', name: 'Waste Management', budgeted: 40000, balance: 0, activity: -40000 }
        ]
      },
      {
        id: 'group-shopping',
        name: 'Shopping',
        categories: [
          { id: 'cat-general-shopping', name: 'General Shopping', budgeted: 200000, balance: 80000, activity: -120000 },
          { id: 'cat-electronics', name: 'Electronics', budgeted: 100000, balance: 50000, activity: -50000 },
          { id: 'cat-home-improvement', name: 'Home Improvement', budgeted: 150000, balance: 100000, activity: -50000 },
          { id: 'cat-clothing', name: 'Clothing', budgeted: 100000, balance: 40000, activity: -60000 }
        ]
      },
      {
        id: 'group-healthcare',
        name: 'Healthcare',
        categories: [
          { id: 'cat-medical', name: 'Medical', budgeted: 200000, balance: 150000, activity: -50000 },
          { id: 'cat-pharmacy', name: 'Pharmacy', budgeted: 50000, balance: 20000, activity: -30000 },
          { id: 'cat-dental', name: 'Dental', budgeted: 100000, balance: 80000, activity: -20000 }
        ]
      },
      {
        id: 'group-insurance',
        name: 'Insurance',
        categories: [
          { id: 'cat-auto-insurance', name: 'Auto Insurance', budgeted: 150000, balance: 0, activity: -150000 },
          { id: 'cat-health-insurance', name: 'Health Insurance', budgeted: 400000, balance: 0, activity: -400000 },
          { id: 'cat-home-insurance', name: 'Home Insurance', budgeted: 125000, balance: 0, activity: -125000 }
        ]
      },
      {
        id: 'group-savings',
        name: 'Savings Goals',
        categories: [
          // Savings categories have Available balance (what's accumulated) - this is what CSP uses
          { id: 'cat-emergency-fund', name: 'Emergency Fund', budgeted: 500000, balance: 12000000, activity: 0 }, // $500/mo, $12,000 saved
          { id: 'cat-vacation', name: 'Vacation Fund', budgeted: 300000, balance: 2500000, activity: 0 }, // $300/mo, $2,500 saved
          { id: 'cat-house-fund', name: 'House Down Payment', budgeted: 1000000, balance: 25000000, activity: 0 }, // $1,000/mo, $25,000 saved
          { id: 'cat-car-fund', name: 'New Car Fund', budgeted: 200000, balance: 3500000, activity: 0 } // $200/mo, $3,500 saved
        ]
      },
      {
        id: 'group-investments',
        name: 'Investments',
        categories: [
          { id: 'cat-401k', name: '401(k) Contribution', budgeted: 750000, balance: 0, activity: -750000 },
          { id: 'cat-roth-ira', name: 'Roth IRA', budgeted: 500000, balance: 0, activity: -500000 },
          { id: 'cat-brokerage', name: 'Brokerage Account', budgeted: 300000, balance: 0, activity: -300000 }
        ]
      },
      {
        id: 'group-true-expenses',
        name: 'True Expenses',
        categories: [
          { id: 'cat-car-maintenance', name: 'Car Maintenance', budgeted: 100000, balance: 450000, activity: 0 }, // Saving up for repairs
          { id: 'cat-home-maintenance', name: 'Home Maintenance', budgeted: 200000, balance: 800000, activity: 0 },
          { id: 'cat-gifts', name: 'Gifts', budgeted: 100000, balance: 200000, activity: -50000 },
          { id: 'cat-annual-fees', name: 'Annual Subscriptions', budgeted: 50000, balance: 150000, activity: 0 }
        ]
      }
    ]
  },
  months: mockMonths,
  summary: null,
  isLoading: false,
  isError: false,
  error: null,
  refetch: () => console.log('Demo mode: refetch disabled'),
  isConnected: false // Default to not connected in demo mode
};

export default {
  mockUser,
  mockAccounts,
  mockManualAccounts,
  mockTransactions,
  mockAccountSummary,
  mockMonths,
  mockYNABData
};