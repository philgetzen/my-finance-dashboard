// YNAB API Service - using backend proxy to avoid CORS issues

class YNABService {
  constructor() {
    this.accessToken = null;
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
  }

  init(accessToken) {
    this.accessToken = accessToken;
  }

  isInitialized() {
    return !!this.accessToken;
  }

  async makeRequest(endpoint, options = {}) {
    if (!this.isInitialized() && !options.skipAuth) {
      console.warn('YNAB API request attempted without access token');
      throw new Error('YNAB service not initialized - please connect your YNAB account first');
    }

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.accessToken && !options.skipAuth) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        ...options,
        headers
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        
        // Handle specific error cases
        if (response.status === 401) {
          throw new Error('YNAB authentication failed - please reconnect your account');
        }
        
        throw new Error(error.error || `API request failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('YNAB API request failed:', error);
      throw error;
    }
  }

  async getBudgets() {
    const result = await this.makeRequest('/api/ynab/budgets');
    return result.data?.budgets || [];
  }

  async getAccounts(budgetId = 'last-used') {
    const result = await this.makeRequest(`/api/ynab/budgets/${budgetId}/accounts`);
    return result.data?.accounts || [];
  }

  async getTransactions(budgetId = 'last-used', sinceDate = null) {
    let endpoint = `/api/ynab/budgets/${budgetId}/transactions`;
    if (sinceDate) {
      endpoint += `?since_date=${sinceDate}`;
    }
    const result = await this.makeRequest(endpoint);
    return result.data?.transactions || [];
  }

  async getCategories(budgetId = 'last-used') {
    const result = await this.makeRequest(`/api/ynab/budgets/${budgetId}/categories`);
    return result.data?.category_groups || [];
  }

  async getMonths(budgetId = 'last-used') {
    const result = await this.makeRequest(`/api/ynab/budgets/${budgetId}/months`);
    return result.data?.months || [];
  }

  async getBudgetSummary(budgetId = 'last-used') {
    try {
      const [budgets, accounts, transactions, categories, months] = await Promise.all([
        this.getBudgets(),
        this.getAccounts(budgetId),
        this.getTransactions(budgetId),
        this.getCategories(budgetId),
        this.getMonths(budgetId)
      ]);

      return {
        budgets,
        accounts,
        transactions,
        categories,
        months
      };
    } catch (error) {
      console.error('Error fetching budget summary:', error);
      throw error;
    }
  }
}

export const ynabService = new YNABService();
export default ynabService;