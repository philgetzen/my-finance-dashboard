// YNAB API Service - using backend proxy to avoid CORS issues

// Helper function for delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class YNABService {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.userId = null;
    this.isRefreshing = false;
    this.refreshPromise = null;
    // Use empty string for same-domain in production, localhost for development
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001';
    this.maxRetries = 3;
    this.baseRetryDelay = 1000; // 1 second
  }

  init(accessToken, refreshToken = null, userId = null) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.userId = userId;
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

  // Attempt to refresh the access token using the refresh token
  async refreshAccessToken() {
    if (!this.refreshToken || !this.userId) {
      console.warn('Cannot refresh token: missing refresh token or user ID');
      return null;
    }

    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this._doRefresh();

    try {
      return await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  async _doRefresh() {
    try {
      console.log('Attempting to refresh YNAB access token...');

      const response = await fetch(`${this.apiBaseUrl}/api/ynab/refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: this.userId,
          refresh_token: this.refreshToken
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));

        if (error.code === 'REAUTH_REQUIRED') {
          console.warn('Refresh token expired - user must re-authenticate');
          this.accessToken = null;
          this.refreshToken = null;
          window.dispatchEvent(new CustomEvent('ynab-auth-failure', { detail: { requireReauth: true } }));
          return null;
        }

        throw new Error(error.error || 'Token refresh failed');
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;

      console.log('YNAB access token refreshed successfully');

      // Notify listeners that tokens were refreshed
      window.dispatchEvent(new CustomEvent('ynab-token-refreshed', {
        detail: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token
        }
      }));

      return data.access_token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
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
          // Try to refresh the token before giving up
          if (this.refreshToken && !options._refreshAttempted) {
            console.log('Got 401, attempting token refresh...');
            const newToken = await this.refreshAccessToken();
            if (newToken) {
              // Retry the request with new token
              return this.makeRequest(endpoint, { ...options, _refreshAttempted: true }, 0);
            }
          }

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
    // Try parallel fetch first for performance
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
    } catch (parallelError) {
      console.warn('Parallel fetch failed, attempting sequential fallback:', parallelError.message);

      // Sequential fallback - fetch one at a time for reliability
      try {
        const result = {
          budgets: [],
          accounts: [],
          transactions: [],
          categories: { category_groups: [] },
          months: []
        };

        // Fetch critical data first
        try {
          result.budgets = await this.getBudgets();
        } catch (e) {
          console.warn('Failed to fetch budgets:', e.message);
        }

        try {
          result.accounts = await this.getAccounts(budgetId);
        } catch (e) {
          console.warn('Failed to fetch accounts:', e.message);
        }

        try {
          result.transactions = await this.getTransactions(budgetId);
        } catch (e) {
          console.warn('Failed to fetch transactions:', e.message);
        }

        // Non-critical data
        try {
          result.categories = await this.getCategories(budgetId);
        } catch (e) {
          console.warn('Failed to fetch categories:', e.message);
        }

        try {
          result.months = await this.getMonths(budgetId);
        } catch (e) {
          console.warn('Failed to fetch months:', e.message);
        }

        // If we got at least accounts or transactions, return partial data
        if (result.accounts.length > 0 || result.transactions.length > 0) {
          console.log('Sequential fallback succeeded with partial data');
          return result;
        }

        // If all critical data failed, throw the original error
        throw parallelError;
      } catch (sequentialError) {
        console.error('Sequential fallback also failed:', sequentialError);
        throw parallelError; // Throw the original parallel error
      }
    }
  }
}

export const ynabService = new YNABService();
export default ynabService;
