// YNAB API Service - using backend proxy to avoid CORS issues

// Helper function for delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class YNABService {
  constructor() {
    this.accessToken = null;
    // Use empty string for same-domain in production, localhost for development
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001';
    this.maxRetries = 3;
    this.baseRetryDelay = 1000; // 1 second
  }

  init(accessToken) {
    this.accessToken = accessToken;
  }

  isInitialized() {
    return !!this.accessToken;
  }

  // Check if error is retryable (network errors, timeouts, 5xx errors)
  isRetryableError(error, status) {
    // Don't retry auth errors
    if (status === 401 || status === 403) return false;

    // Retry on server errors
    if (status >= 500) return true;

    // Retry on network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) return true;
    if (error.message.includes('network') || error.message.includes('timeout')) return true;

    return false;
  }

  async makeRequest(endpoint, options = {}, retryCount = 0) {
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
      // Add timeout to fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));

        // Handle specific error cases
        if (response.status === 401) {
          this.accessToken = null; // Clear the token
          console.warn('YNAB access token cleared due to 401 error.');
          // Dispatch a global event for auth failure
          window.dispatchEvent(new CustomEvent('ynab-auth-failure'));
          throw new Error('YNAB authentication failed - please reconnect your account');
        }

        // Retry on 5xx errors
        if (response.status >= 500 && retryCount < this.maxRetries) {
          const retryDelay = this.baseRetryDelay * Math.pow(2, retryCount);
          console.log(`YNAB API returned ${response.status}, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
          await delay(retryDelay);
          return this.makeRequest(endpoint, options, retryCount + 1);
        }

        throw new Error(error.error || `API request failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      // Handle abort (timeout)
      if (error.name === 'AbortError') {
        if (retryCount < this.maxRetries) {
          const retryDelay = this.baseRetryDelay * Math.pow(2, retryCount);
          console.log(`YNAB API request timed out, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
          await delay(retryDelay);
          return this.makeRequest(endpoint, options, retryCount + 1);
        }
        throw new Error('YNAB API request timed out after multiple attempts');
      }

      // Handle network errors with retry
      if (this.isRetryableError(error) && retryCount < this.maxRetries) {
        const retryDelay = this.baseRetryDelay * Math.pow(2, retryCount);
        console.log(`YNAB API request failed with network error, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
        await delay(retryDelay);
        return this.makeRequest(endpoint, options, retryCount + 1);
      }

      console.error('YNAB API request failed:', error);
      throw error;
    }
  }

  async getBudgets() {
    const result = await this.makeRequest('/api/ynab/budgets');
    return result.data?.budgets || [];
  }

  async getAccounts(budgetId = 'last-used') {
    const result = await this.makeRequest(`/api/ynab/budgets?budgetId=${budgetId}&resource=accounts`);
    return result.data?.accounts || [];
  }

  async getTransactions(budgetId = 'last-used', sinceDate = null) {
    let endpoint = `/api/ynab/budgets?budgetId=${budgetId}&resource=transactions`;
    if (sinceDate) {
      endpoint += `&since_date=${sinceDate}`;
    }
    const result = await this.makeRequest(endpoint);
    return result.data?.transactions || [];
  }

  async getCategories(budgetId = 'last-used') {
    const result = await this.makeRequest(`/api/ynab/budgets?budgetId=${budgetId}&resource=categories`);
    return result.data || { category_groups: [] };
  }

  async getMonths(budgetId = 'last-used') {
    const result = await this.makeRequest(`/api/ynab/budgets?budgetId=${budgetId}&resource=months`);
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
        categories: categories,
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
