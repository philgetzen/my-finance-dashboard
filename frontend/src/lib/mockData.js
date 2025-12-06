// Comprehensive Mock Financial Data for Demo Mode
// Represents a realistic American household with ~$95k income
// All amounts follow YNAB conventions (milliunits = dollars * 1000)

// =============================================================================
// MOCK USER
// =============================================================================
export const mockUser = {
  uid: 'demo-user-123',
  email: 'demo@healthywealth.app',
  displayName: 'Demo User',
  photoURL: 'https://ui-avatars.com/api/?name=Demo+User&background=6366f1&color=fff&size=128',
  isDemoMode: true
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================
const toMilliunits = (dollars) => Math.round(dollars * 1000);
const randomVariance = (base, variance) => base + (Math.random() - 0.5) * 2 * variance;

// Generate a date string for N months ago
const getMonthDate = (monthsAgo) => {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);
  date.setDate(1);
  return date.toISOString().slice(0, 10);
};

// Generate a random date within a specific month
const getRandomDateInMonth = (monthsAgo, dayRange = { min: 1, max: 28 }) => {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);
  date.setDate(Math.floor(Math.random() * (dayRange.max - dayRange.min + 1)) + dayRange.min);
  return date.toISOString().slice(0, 10);
};

// =============================================================================
// MOCK ACCOUNTS (YNAB Format)
// All balances in milliunits
// =============================================================================
export const mockAccounts = [
  // On-Budget Accounts (daily spending)
  {
    id: 'acc-checking-main',
    account_id: 'acc-checking-main',
    name: 'Chase Checking',
    type: 'checking',
    balance: toMilliunits(3250.47),
    cleared_balance: toMilliunits(3250.47),
    uncleared_balance: 0,
    on_budget: true,
    closed: false,
    deleted: false,
    note: 'Primary checking account for bills and daily spending',
    transfer_payee_id: 'payee-transfer-checking'
  },
  {
    id: 'acc-savings-emergency',
    account_id: 'acc-savings-emergency',
    name: 'Ally Savings',
    type: 'savings',
    balance: toMilliunits(12500.00),
    cleared_balance: toMilliunits(12500.00),
    uncleared_balance: 0,
    on_budget: true,
    closed: false,
    deleted: false,
    note: 'Emergency fund and short-term savings',
    transfer_payee_id: 'payee-transfer-savings'
  },
  {
    id: 'acc-credit-chase',
    account_id: 'acc-credit-chase',
    name: 'Chase Sapphire Preferred',
    type: 'creditCard',
    balance: toMilliunits(-2847.23),
    cleared_balance: toMilliunits(-2647.23),
    uncleared_balance: toMilliunits(-200.00),
    on_budget: true,
    closed: false,
    deleted: false,
    note: 'Primary rewards card - pay in full monthly',
    transfer_payee_id: 'payee-transfer-chase-cc'
  },
  {
    id: 'acc-credit-amazon',
    account_id: 'acc-credit-amazon',
    name: 'Amazon Prime Visa',
    type: 'creditCard',
    balance: toMilliunits(-523.18),
    cleared_balance: toMilliunits(-523.18),
    uncleared_balance: 0,
    on_budget: true,
    closed: false,
    deleted: false,
    note: 'Amazon purchases and 5% back',
    transfer_payee_id: 'payee-transfer-amazon-cc'
  },

  // Tracking Accounts (off-budget)
  {
    id: 'acc-mortgage',
    account_id: 'acc-mortgage',
    name: 'Wells Fargo Mortgage',
    type: 'mortgage',
    balance: toMilliunits(-287500.00),
    cleared_balance: toMilliunits(-287500.00),
    uncleared_balance: 0,
    on_budget: false,
    closed: false,
    deleted: false,
    note: '30-year fixed @ 3.25%',
    transfer_payee_id: 'payee-transfer-mortgage'
  },
  {
    id: 'acc-auto-loan',
    account_id: 'acc-auto-loan',
    name: 'Toyota Financial Auto Loan',
    type: 'otherLiability',
    balance: toMilliunits(-18750.00),
    cleared_balance: toMilliunits(-18750.00),
    uncleared_balance: 0,
    on_budget: false,
    closed: false,
    deleted: false,
    note: '2022 RAV4 - 60 months @ 2.9%',
    transfer_payee_id: 'payee-transfer-auto'
  },
  {
    id: 'acc-401k',
    account_id: 'acc-401k',
    name: 'Fidelity 401(k)',
    type: 'otherAsset',
    balance: toMilliunits(78500.00),
    cleared_balance: toMilliunits(78500.00),
    uncleared_balance: 0,
    on_budget: false,
    closed: false,
    deleted: false,
    note: 'Employer 401k with 6% match',
    transfer_payee_id: 'payee-transfer-401k'
  },
  {
    id: 'acc-roth-ira',
    account_id: 'acc-roth-ira',
    name: 'Vanguard Roth IRA',
    type: 'otherAsset',
    balance: toMilliunits(32000.00),
    cleared_balance: toMilliunits(32000.00),
    uncleared_balance: 0,
    on_budget: false,
    closed: false,
    deleted: false,
    note: 'Personal Roth IRA - VTSAX',
    transfer_payee_id: 'payee-transfer-roth'
  },
  {
    id: 'acc-brokerage',
    account_id: 'acc-brokerage',
    name: 'Fidelity Brokerage',
    type: 'otherAsset',
    balance: toMilliunits(15200.00),
    cleared_balance: toMilliunits(15200.00),
    uncleared_balance: 0,
    on_budget: false,
    closed: false,
    deleted: false,
    note: 'Taxable brokerage - index funds',
    transfer_payee_id: 'payee-transfer-brokerage'
  },
  {
    id: 'acc-home-value',
    account_id: 'acc-home-value',
    name: 'Home Value (Zillow Estimate)',
    type: 'otherAsset',
    balance: toMilliunits(425000.00),
    cleared_balance: toMilliunits(425000.00),
    uncleared_balance: 0,
    on_budget: false,
    closed: false,
    deleted: false,
    note: 'Updated quarterly from Zillow',
    transfer_payee_id: 'payee-transfer-home'
  }
];

