class YNABService {
  constructor() {
    this.client = null;
    this.accessToken = null;
    this.ynabAPI = null;
  }

  async init(accessToken) {
    try {
      console.log('Initializing YNAB service with token:', accessToken ? 'Token provided' : 'No token');
      
      if (!accessToken) {
        throw new Error('Access token is required');
      }
      
      if (!this.ynabAPI) {
        console.log('Loading YNAB module...');
        // Dynamic import to avoid build issues
        const ynabModule = await import('ynab');
        console.log('YNAB module loaded:', ynabModule);
        
        // Try different ways to access the API class
        this.ynabAPI = ynabModule.API || ynabModule.default?.API || ynabModule.default;
        
        if (!this.ynabAPI) {
          console.error('Could not find YNAB API class in module:', ynabModule);
          throw new Error('Could not load YNAB API class');
        }
        
        console.log('YNAB API class found:', this.ynabAPI);
      }
      
      this.accessToken = accessToken;
      this.client = new this.ynabAPI(accessToken);
      
      console.log('YNAB client initialized successfully');
      
      // Test the connection by trying to get budgets
      try {
        const response = await this.client.budgets.getBudgets();
        console.log('YNAB connection test successful:', response.data.budgets.length, 'budgets found');
      } catch (testError) {
        console.error('YNAB connection test failed:', testError);
        throw new Error(`YNAB connection failed: ${testError.message}`);
      }
      
    } catch (error) {
      console.error('Error initializing YNAB API:', error);
      this.client = null;
      this.accessToken = null;
      throw new Error(`Failed to initialize YNAB API: ${error.message}`);
    }
  }

  isInitialized() {
    return this.client !== null;
  }

  async getBudgets() {
    if (!this.client) throw new Error('YNAB API not initialized');
    
    try {
      const response = await this.client.budgets.getBudgets();
      return response.data.budgets;
    } catch (error) {
      console.error('Error fetching YNAB budgets:', error);
      throw error;
    }
  }

  async getAccounts(budgetId = 'last-used') {
    if (!this.client) throw new Error('YNAB API not initialized');
    
    try {
      const response = await this.client.accounts.getAccounts(budgetId);
      return response.data.accounts.map(account => ({
        id: account.id,
        account_id: account.id, // Ensure compatibility with Plaid account format
        name: account.name,
        type: account.type,
        balance: account.balance / 1000, // YNAB stores in milliunits
        balances: {
          current: account.balance / 1000,
          available: account.cleared_balance / 1000
        },
        cleared_balance: account.cleared_balance / 1000,
        uncleared_balance: account.uncleared_balance / 1000,
        closed: account.closed,
        deleted: account.deleted,
        note: account.note,
        source: 'ynab'
      }));
    } catch (error) {
      console.error('Error fetching YNAB accounts:', error);
      throw error;
    }
  }

  async getTransactions(budgetId = 'last-used', sinceDate = null) {
    if (!this.client) throw new Error('YNAB API not initialized');
    
    try {
      // Get recent transactions (last 30 days if no since date)
      const defaultSince = sinceDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const response = await this.client.transactions.getTransactions(budgetId, defaultSince);
      return response.data.transactions
        .filter(transaction => !transaction.deleted) // Filter out deleted transactions
        .map(transaction => ({
        id: transaction.id,
        transaction_id: transaction.id, // Ensure compatibility with Plaid transaction format
        date: transaction.date,
        amount: transaction.amount / 1000, // YNAB stores in milliunits
        name: transaction.payee_name || transaction.memo || 'YNAB Transaction',
        memo: transaction.memo,
        cleared: transaction.cleared,
        approved: transaction.approved,
        flag_color: transaction.flag_color,
        account_id: transaction.account_id,
        payee_name: transaction.payee_name,
        category_name: transaction.category_name,
        transfer_account_id: transaction.transfer_account_id,
        transfer_transaction_id: transaction.transfer_transaction_id,
        deleted: transaction.deleted,
        source: 'ynab'
      }));
    } catch (error) {
      console.error('Error fetching YNAB transactions:', error);
      throw error;
    }
  }

  async getCategories(budgetId = 'last-used') {
    if (!this.client) throw new Error('YNAB API not initialized');
    
    try {
      const response = await this.client.categories.getCategories(budgetId);
      return response.data.category_groups.map(group => ({
        id: group.id,
        name: group.name,
        hidden: group.hidden,
        deleted: group.deleted,
        categories: group.categories.map(category => ({
          id: category.id,
          name: category.name,
          budgeted: category.budgeted / 1000,
          activity: category.activity / 1000,
          balance: category.balance / 1000,
          goal_type: category.goal_type,
          goal_creation_month: category.goal_creation_month,
          goal_target: category.goal_target ? category.goal_target / 1000 : null,
          goal_target_month: category.goal_target_month,
          goal_percentage_complete: category.goal_percentage_complete,
          hidden: category.hidden,
          deleted: category.deleted,
          note: category.note
        }))
      }));
    } catch (error) {
      console.error('Error fetching YNAB categories:', error);
      throw error;
    }
  }

  async getMonths(budgetId = 'last-used') {
    if (!this.client) throw new Error('YNAB API not initialized');
    
    try {
      const response = await this.client.months.getBudgetMonths(budgetId);
      return response.data.months.map(month => ({
        month: month.month,
        note: month.note,
        income: month.income / 1000,
        budgeted: month.budgeted / 1000,
        activity: month.activity / 1000,
        to_be_budgeted: month.to_be_budgeted / 1000,
        age_of_money: month.age_of_money,
        deleted: month.deleted
      }));
    } catch (error) {
      console.error('Error fetching YNAB months:', error);
      throw error;
    }
  }

  async getBudgetSummary(budgetId = 'last-used') {
    if (!this.client) throw new Error('YNAB API not initialized');
    
    try {
      const [accounts, transactions, categories, months] = await Promise.all([
        this.getAccounts(budgetId),
        this.getTransactions(budgetId),
        this.getCategories(budgetId),
        this.getMonths(budgetId)
      ]);

      const totalAssets = accounts
        .filter(account => !account.deleted && !account.closed)
        .reduce((sum, account) => sum + account.balance, 0);

      const currentMonth = months[0]; // Most recent month
      const recentTransactions = transactions
        .filter(t => !t.deleted)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 100);

      return {
        accounts,
        transactions: recentTransactions,
        categories,
        months,
        summary: {
          totalAssets,
          toBeBudgeted: currentMonth?.to_be_budgeted || 0,
          ageOfMoney: currentMonth?.age_of_money || 0,
          monthlyIncome: currentMonth?.income || 0,
          monthlySpending: Math.abs(currentMonth?.activity || 0)
        }
      };
    } catch (error) {
      console.error('Error fetching YNAB budget summary:', error);
      throw error;
    }
  }
}

export const ynabService = new YNABService();
export default ynabService;