// =============================================================================
// MANUAL ACCOUNTS (User-created)
// =============================================================================
export const mockManualAccounts = [
  {
    id: 'manual-cash',
    userId: 'demo-user-123',
    name: 'Cash on Hand',
    type: 'cash',
    balance: 175.00,
    institution: 'Cash',
    isActive: true,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'manual-hsa',
    userId: 'demo-user-123',
    name: 'HSA Account',
    type: 'investment',
    balance: 4850.00,
    institution: 'HealthEquity',
    isActive: true,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: new Date().toISOString()
  }
];

// =============================================================================
// CATEGORY GROUPS AND CATEGORIES (YNAB Format)
// All amounts in milliunits
// =============================================================================
const categoryGroups = [
  {
    id: 'group-inflow',
    name: 'Inflow: Ready to Assign',
    hidden: false,
    deleted: false,
    categories: [
      {
        id: 'cat-ready-to-assign',
        category_group_id: 'group-inflow',
        name: 'Ready to Assign',
        hidden: false,
        budgeted: 0,
        activity: toMilliunits(7850), // Monthly net income after taxes
        balance: 0,
        goal_type: null
      }
    ]
  },
  {
    id: 'group-fixed-costs',
    name: 'Fixed Costs',
    hidden: false,
    deleted: false,
    categories: [
      {
        id: 'cat-mortgage',
        category_group_id: 'group-fixed-costs',
        name: 'Mortgage Payment',
        hidden: false,
        budgeted: toMilliunits(2150),
        activity: toMilliunits(-2150),
        balance: 0,
        goal_type: 'NEED'
      },
      {
        id: 'cat-electric',
        category_group_id: 'group-fixed-costs',
        name: 'Electric',
        hidden: false,
        budgeted: toMilliunits(145),
        activity: toMilliunits(-142.37),
        balance: toMilliunits(2.63),
        goal_type: 'NEED'
      },
      {
        id: 'cat-gas-utility',
        category_group_id: 'group-fixed-costs',
        name: 'Gas (Utility)',
        hidden: false,
        budgeted: toMilliunits(65),
        activity: toMilliunits(-58.22),
        balance: toMilliunits(6.78),
        goal_type: 'NEED'
      },
      {
        id: 'cat-water',
        category_group_id: 'group-fixed-costs',
        name: 'Water & Sewer',
        hidden: false,
        budgeted: toMilliunits(75),
        activity: toMilliunits(-72.45),
        balance: toMilliunits(2.55),
        goal_type: 'NEED'
      },
      {
        id: 'cat-internet',
        category_group_id: 'group-fixed-costs',
        name: 'Internet',
        hidden: false,
        budgeted: toMilliunits(79.99),
        activity: toMilliunits(-79.99),
        balance: 0,
        goal_type: 'NEED'
      },
      {
        id: 'cat-cell-phone',
        category_group_id: 'group-fixed-costs',
        name: 'Cell Phone',
        hidden: false,
        budgeted: toMilliunits(120),
        activity: toMilliunits(-120),
        balance: 0,
        goal_type: 'NEED'
      },
      {
        id: 'cat-auto-insurance',
        category_group_id: 'group-fixed-costs',
        name: 'Auto Insurance',
        hidden: false,
        budgeted: toMilliunits(165),
        activity: toMilliunits(-165),
        balance: 0,
        goal_type: 'NEED'
      },
      {
        id: 'cat-home-insurance',
        category_group_id: 'group-fixed-costs',
        name: 'Home Insurance',
        hidden: false,
        budgeted: toMilliunits(125),
        activity: 0,
        balance: toMilliunits(375), // Saving for annual payment
        goal_type: 'TB'
      },
      {
        id: 'cat-car-payment',
        category_group_id: 'group-fixed-costs',
        name: 'Car Payment',
        hidden: false,
        budgeted: toMilliunits(425),
        activity: toMilliunits(-425),
        balance: 0,
        goal_type: 'NEED'
      },
      {
        id: 'cat-health-insurance',
        category_group_id: 'group-fixed-costs',
        name: 'Health Insurance',
        hidden: false,
        budgeted: toMilliunits(385),
        activity: toMilliunits(-385),
        balance: 0,
        goal_type: 'NEED'
      }
    ]
  },
  {
    id: 'group-transportation',
    name: 'Transportation',
    hidden: false,
    deleted: false,
    categories: [
      {
        id: 'cat-gas-fuel',
        category_group_id: 'group-transportation',
        name: 'Gas & Fuel',
        hidden: false,
        budgeted: toMilliunits(180),
        activity: toMilliunits(-156.42),
        balance: toMilliunits(23.58),
        goal_type: 'NEED'
      },
      {
        id: 'cat-car-maintenance',
        category_group_id: 'group-transportation',
        name: 'Car Maintenance',
        hidden: false,
        budgeted: toMilliunits(100),
        activity: 0,
        balance: toMilliunits(450), // Saving up for service
        goal_type: 'TB'
      },
      {
        id: 'cat-parking',
        category_group_id: 'group-transportation',
        name: 'Parking',
        hidden: false,
        budgeted: toMilliunits(50),
        activity: toMilliunits(-35),
        balance: toMilliunits(15),
        goal_type: null
      }
    ]
  },
  {
    id: 'group-food',
    name: 'Food & Dining',
    hidden: false,
    deleted: false,
    categories: [
      {
        id: 'cat-groceries',
        category_group_id: 'group-food',
        name: 'Groceries',
        hidden: false,
        budgeted: toMilliunits(650),
        activity: toMilliunits(-587.23),
        balance: toMilliunits(62.77),
        goal_type: 'NEED'
      },
      {
        id: 'cat-restaurants',
        category_group_id: 'group-food',
        name: 'Restaurants',
        hidden: false,
        budgeted: toMilliunits(200),
        activity: toMilliunits(-178.45),
        balance: toMilliunits(21.55),
        goal_type: null
      },
      {
        id: 'cat-coffee-shops',
        category_group_id: 'group-food',
        name: 'Coffee Shops',
        hidden: false,
        budgeted: toMilliunits(60),
        activity: toMilliunits(-52.80),
        balance: toMilliunits(7.20),
        goal_type: null
      }
    ]
  },
  {
    id: 'group-entertainment',
    name: 'Entertainment',
    hidden: false,
    deleted: false,
    categories: [
      {
        id: 'cat-streaming',
        category_group_id: 'group-entertainment',
        name: 'Streaming Services',
        hidden: false,
        budgeted: toMilliunits(55),
        activity: toMilliunits(-52.97),
        balance: toMilliunits(2.03),
        goal_type: null
      },
      {
        id: 'cat-hobbies',
        category_group_id: 'group-entertainment',
        name: 'Hobbies',
        hidden: false,
        budgeted: toMilliunits(100),
        activity: toMilliunits(-78.50),
        balance: toMilliunits(21.50),
        goal_type: null
      },
      {
        id: 'cat-books-media',
        category_group_id: 'group-entertainment',
        name: 'Books & Media',
        hidden: false,
        budgeted: toMilliunits(30),
        activity: toMilliunits(-24.99),
        balance: toMilliunits(5.01),
        goal_type: null
      }
    ]
  },
  {
    id: 'group-shopping',
    name: 'Shopping',
    hidden: false,
    deleted: false,
    categories: [
      {
        id: 'cat-clothing',
        category_group_id: 'group-shopping',
        name: 'Clothing',
        hidden: false,
        budgeted: toMilliunits(100),
        activity: toMilliunits(-67.45),
        balance: toMilliunits(32.55),
        goal_type: null
      },
      {
        id: 'cat-household',
        category_group_id: 'group-shopping',
        name: 'Household Items',
        hidden: false,
        budgeted: toMilliunits(75),
        activity: toMilliunits(-58.32),
        balance: toMilliunits(16.68),
        goal_type: null
      },
      {
        id: 'cat-electronics',
        category_group_id: 'group-shopping',
        name: 'Electronics',
        hidden: false,
        budgeted: toMilliunits(50),
        activity: 0,
        balance: toMilliunits(150), // Saving for upgrade
        goal_type: 'TB'
      }
    ]
  },
  {
    id: 'group-healthcare',
    name: 'Healthcare',
    hidden: false,
    deleted: false,
    categories: [
      {
        id: 'cat-medical',
        category_group_id: 'group-healthcare',
        name: 'Medical',
        hidden: false,
        budgeted: toMilliunits(100),
        activity: toMilliunits(-45),
        balance: toMilliunits(155),
        goal_type: 'TB'
      },
      {
        id: 'cat-pharmacy',
        category_group_id: 'group-healthcare',
        name: 'Pharmacy',
        hidden: false,
        budgeted: toMilliunits(40),
        activity: toMilliunits(-32.50),
        balance: toMilliunits(7.50),
        goal_type: null
      },
      {
        id: 'cat-dental',
        category_group_id: 'group-healthcare',
        name: 'Dental',
        hidden: false,
        budgeted: toMilliunits(50),
        activity: 0,
        balance: toMilliunits(200), // Saving for cleaning
        goal_type: 'TB'
      }
    ]
  },
  {
    id: 'group-personal',
    name: 'Personal Care',
    hidden: false,
    deleted: false,
    categories: [
      {
        id: 'cat-haircut',
        category_group_id: 'group-personal',
        name: 'Haircut',
        hidden: false,
        budgeted: toMilliunits(35),
        activity: toMilliunits(-30),
        balance: toMilliunits(40),
        goal_type: null
      },
      {
        id: 'cat-gym',
        category_group_id: 'group-personal',
        name: 'Gym Membership',
        hidden: false,
        budgeted: toMilliunits(50),
        activity: toMilliunits(-49.99),
        balance: toMilliunits(0.01),
        goal_type: 'NEED'
      }
    ]
  },
  {
    id: 'group-gifts',
    name: 'Gifts & Giving',
    hidden: false,
    deleted: false,
    categories: [
      {
        id: 'cat-gifts',
        category_group_id: 'group-gifts',
        name: 'Gifts',
        hidden: false,
        budgeted: toMilliunits(75),
        activity: toMilliunits(-45),
        balance: toMilliunits(180),
        goal_type: 'TB'
      },
      {
        id: 'cat-charity',
        category_group_id: 'group-gifts',
        name: 'Charitable Giving',
        hidden: false,
        budgeted: toMilliunits(100),
        activity: toMilliunits(-100),
        balance: 0,
        goal_type: 'NEED'
      }
    ]
  },
  {
    id: 'group-savings',
    name: 'Savings Goals',
    hidden: false,
    deleted: false,
    categories: [
      {
        id: 'cat-emergency-fund',
        category_group_id: 'group-savings',
        name: 'Emergency Fund',
        hidden: false,
        budgeted: toMilliunits(400),
        activity: 0,
        balance: toMilliunits(12500), // 3 months expenses saved
        goal_type: 'TBD',
        goal_target: toMilliunits(25000)
      },
      {
        id: 'cat-vacation',
        category_group_id: 'group-savings',
        name: 'Vacation Fund',
        hidden: false,
        budgeted: toMilliunits(200),
        activity: 0,
        balance: toMilliunits(1850),
        goal_type: 'TBD',
        goal_target: toMilliunits(5000)
      },
      {
        id: 'cat-house-projects',
        category_group_id: 'group-savings',
        name: 'Home Projects',
        hidden: false,
        budgeted: toMilliunits(150),
        activity: 0,
        balance: toMilliunits(2200),
        goal_type: 'TB'
      },
      {
        id: 'cat-new-car',
        category_group_id: 'group-savings',
        name: 'Next Car Fund',
        hidden: false,
        budgeted: toMilliunits(100),
        activity: 0,
        balance: toMilliunits(3500),
        goal_type: 'TBD',
        goal_target: toMilliunits(15000)
      }
    ]
  },
  {
    id: 'group-investments',
    name: 'Investments',
    hidden: false,
    deleted: false,
    categories: [
      {
        id: 'cat-401k-contribution',
        category_group_id: 'group-investments',
        name: '401(k) Contribution',
        hidden: false,
        budgeted: toMilliunits(792), // 10% of gross
        activity: toMilliunits(-792),
        balance: 0,
        goal_type: 'NEED'
      },
      {
        id: 'cat-roth-ira',
        category_group_id: 'group-investments',
        name: 'Roth IRA',
        hidden: false,
        budgeted: toMilliunits(583), // Max contribution / 12
        activity: toMilliunits(-583),
        balance: 0,
        goal_type: 'TBD',
        goal_target: toMilliunits(7000)
      },
      {
        id: 'cat-brokerage',
        category_group_id: 'group-investments',
        name: 'Brokerage',
        hidden: false,
        budgeted: toMilliunits(200),
        activity: toMilliunits(-200),
        balance: 0,
        goal_type: null
      }
    ]
  },
  {
    id: 'group-true-expenses',
    name: 'True Expenses',
    hidden: false,
    deleted: false,
    categories: [
      {
        id: 'cat-home-maintenance',
        category_group_id: 'group-true-expenses',
        name: 'Home Maintenance',
        hidden: false,
        budgeted: toMilliunits(200),
        activity: 0,
        balance: toMilliunits(850),
        goal_type: 'TB'
      },
      {
        id: 'cat-annual-subscriptions',
        category_group_id: 'group-true-expenses',
        name: 'Annual Subscriptions',
        hidden: false,
        budgeted: toMilliunits(50),
        activity: 0,
        balance: toMilliunits(275),
        goal_type: 'TB'
      },
      {
        id: 'cat-car-registration',
        category_group_id: 'group-true-expenses',
        name: 'Car Registration',
        hidden: false,
        budgeted: toMilliunits(25),
        activity: 0,
        balance: toMilliunits(150),
        goal_type: 'TB'
      },
      {
        id: 'cat-christmas',
        category_group_id: 'group-true-expenses',
        name: 'Christmas',
        hidden: false,
        budgeted: toMilliunits(100),
        activity: 0,
        balance: toMilliunits(450),
        goal_type: 'TBD',
        goal_target: toMilliunits(1000)
      }
    ]
  }
];

// Flatten categories for easy lookup
export const mockCategories = {
  category_groups: categoryGroups
};

// =============================================================================
// BUILD CATEGORY LOOKUP MAP
// =============================================================================
const buildCategoryMap = () => {
  const map = new Map();
  categoryGroups.forEach(group => {
    group.categories.forEach(cat => {
      map.set(cat.id, {
        categoryName: cat.name,
        groupName: group.name,
        budgeted: cat.budgeted,
        activity: cat.activity,
        balance: cat.balance
      });
    });
  });
  return map;
};

// =============================================================================
// TRANSACTION GENERATION
// Generate 12 months of realistic transaction history
// =============================================================================

// Payee definitions with realistic names
const payees = {
  income: [
    { name: 'ACME Corp Payroll', frequency: 'biweekly', amount: 3925, variance: 0 },
    { name: 'Freelance Project Payment', frequency: 'occasional', amount: 500, variance: 200 }
  ],
  mortgage: [
    { name: 'Wells Fargo Mortgage', amount: 2150, variance: 0 }
  ],
  utilities: [
    { name: 'Pacific Gas & Electric', categoryId: 'cat-electric', amount: 142, variance: 30 },
    { name: 'SoCalGas', categoryId: 'cat-gas-utility', amount: 58, variance: 25 },
    { name: 'Water District', categoryId: 'cat-water', amount: 72, variance: 10 },
    { name: 'Comcast Xfinity', categoryId: 'cat-internet', amount: 79.99, variance: 0 },
    { name: 'T-Mobile', categoryId: 'cat-cell-phone', amount: 120, variance: 5 }
  ],
  insurance: [
    { name: 'State Farm Insurance', categoryId: 'cat-auto-insurance', amount: 165, variance: 0 },
    { name: 'Kaiser Permanente', categoryId: 'cat-health-insurance', amount: 385, variance: 0 }
  ],
  groceries: [
    { name: 'Whole Foods Market', variance: 0.3 },
    { name: 'Trader Joe\'s', variance: 0.3 },
    { name: 'Costco Wholesale', variance: 0.4 },
    { name: 'Safeway', variance: 0.25 },
    { name: 'Target', variance: 0.2 }
  ],
  restaurants: [
    { name: 'Chipotle Mexican Grill', avgAmount: 16, variance: 4 },
    { name: 'Panera Bread', avgAmount: 14, variance: 3 },
    { name: 'Local Sushi Restaurant', avgAmount: 35, variance: 15 },
    { name: 'Five Guys Burgers', avgAmount: 18, variance: 5 },
    { name: 'Thai House', avgAmount: 28, variance: 8 }
  ],
  coffee: [
    { name: 'Starbucks', avgAmount: 6.50, variance: 2 },
    { name: 'Peet\'s Coffee', avgAmount: 5.75, variance: 1.5 }
  ],
  gas: [
    { name: 'Shell Oil', avgAmount: 52, variance: 15 },
    { name: 'Chevron', avgAmount: 48, variance: 12 },
    { name: 'Costco Gas', avgAmount: 65, variance: 20 }
  ],
  streaming: [
    { name: 'Netflix', amount: 15.99 },
    { name: 'Spotify Premium', amount: 10.99 },
    { name: 'Disney+', amount: 13.99 },
    { name: 'YouTube Premium', amount: 12 }
  ],
  shopping: [
    { name: 'Amazon.com', categoryId: 'cat-household', avgAmount: 45, variance: 30 },
    { name: 'Target', categoryId: 'cat-household', avgAmount: 55, variance: 25 },
    { name: 'Old Navy', categoryId: 'cat-clothing', avgAmount: 65, variance: 35 },
    { name: 'Nordstrom Rack', categoryId: 'cat-clothing', avgAmount: 85, variance: 40 }
  ],
  healthcare: [
    { name: 'CVS Pharmacy', categoryId: 'cat-pharmacy', avgAmount: 25, variance: 15 },
    { name: 'Walgreens', categoryId: 'cat-pharmacy', avgAmount: 20, variance: 12 },
    { name: 'Dr. Smith Office', categoryId: 'cat-medical', avgAmount: 45, variance: 0 }
  ],
  fitness: [
    { name: '24 Hour Fitness', categoryId: 'cat-gym', amount: 49.99 }
  ],
  subscriptions: [
    { name: 'Apple iCloud', amount: 2.99 },
    { name: 'Amazon Prime', amount: 14.99 },
    { name: 'Adobe Creative Cloud', amount: 54.99, frequency: 'annual' }
  ]
};

// Generate transactions for a specific month
const generateMonthlyTransactions = (monthsAgo, transactionIdStart) => {
  const transactions = [];
  let txnId = transactionIdStart;

  // Helper to create transaction
  const createTransaction = (date, payeeName, amount, categoryId, accountId = 'acc-checking-main') => {
    const txn = {
      id: `txn-${txnId++}`,
      date: date,
      amount: toMilliunits(amount), // Negative for expenses, positive for income
      payee_id: `payee-${payeeName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      payee_name: payeeName,
      category_id: categoryId,
      category_name: buildCategoryMap().get(categoryId)?.categoryName || null,
      approved: true,
      cleared: 'cleared',
      deleted: false,
      account_id: accountId,
      transfer_account_id: null,
      import_id: null,
      subtransactions: []
    };
    return txn;
  };

  // === INCOME (1st and 15th of each month) ===
  // First paycheck
  transactions.push(createTransaction(
    getRandomDateInMonth(monthsAgo, { min: 1, max: 1 }),
    'ACME Corp Payroll',
    3925,
    'cat-ready-to-assign'
  ));
  // Second paycheck
  transactions.push(createTransaction(
    getRandomDateInMonth(monthsAgo, { min: 15, max: 15 }),
    'ACME Corp Payroll',
    3925,
    'cat-ready-to-assign'
  ));
  // Occasional freelance (30% chance per month)
  if (Math.random() < 0.3) {
    transactions.push(createTransaction(
      getRandomDateInMonth(monthsAgo, { min: 10, max: 25 }),
      'Freelance Payment',
      randomVariance(500, 200),
      'cat-ready-to-assign'
    ));
  }

  // === FIXED COSTS (monthly, usually beginning of month) ===
  // Mortgage
  transactions.push(createTransaction(
    getRandomDateInMonth(monthsAgo, { min: 1, max: 3 }),
    'Wells Fargo Mortgage',
    -2150,
    'cat-mortgage'
  ));

  // Utilities
  payees.utilities.forEach(utility => {
    transactions.push(createTransaction(
      getRandomDateInMonth(monthsAgo, { min: 5, max: 15 }),
      utility.name,
      -(utility.amount + (Math.random() - 0.5) * 2 * utility.variance),
      utility.categoryId
    ));
  });

  // Insurance
  payees.insurance.forEach(insurance => {
    transactions.push(createTransaction(
      getRandomDateInMonth(monthsAgo, { min: 1, max: 5 }),
      insurance.name,
      -insurance.amount,
      insurance.categoryId
    ));
  });

  // Car payment
  transactions.push(createTransaction(
    getRandomDateInMonth(monthsAgo, { min: 5, max: 5 }),
    'Toyota Financial Services',
    -425,
    'cat-car-payment'
  ));

  // === VARIABLE EXPENSES ===

  // Groceries (4-6 trips per month, mix of stores)
  const groceryTrips = Math.floor(Math.random() * 3) + 4;
  for (let i = 0; i < groceryTrips; i++) {
    const store = payees.groceries[Math.floor(Math.random() * payees.groceries.length)];
    const baseAmount = store.name.includes('Costco') ? 180 : 95;
    const amount = randomVariance(baseAmount, baseAmount * store.variance);
    transactions.push(createTransaction(
      getRandomDateInMonth(monthsAgo, { min: 1, max: 28 }),
      store.name,
      -amount,
      'cat-groceries',
      Math.random() > 0.6 ? 'acc-credit-chase' : 'acc-checking-main'
    ));
  }

  // Restaurants (3-5 times per month)
  const restaurantTrips = Math.floor(Math.random() * 3) + 3;
  for (let i = 0; i < restaurantTrips; i++) {
    const restaurant = payees.restaurants[Math.floor(Math.random() * payees.restaurants.length)];
    transactions.push(createTransaction(
      getRandomDateInMonth(monthsAgo, { min: 1, max: 28 }),
      restaurant.name,
      -randomVariance(restaurant.avgAmount, restaurant.variance),
      'cat-restaurants',
      'acc-credit-chase'
    ));
  }

  // Coffee (8-12 times per month)
  const coffeeTrips = Math.floor(Math.random() * 5) + 8;
  for (let i = 0; i < coffeeTrips; i++) {
    const coffee = payees.coffee[Math.floor(Math.random() * payees.coffee.length)];
    transactions.push(createTransaction(
      getRandomDateInMonth(monthsAgo, { min: 1, max: 28 }),
      coffee.name,
      -randomVariance(coffee.avgAmount, coffee.variance),
      'cat-coffee-shops',
      'acc-credit-chase'
    ));
  }

  // Gas (2-4 fillups per month)
  const gasTrips = Math.floor(Math.random() * 3) + 2;
  for (let i = 0; i < gasTrips; i++) {
    const gasStation = payees.gas[Math.floor(Math.random() * payees.gas.length)];
    transactions.push(createTransaction(
      getRandomDateInMonth(monthsAgo, { min: 1, max: 28 }),
      gasStation.name,
      -randomVariance(gasStation.avgAmount, gasStation.variance),
      'cat-gas-fuel',
      'acc-credit-chase'
    ));
  }

  // Streaming services (monthly)
  payees.streaming.forEach(service => {
    transactions.push(createTransaction(
      getRandomDateInMonth(monthsAgo, { min: 1, max: 10 }),
      service.name,
      -service.amount,
      'cat-streaming',
      'acc-credit-chase'
    ));
  });

  // Shopping (2-4 purchases per month)
  const shoppingTrips = Math.floor(Math.random() * 3) + 2;
  for (let i = 0; i < shoppingTrips; i++) {
    const shop = payees.shopping[Math.floor(Math.random() * payees.shopping.length)];
    transactions.push(createTransaction(
      getRandomDateInMonth(monthsAgo, { min: 1, max: 28 }),
      shop.name,
      -randomVariance(shop.avgAmount, shop.variance),
      shop.categoryId,
      shop.name.includes('Amazon') ? 'acc-credit-amazon' : 'acc-credit-chase'
    ));
  }

  // Healthcare (occasional)
  if (Math.random() < 0.4) {
    const healthcare = payees.healthcare[Math.floor(Math.random() * payees.healthcare.length)];
    transactions.push(createTransaction(
      getRandomDateInMonth(monthsAgo, { min: 1, max: 28 }),
      healthcare.name,
      -randomVariance(healthcare.avgAmount, healthcare.variance),
      healthcare.categoryId
    ));
  }

  // Gym membership
  transactions.push(createTransaction(
    getRandomDateInMonth(monthsAgo, { min: 1, max: 5 }),
    '24 Hour Fitness',
    -49.99,
    'cat-gym'
  ));

  // Charitable giving
  transactions.push(createTransaction(
    getRandomDateInMonth(monthsAgo, { min: 25, max: 28 }),
    'American Red Cross',
    -100,
    'cat-charity'
  ));

  // === INVESTMENTS (transfers - categorized but to tracking accounts) ===
  transactions.push(createTransaction(
    getRandomDateInMonth(monthsAgo, { min: 1, max: 3 }),
    '401(k) Contribution',
    -792,
    'cat-401k-contribution'
  ));

  transactions.push(createTransaction(
    getRandomDateInMonth(monthsAgo, { min: 5, max: 10 }),
    'Vanguard Roth IRA',
    -583,
    'cat-roth-ira'
  ));

  if (Math.random() > 0.3) {
    transactions.push(createTransaction(
      getRandomDateInMonth(monthsAgo, { min: 15, max: 20 }),
      'Fidelity Brokerage',
      -200,
      'cat-brokerage'
    ));
  }

  // Occasional hobbies
  if (Math.random() < 0.6) {
    transactions.push(createTransaction(
      getRandomDateInMonth(monthsAgo, { min: 1, max: 28 }),
      'REI Co-op',
      -randomVariance(65, 35),
      'cat-hobbies',
      'acc-credit-chase'
    ));
  }

  // Books occasionally
  if (Math.random() < 0.4) {
    transactions.push(createTransaction(
      getRandomDateInMonth(monthsAgo, { min: 1, max: 28 }),
      'Amazon Kindle',
      -randomVariance(15, 10),
      'cat-books-media',
      'acc-credit-amazon'
    ));
  }

  // Gifts (more frequent near holidays)
  if (Math.random() < 0.3) {
    transactions.push(createTransaction(
      getRandomDateInMonth(monthsAgo, { min: 1, max: 28 }),
      'Amazon.com Gift',
      -randomVariance(45, 25),
      'cat-gifts',
      'acc-credit-amazon'
    ));
  }

  // Haircut (every 6-8 weeks)
  if (Math.random() < 0.2) {
    transactions.push(createTransaction(
      getRandomDateInMonth(monthsAgo, { min: 1, max: 28 }),
      'Great Clips',
      -30,
      'cat-haircut'
    ));
  }

  // Parking occasionally
  if (Math.random() < 0.5) {
    transactions.push(createTransaction(
      getRandomDateInMonth(monthsAgo, { min: 1, max: 28 }),
      'City Parking',
      -randomVariance(8, 4),
      'cat-parking'
    ));
  }

  return transactions;
};

// Generate all transactions for 12 months
const generateAllTransactions = () => {
  let allTransactions = [];
  let txnIdCounter = 1000;

  for (let monthsAgo = 11; monthsAgo >= 0; monthsAgo--) {
    const monthTxns = generateMonthlyTransactions(monthsAgo, txnIdCounter);
    txnIdCounter += monthTxns.length + 10; // Gap for safety
    allTransactions = allTransactions.concat(monthTxns);
  }

  // Sort by date descending (most recent first)
  return allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
};

export const mockTransactions = generateAllTransactions();

// =============================================================================
// MONTHLY BUDGET DATA (YNAB Months format)
// =============================================================================
const generateMockMonths = () => {
  const months = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = monthDate.toISOString().slice(0, 10);

    // Calculate monthly totals (approximate based on our budget)
    const baseIncome = toMilliunits(7850);
    const baseBudgeted = toMilliunits(6500);
    const variance = toMilliunits(300);

    const income = baseIncome + Math.floor((Math.random() - 0.5) * variance);
    const budgeted = baseBudgeted + Math.floor((Math.random() - 0.3) * variance);
    const activity = -budgeted + Math.floor((Math.random() - 0.5) * toMilliunits(200));

    months.push({
      month: monthStr,
      note: null,
      income: income,
      budgeted: budgeted,
      activity: activity,
      to_be_budgeted: income + activity,
      age_of_money: 35 + Math.floor(Math.random() * 25),
      deleted: false,
      categories: categoryGroups.flatMap(group =>
        group.categories.map(cat => ({
          id: cat.id,
          category_group_id: cat.category_group_id,
          name: cat.name,
          budgeted: cat.budgeted + Math.floor((Math.random() - 0.5) * toMilliunits(20)),
          activity: cat.activity + Math.floor((Math.random() - 0.5) * toMilliunits(30)),
          balance: cat.balance
        }))
      )
    });
  }

  return months;
};

export const mockMonths = generateMockMonths();

// =============================================================================
// ACCOUNT SUMMARY
// =============================================================================
export const mockAccountSummary = {
  totalAssets: mockAccounts
    .filter(acc => acc.balance > 0)
    .reduce((sum, acc) => sum + acc.balance / 1000, 0) +
    mockManualAccounts.reduce((sum, acc) => sum + Math.max(0, acc.balance), 0),

  totalLiabilities: mockAccounts
    .filter(acc => acc.balance < 0)
    .reduce((sum, acc) => sum + Math.abs(acc.balance / 1000), 0),

  netWorth: 0
};

mockAccountSummary.netWorth = mockAccountSummary.totalAssets - mockAccountSummary.totalLiabilities;

// =============================================================================
// COMPLETE YNAB DATA STRUCTURE
// =============================================================================
export const mockYNABData = {
  budgets: [
    {
      id: 'budget-demo-main',
      name: 'Demo Family Budget',
      last_modified_on: new Date().toISOString(),
      first_month: getMonthDate(11),
      last_month: getMonthDate(0),
      date_format: { format: 'MM/DD/YYYY' },
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
  categories: mockCategories,
  months: mockMonths,
  summary: {
    budgets: [{ id: 'budget-demo-main', name: 'Demo Family Budget' }],
    accounts: mockAccounts,
    transactions: mockTransactions,
    categories: mockCategories,
    months: mockMonths
  },
  isLoading: false,
  isError: false,
  error: null,
  refetch: () => console.log('Demo mode: refetch simulated'),
  isConnected: true // Show as connected for full demo experience
};

// =============================================================================
// DEFAULT EXPORT
// =============================================================================
export default {
  mockUser,
  mockAccounts,
  mockManualAccounts,
  mockTransactions,
  mockCategories,
  mockMonths,
  mockAccountSummary,
  mockYNABData
};
