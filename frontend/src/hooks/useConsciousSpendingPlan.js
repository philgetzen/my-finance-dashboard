import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useFinanceData } from '../contexts/ConsolidatedDataContext';
import { getTransactionAmount } from '../utils/ynabHelpers';

// Ramit Sethi's Conscious Spending Plan recommended percentages
export const CSP_TARGETS = {
  fixedCosts: { min: 50, max: 60, label: 'Fixed Costs' },
  investments: { min: 10, max: 10, label: 'Investments' },
  savings: { min: 5, max: 10, label: 'Savings' },
  guiltFree: { min: 20, max: 35, label: 'Guilt-Free Spending' }
};

// CSP Bucket types for category mapping
export const CSP_BUCKETS = {
  fixedCosts: { key: 'fixedCosts', label: 'Fixed Costs', color: '#6366F1' },
  investments: { key: 'investments', label: 'Investments', color: '#10B981' },
  savings: { key: 'savings', label: 'Savings', color: '#3B82F6' },
  guiltFree: { key: 'guiltFree', label: 'Guilt-Free', color: '#F59E0B' }
};

// LocalStorage keys (for migration)
const CSP_EXCLUDED_PAYEES_KEY = 'csp_excluded_payees';
const CSP_CATEGORY_MAPPINGS_KEY = 'csp_category_mappings';
const CSP_EXCLUDED_CATEGORIES_KEY = 'csp_excluded_categories'; // For income categories
const CSP_EXCLUDED_EXPENSE_CATEGORIES_KEY = 'csp_excluded_expense_categories'; // For expense categories
const CSP_SETTINGS_KEY = 'csp_settings';
const CSP_MIGRATED_KEY = 'csp_migrated_to_firestore';

// Default keyword-based mappings (used when no custom mapping exists)
const DEFAULT_FIXED_COST_KEYWORDS = [
  'rent', 'mortgage', 'utilities', 'electric', 'gas', 'water', 'internet',
  'phone', 'insurance', 'car payment', 'auto', 'transportation', 'groceries',
  'food', 'subscription', 'netflix', 'spotify', 'gym', 'membership',
  'loan', 'debt', 'payment', 'cable', 'trash', 'sewer', 'hoa'
];

const DEFAULT_INVESTMENT_KEYWORDS = [
  'investment', 'retirement', '401k', 'ira', 'roth', 'stock', 'etf',
  'mutual fund', 'brokerage', 'investing'
];

const DEFAULT_SAVINGS_KEYWORDS = [
  'savings', 'emergency', 'vacation', 'travel', 'gift', 'holiday',
  'christmas', 'birthday', 'wedding', 'fund', 'goal', 'reserve',
  'house', 'down payment', 'sinking'
];

// Default settings
const DEFAULT_SETTINGS = {
  includeTrackingAccounts: true,
  useKeywordFallback: false,  // Changed to false - prefer custom category mappings over keyword inference
};

// Helper to read from localStorage with fallback
function readLocalStorage(key, defaultValue) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

// Helper to check if there's data in localStorage to migrate
function hasLocalStorageData() {
  return (
    localStorage.getItem(CSP_CATEGORY_MAPPINGS_KEY) ||
    localStorage.getItem(CSP_EXCLUDED_CATEGORIES_KEY) ||
    localStorage.getItem(CSP_EXCLUDED_PAYEES_KEY) ||
    localStorage.getItem(CSP_EXCLUDED_EXPENSE_CATEGORIES_KEY) ||
    localStorage.getItem(CSP_SETTINGS_KEY)
  );
}

// Helper to clear localStorage after migration
function clearLocalStorageData() {
  localStorage.removeItem(CSP_CATEGORY_MAPPINGS_KEY);
  localStorage.removeItem(CSP_EXCLUDED_CATEGORIES_KEY);
  localStorage.removeItem(CSP_EXCLUDED_PAYEES_KEY);
  localStorage.removeItem(CSP_EXCLUDED_EXPENSE_CATEGORIES_KEY);
  localStorage.removeItem(CSP_SETTINGS_KEY);
  localStorage.setItem(CSP_MIGRATED_KEY, 'true');
}

/**
 * Hook to manage all CSP settings including category mappings, exclusions, and account settings
 * Now persists to Firestore for cross-device sync
 */
export function useCSPSettings() {
  const { user, isDemoMode } = useFinanceData();
  const userId = user?.uid;

  // Track if we're currently saving to prevent loops
  const isSaving = useRef(false);
  const [isLoading, setIsLoading] = useState(true);

  // Category-to-bucket mappings (categoryId -> bucket)
  const [categoryMappings, setCategoryMappings] = useState({});

  // Excluded income categories (for one-time income like house sales)
  const [excludedCategories, setExcludedCategories] = useState(new Set());

  // Excluded payees
  const [excludedPayees, setExcludedPayees] = useState(new Set());

  // Excluded expense categories (for reimbursable expenses, etc.)
  const [excludedExpenseCategories, setExcludedExpenseCategories] = useState(new Set());

  // General settings (include tracking accounts, etc.)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // Load settings from Firestore and set up real-time sync
  useEffect(() => {
    // Skip for demo mode - use localStorage fallback
    if (isDemoMode || !userId) {
      // Load from localStorage for unauthenticated users or demo mode
      setCategoryMappings(readLocalStorage(CSP_CATEGORY_MAPPINGS_KEY, {}));
      setExcludedCategories(new Set(readLocalStorage(CSP_EXCLUDED_CATEGORIES_KEY, [])));
      setExcludedPayees(new Set(readLocalStorage(CSP_EXCLUDED_PAYEES_KEY, [])));
      setExcludedExpenseCategories(new Set(readLocalStorage(CSP_EXCLUDED_EXPENSE_CATEGORIES_KEY, [])));
      setSettings(readLocalStorage(CSP_SETTINGS_KEY, DEFAULT_SETTINGS));
      setIsLoading(false);
      return;
    }

    const docRef = doc(db, 'csp_settings', userId);

    // Set up real-time listener for cross-device sync
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      // Skip if we're currently saving (to prevent loops)
      if (isSaving.current) return;

      if (docSnap.exists()) {
        const data = docSnap.data();
        setCategoryMappings(data.categoryMappings || {});
        setExcludedCategories(new Set(data.excludedCategories || []));
        setExcludedPayees(new Set(data.excludedPayees || []));
        setExcludedExpenseCategories(new Set(data.excludedExpenseCategories || []));
        setSettings(data.settings || DEFAULT_SETTINGS);
      } else {
        // No Firestore data - check for localStorage migration
        const alreadyMigrated = localStorage.getItem(CSP_MIGRATED_KEY) === 'true';

        if (!alreadyMigrated && hasLocalStorageData()) {
          // Migrate from localStorage
          const localMappings = readLocalStorage(CSP_CATEGORY_MAPPINGS_KEY, {});
          const localExcludedCats = readLocalStorage(CSP_EXCLUDED_CATEGORIES_KEY, []);
          const localExcludedPayees = readLocalStorage(CSP_EXCLUDED_PAYEES_KEY, []);
          const localExcludedExpenseCats = readLocalStorage(CSP_EXCLUDED_EXPENSE_CATEGORIES_KEY, []);
          const localSettings = readLocalStorage(CSP_SETTINGS_KEY, DEFAULT_SETTINGS);

          // Save to Firestore
          isSaving.current = true;
          try {
            await setDoc(docRef, {
              categoryMappings: localMappings,
              excludedCategories: localExcludedCats,
              excludedPayees: localExcludedPayees,
              excludedExpenseCategories: localExcludedExpenseCats,
              settings: localSettings,
              updatedAt: new Date().toISOString(),
              migratedFromLocalStorage: true
            });

            // Update local state
            setCategoryMappings(localMappings);
            setExcludedCategories(new Set(localExcludedCats));
            setExcludedPayees(new Set(localExcludedPayees));
            setExcludedExpenseCategories(new Set(localExcludedExpenseCats));
            setSettings(localSettings);

            // Clear localStorage after successful migration
            clearLocalStorageData();
            console.log('CSP settings migrated from localStorage to Firestore');
          } catch (error) {
            console.error('Failed to migrate CSP settings to Firestore:', error);
          } finally {
            isSaving.current = false;
          }
        } else {
          // Initialize with defaults
          setCategoryMappings({});
          setExcludedCategories(new Set());
          setExcludedPayees(new Set());
          setExcludedExpenseCategories(new Set());
          setSettings(DEFAULT_SETTINGS);
        }
      }
      setIsLoading(false);
    }, (error) => {
      console.error('Error listening to CSP settings:', error);
      // Fall back to localStorage on error
      setCategoryMappings(readLocalStorage(CSP_CATEGORY_MAPPINGS_KEY, {}));
      setExcludedCategories(new Set(readLocalStorage(CSP_EXCLUDED_CATEGORIES_KEY, [])));
      setExcludedPayees(new Set(readLocalStorage(CSP_EXCLUDED_PAYEES_KEY, [])));
      setExcludedExpenseCategories(new Set(readLocalStorage(CSP_EXCLUDED_EXPENSE_CATEGORIES_KEY, [])));
      setSettings(readLocalStorage(CSP_SETTINGS_KEY, DEFAULT_SETTINGS));
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId, isDemoMode]);

  // Helper to save all settings to Firestore
  const saveToFirestore = useCallback(async (updates) => {
    if (!userId || isDemoMode) {
      // For unauthenticated users or demo mode, save to localStorage
      if (updates.categoryMappings !== undefined) {
        localStorage.setItem(CSP_CATEGORY_MAPPINGS_KEY, JSON.stringify(updates.categoryMappings));
      }
      if (updates.excludedCategories !== undefined) {
        localStorage.setItem(CSP_EXCLUDED_CATEGORIES_KEY, JSON.stringify(updates.excludedCategories));
      }
      if (updates.excludedPayees !== undefined) {
        localStorage.setItem(CSP_EXCLUDED_PAYEES_KEY, JSON.stringify(updates.excludedPayees));
      }
      if (updates.excludedExpenseCategories !== undefined) {
        localStorage.setItem(CSP_EXCLUDED_EXPENSE_CATEGORIES_KEY, JSON.stringify(updates.excludedExpenseCategories));
      }
      if (updates.settings !== undefined) {
        localStorage.setItem(CSP_SETTINGS_KEY, JSON.stringify(updates.settings));
      }
      return;
    }

    isSaving.current = true;
    try {
      const docRef = doc(db, 'csp_settings', userId);
      await setDoc(docRef, {
        categoryMappings: updates.categoryMappings ?? categoryMappings,
        excludedCategories: updates.excludedCategories ?? [...excludedCategories],
        excludedPayees: updates.excludedPayees ?? [...excludedPayees],
        excludedExpenseCategories: updates.excludedExpenseCategories ?? [...excludedExpenseCategories],
        settings: updates.settings ?? settings,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error('Failed to save CSP settings to Firestore:', error);
    } finally {
      // Small delay to prevent the onSnapshot from immediately overwriting
      setTimeout(() => {
        isSaving.current = false;
      }, 100);
    }
  }, [userId, isDemoMode, categoryMappings, excludedCategories, excludedPayees, excludedExpenseCategories, settings]);

  // Category mapping functions
  const setCategoryBucket = useCallback((categoryId, bucket) => {
    const newMappings = { ...categoryMappings, [categoryId]: bucket };
    setCategoryMappings(newMappings);
    saveToFirestore({ categoryMappings: newMappings });
  }, [categoryMappings, saveToFirestore]);

  const clearCategoryMapping = useCallback((categoryId) => {
    const newMappings = { ...categoryMappings };
    delete newMappings[categoryId];
    setCategoryMappings(newMappings);
    saveToFirestore({ categoryMappings: newMappings });
  }, [categoryMappings, saveToFirestore]);

  const clearAllCategoryMappings = useCallback(() => {
    setCategoryMappings({});
    saveToFirestore({ categoryMappings: {} });
  }, [saveToFirestore]);

  // Income category exclusion functions
  const toggleCategoryExclusion = useCallback((categoryId) => {
    const newExcluded = new Set(excludedCategories);
    if (newExcluded.has(categoryId)) {
      newExcluded.delete(categoryId);
    } else {
      newExcluded.add(categoryId);
    }
    setExcludedCategories(newExcluded);
    saveToFirestore({ excludedCategories: [...newExcluded] });
  }, [excludedCategories, saveToFirestore]);

  // Expense category exclusion functions
  const toggleExpenseCategoryExclusion = useCallback((categoryId) => {
    const newExcluded = new Set(excludedExpenseCategories);
    if (newExcluded.has(categoryId)) {
      newExcluded.delete(categoryId);
    } else {
      newExcluded.add(categoryId);
    }
    setExcludedExpenseCategories(newExcluded);
    saveToFirestore({ excludedExpenseCategories: [...newExcluded] });
  }, [excludedExpenseCategories, saveToFirestore]);

  const clearExpenseCategoryExclusions = useCallback(() => {
    setExcludedExpenseCategories(new Set());
    saveToFirestore({ excludedExpenseCategories: [] });
  }, [saveToFirestore]);

  // Payee exclusion functions
  const togglePayeeExclusion = useCallback((payee) => {
    const newExcluded = new Set(excludedPayees);
    if (newExcluded.has(payee)) {
      newExcluded.delete(payee);
    } else {
      newExcluded.add(payee);
    }
    setExcludedPayees(newExcluded);
    saveToFirestore({ excludedPayees: [...newExcluded] });
  }, [excludedPayees, saveToFirestore]);

  const clearPayeeExclusions = useCallback(() => {
    setExcludedPayees(new Set());
    saveToFirestore({ excludedPayees: [] });
  }, [saveToFirestore]);

  // Settings functions
  const updateSettings = useCallback((newSettings) => {
    const mergedSettings = { ...settings, ...newSettings };
    setSettings(mergedSettings);
    saveToFirestore({ settings: mergedSettings });
  }, [settings, saveToFirestore]);

  return {
    categoryMappings,
    excludedCategories,
    excludedPayees,
    excludedExpenseCategories,
    settings,
    isLoading,
    setCategoryBucket,
    clearCategoryMapping,
    clearAllCategoryMappings,
    toggleCategoryExclusion,
    toggleExpenseCategoryExclusion,
    clearExpenseCategoryExclusions,
    togglePayeeExclusion,
    clearPayeeExclusions,
    updateSettings
  };
}

// Legacy hook for backward compatibility
export function useExcludedPayees() {
  const { excludedPayees, togglePayeeExclusion, clearPayeeExclusions } = useCSPSettings();
  return {
    excludedPayees,
    togglePayee: togglePayeeExclusion,
    clearExclusions: clearPayeeExclusions
  };
}

// Income categories (excluded from spending)
const INCOME_CATEGORIES = [
  "Inflow: Ready to Assign",
  "Ready to Assign",
  "To be Budgeted",
  "Deferred Income SubCategory"
];

/**
 * Map YNAB group names to CSP buckets
 * This allows direct matching of user's YNAB group structure
 */
const GROUP_NAME_TO_BUCKET = {
  // Fixed Costs variations
  'fixed costs': 'fixedCosts',
  'fixed': 'fixedCosts',
  'bills': 'fixedCosts',
  'monthly bills': 'fixedCosts',
  // Investments variations
  'investments': 'investments',
  'investing': 'investments',
  'post tax investments': 'investments',
  'post-tax investments': 'investments',
  // Savings variations
  'savings': 'savings',
  'saving': 'savings',
  'savings goals': 'savings',
  'true expenses': 'guiltFree', // Common YNAB pattern - irregular but expected expenses
  // Guilt-free variations
  'guilt-free': 'guiltFree',
  'guilt free': 'guiltFree',
  'guilt-free spending': 'guiltFree',
  'discretionary': 'guiltFree',
  'fun money': 'guiltFree',
  'spending': 'guiltFree',
  'variable expenses': 'guiltFree',
};

/**
 * Get bucket from YNAB group name (direct match)
 */
function getBucketFromGroupName(groupName) {
  if (!groupName) return null;
  const lowerGroup = groupName.toLowerCase().trim();
  return GROUP_NAME_TO_BUCKET[lowerGroup] || null;
}

/**
 * Categorize a transaction into a CSP bucket
 * Priority: 1) Custom mapping, 2) Keyword inference (if enabled), 3) Default to guilt-free
 */
function categorizeTransaction(categoryId, categoryName, categoryGroupName, categoryMappings, useKeywordFallback) {
  // Use custom mapping if it exists
  if (categoryId && categoryMappings[categoryId]) {
    return categoryMappings[categoryId];
  }

  // Use keyword inference as fallback when enabled (default is true)
  if (useKeywordFallback !== false) {
    const inferredBucket = getInferredBucket(categoryName, categoryGroupName);
    if (inferredBucket && inferredBucket !== 'guiltFree') {
      return inferredBucket;
    }
  }

  // No custom mapping and no keyword match - default to guilt-free
  return 'guiltFree';
}

/**
 * Get the inferred bucket for a category
 * Priority: 1) YNAB group name match, 2) Keyword matching
 */
export function getInferredBucket(categoryName, categoryGroupName) {
  // First: Check if YNAB group name directly matches a bucket
  const groupBucket = getBucketFromGroupName(categoryGroupName);
  if (groupBucket) {
    return groupBucket;
  }

  // Fallback to keyword matching
  if (!categoryName) return 'guiltFree';

  const lowerCategory = categoryName.toLowerCase();
  const lowerGroup = (categoryGroupName || '').toLowerCase();

  if (DEFAULT_INVESTMENT_KEYWORDS.some(kw => lowerCategory.includes(kw) || lowerGroup.includes(kw))) {
    return 'investments';
  }
  if (DEFAULT_SAVINGS_KEYWORDS.some(kw => lowerCategory.includes(kw) || lowerGroup.includes(kw))) {
    return 'savings';
  }
  if (DEFAULT_FIXED_COST_KEYWORDS.some(kw => lowerCategory.includes(kw) || lowerGroup.includes(kw))) {
    return 'fixedCosts';
  }
  return 'guiltFree';
}

/**
 * Custom hook for calculating Conscious Spending Plan data from YNAB transactions
 * @param {Array} transactions - YNAB transactions array
 * @param {Object} categories - YNAB categories object
 * @param {Array} accounts - YNAB accounts array (to identify tracking accounts)
 * @param {number} periodMonths - Number of months to analyze (default: 6)
 * @param {Object} cspSettings - CSP settings from useCSPSettings hook
 * @param {Array} months - YNAB budget months array (contains budgeted amounts per category)
 */
export function useConsciousSpendingPlan(transactions, categories, accounts, periodMonths = 6, cspSettings = {}, months = []) {
  const {
    categoryMappings = {},
    excludedCategories = new Set(),
    excludedPayees = new Set(),
    excludedExpenseCategories = new Set(),
    settings = { includeTrackingAccounts: true, useKeywordFallback: true }
  } = cspSettings;
  return useMemo(() => {
    if (!transactions?.length) {
      return {
        monthlyIncome: 0,
        buckets: {
          fixedCosts: { amount: 0, percentage: 0, target: CSP_TARGETS.fixedCosts, categories: [] },
          investments: { amount: 0, percentage: 0, target: CSP_TARGETS.investments, categories: [] },
          savings: { amount: 0, percentage: 0, target: CSP_TARGETS.savings, categories: [] },
          guiltFree: { amount: 0, percentage: 0, target: CSP_TARGETS.guiltFree, categories: [] }
        },
        categoryBreakdown: [],
        monthlyData: [],
        isOnTrack: false,
        suggestions: [],
        incomePayees: [],
        netWorth: {
          assets: 0,
          investments: 0,
          savings: 0,
          debt: 0,
          total: 0,
          breakdown: []
        },
        preTaxInvestments: { amount: 0, monthlyAmount: 0, accounts: [] },
        postTaxInvestments: { amount: 0, monthlyAmount: 0, accounts: [] }
      };
    }

    // Build category lookup map AND extract Available balances from categories
    // YNAB categories include balance (Available) which represents accumulated funds
    const categoryMap = new Map();
    const categoryBudgetedAmounts = new Map(); // categoryId -> { available: number, monthlyBudgeted: number }

    if (categories?.category_groups) {
      categories.category_groups.forEach(group => {
        if (group.categories) {
          group.categories.forEach(cat => {
            categoryMap.set(cat.id, {
              name: cat.name,
              groupName: group.name
            });

            // Extract balance (Available) amount from category
            // For savings categories, we want the Available amount - what's actually accumulated
            // YNAB stores amounts in milliunits
            const available = (cat.balance || 0) / 1000;
            const budgeted = (cat.budgeted || 0) / 1000;
            if (available > 0 || budgeted > 0) {
              categoryBudgetedAmounts.set(cat.id, {
                available: available,           // The "Available" amount in the category
                monthlyBudgeted: budgeted,      // What was assigned this month
                total: available,               // For savings, use Available as the total
                categoryName: cat.name,
                groupName: group.name
              });
            }
          });
        }
      });
    }

    // Calculate date range
    const now = new Date();
    let startDate;
    let endDate = null; // Only used for "Previous Month" option

    if (periodMonths === 0) {
      // "This Month": current partial month (1st of current month to today)
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = null; // Up to today
    } else {
      // "Last X Months": X COMPLETE calendar months (excluding current partial month)
      // This matches YNAB's "Last X Months" behavior
      startDate = new Date(now.getFullYear(), now.getMonth() - periodMonths, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
    }

    // Build account lookup for tracking account detection
    // Also categorize ALL accounts for Net Worth calculation
    const accountMap = new Map();
    const trackingAccountIds = new Set();
    const investmentTrackingAccountIds = new Set();
    const preTaxAccountIds = new Set(); // 401k, traditional IRA, etc.

    // Net Worth tracking - includes ALL accounts (on-budget and tracking)
    const netWorthAccounts = {
      assets: [],      // Home value, property, vehicles, etc.
      investments: [], // All investment accounts (both pre and post-tax)
      savings: [],     // Savings/checking accounts (on-budget AND tracking)
      debt: []         // Mortgages, loans, credit cards
    };

    if (accounts?.length) {
      accounts.forEach(acc => {
        const accountId = acc.id || acc.account_id;
        const balance = (acc.balance || 0) / 1000; // YNAB stores in milliunits
        accountMap.set(accountId, acc);

        const accType = (acc.type || acc.account_type || '').toLowerCase();
        const accName = (acc.name || '').toLowerCase();
        const isOnBudget = acc.on_budget !== false;

        // Track tracking accounts for transaction processing
        if (!isOnBudget) {
          trackingAccountIds.add(accountId);
        }

        // Skip closed accounts for Net Worth
        if (acc.closed) {
          return;
        }

        // Categorize for Net Worth (all accounts, not just tracking)
        const isHomeValueAccount =
          accName.includes('home value') ||
          accName.includes('redfin') ||
          accName.includes('zillow') ||
          accName.includes('house value') ||
          accName.includes('property value') ||
          accName.includes('real estate');

        const isDebtAccount =
          accType === 'otherliability' ||
          accType === 'mortgage' ||
          accType === 'loan' ||
          accType === 'creditcard' ||
          accType === 'lineofcredit' ||
          accName.includes('mortgage') ||
          accName.includes('loan') ||
          accName.includes('credit card');

        const isPreTaxAccount =
          accName.includes('401k') ||
          accName.includes('401(k)') ||
          accName.includes('traditional ira') ||
          accName.includes('employer match') ||
          accName.includes('pension') ||
          accName.includes('403b') ||
          accName.includes('457') ||
          (accName.includes('ira') && !accName.includes('roth'));

        // Investment accounts - be more specific to avoid false positives
        // Note: YNAB uses 'otherasset' for investment/tracking accounts, not 'investmentaccount'
        const isInvestmentType =
          !isHomeValueAccount && !isDebtAccount && (
            accType === 'otherasset' ||
            accName.includes('401k') ||
            accName.includes('401(k)') ||
            accName.includes('ira') ||
            accName.includes('roth') ||
            accName.includes('hsa') ||
            accName.includes('brokerage') ||
            accName.includes('investment') ||
            accName.includes('stock') ||
            accName.includes('rsu') ||
            accName.includes('espp') ||
            accName.includes('fidelity') ||
            accName.includes('vanguard') ||
            accName.includes('schwab') ||
            accName.includes('altruist') ||
            accName.includes('retirement')
          );

        // Savings accounts - check both on-budget and tracking
        const isSavingsType =
          !isHomeValueAccount && !isDebtAccount && !isInvestmentType && (
            accType === 'savings' ||
            accName.includes('savings') ||
            accName.includes('emergency') ||
            accName.includes('hysa') ||
            accName.includes('high yield')
          );

        // Checking accounts (on-budget) also count toward savings/cash
        const isCheckingType =
          !isHomeValueAccount && !isDebtAccount && !isInvestmentType && !isSavingsType && (
            accType === 'checking' ||
            accName.includes('checking')
          );

        // Add to appropriate Net Worth category
        const accountInfo = {
          id: accountId,
          name: acc.name,
          balance: balance,
          type: accType,
          isOnBudget: isOnBudget
        };

        if (isDebtAccount) {
          netWorthAccounts.debt.push(accountInfo);
        } else if (isHomeValueAccount) {
          netWorthAccounts.assets.push(accountInfo);
        } else if (isInvestmentType) {
          netWorthAccounts.investments.push(accountInfo);
          // Only track investment tracking accounts for contribution tracking
          if (!isOnBudget) {
            investmentTrackingAccountIds.add(accountId);
            if (isPreTaxAccount) {
              preTaxAccountIds.add(accountId);
            }
          }
        } else if (isSavingsType || isCheckingType) {
          netWorthAccounts.savings.push(accountInfo);
        } else if (!isOnBudget) {
          // Only add tracking accounts to assets as fallback
          // (on-budget accounts that don't match are just regular checking/savings)
          netWorthAccounts.assets.push(accountInfo);
        } else {
          // On-budget accounts that don't match go to savings (cash)
          netWorthAccounts.savings.push(accountInfo);
        }
      });
    }

    // Process transactions
    let totalIncome = 0;
    const bucketTotals = {
      fixedCosts: 0,
      investments: 0,
      savings: 0,
      guiltFree: 0
    };
    const categoryTotals = new Map();
    const monthlyBuckets = {};

    // Track income by payee and category for exclusion UI
    const incomeByPayee = new Map();
    const incomeByCategory = new Map();

    // Track pre-tax and post-tax investment contributions separately
    // These are for INFORMATIONAL purposes only (showing in Net Worth section)
    // They do NOT count toward CSP investment bucket - only budget expense categories do
    const preTaxContributions = { total: 0, accounts: new Map() };
    const postTaxContributions = { total: 0, accounts: new Map() };

    transactions.forEach(txn => {
      const txnDate = new Date(txn.date);
      if (txnDate < startDate) {
        return;
      }
      // For "Previous Month" option, also filter out transactions after the end date
      if (endDate && txnDate > endDate) {
        return;
      }

      const accountId = txn.account_id;
      const isTrackingAccount = trackingAccountIds.has(accountId);
      const isInvestmentTrackingAccount = investmentTrackingAccountIds.has(accountId);
      const isPreTaxAccount = preTaxAccountIds.has(accountId);

      // Handle tracking account transactions
      // These are for INFORMATIONAL tracking only - they don't count toward CSP buckets
      // CSP buckets are calculated from budget expense categories
      if (isTrackingAccount) {
        // If not including tracking accounts, skip entirely
        if (!settings.includeTrackingAccounts) {
          return;
        }

        // For investment tracking accounts, track contributions for display
        // This helps show pre-tax vs post-tax in the Net Worth section
        // But does NOT add to CSP investment bucket (that comes from budget categories)
        if (isInvestmentTrackingAccount) {
          const amount = getTransactionAmount(txn);

          // Count positive amounts (inflows) for informational display
          // Skip reconciliation adjustments and starting balances
          if (amount > 0 &&
              txn.payee_name !== 'Reconciliation Balance Adjustment' &&
              txn.payee_name !== 'Starting Balance') {

            const account = accountMap.get(accountId);
            const accountName = account?.name || 'Investment Account';

            if (isPreTaxAccount) {
              // Pre-tax contributions (401k, traditional IRA)
              preTaxContributions.total += amount;
              if (!preTaxContributions.accounts.has(accountId)) {
                preTaxContributions.accounts.set(accountId, { name: accountName, amount: 0, count: 0 });
              }
              const accData = preTaxContributions.accounts.get(accountId);
              accData.amount += amount;
              accData.count++;
            } else {
              // Post-tax contributions (Roth, brokerage, etc.)
              postTaxContributions.total += amount;
              if (!postTaxContributions.accounts.has(accountId)) {
                postTaxContributions.accounts.set(accountId, { name: accountName, amount: 0, count: 0 });
              }
              const accData = postTaxContributions.accounts.get(accountId);
              accData.amount += amount;
              accData.count++;
            }
          }
        }
        // Skip all tracking account transactions for CSP bucket calculations
        return;
      }

      // Handle transfers
      // Transfers TO investment tracking accounts count as investment expenses
      // Other transfers between budget accounts are skipped
      if (txn.transfer_account_id) {
        const transferToAccount = accountMap.get(txn.transfer_account_id);
        const isTransferToInvestmentTracking = investmentTrackingAccountIds.has(txn.transfer_account_id);

        // DEBUG: Log all transfer transactions to see what we're dealing with
        const catInfo = categoryMap.get(txn.category_id);
        if (catInfo?.name?.toLowerCase().includes('mortgage') || txn.payee_name?.toLowerCase().includes('mortgage')) {
          console.log('[CSP TRANSFER DEBUG] Mortgage-related transfer:', {
            payee: txn.payee_name,
            category_id: txn.category_id,
            category_name: catInfo?.name,
            transfer_to: transferToAccount?.name,
            amount: txn.amount,
            isInvestmentTransfer: isTransferToInvestmentTracking,
            hasCategory: !!txn.category_id
          });
        }

        if (isTransferToInvestmentTracking) {
          // This is a transfer TO an investment tracking account
          // Count it as an investment expense (the outflow from budget)
          const amount = getTransactionAmount(txn);
          if (amount < 0) { // Outflow from budget = investment contribution
            const monthKey = txnDate.toISOString().slice(0, 7);
            const expenseAmount = Math.abs(amount);

            // Initialize monthly data
            if (!monthlyBuckets[monthKey]) {
              monthlyBuckets[monthKey] = {
                income: 0,
                fixedCosts: 0,
                investments: 0,
                savings: 0,
                guiltFree: 0
              };
            }

            // Track as investment spending
            const transferCatName = `Transfer: ${transferToAccount?.name || 'Investment Account'}`;
            if (!categoryTotals.has(transferCatName)) {
              categoryTotals.set(transferCatName, {
                id: `transfer-${txn.transfer_account_id}`,
                name: transferCatName,
                bucket: 'investments',
                amount: 0,
                excludedAmount: 0,
                groupName: 'Investment Transfers',
                transactionCount: 0,
                monthlyAmounts: {}
              });
            }
            const catData = categoryTotals.get(transferCatName);
            catData.amount += expenseAmount;
            catData.transactionCount++;
            if (!catData.monthlyAmounts[monthKey]) {
              catData.monthlyAmounts[monthKey] = 0;
            }
            catData.monthlyAmounts[monthKey] += expenseAmount;
          }
          return; // Done processing investment transfer
        }

        // For non-investment transfers: only process if they have a category
        // This handles mortgage payments, loan payments, etc. that are categorized transfers
        // (e.g., checking → mortgage loan account, but with category "8331 Mortgage")
        if (!txn.category_id) {
          // Uncategorized transfers between budget accounts - skip
          return;
        }
        // Fall through to normal expense processing for categorized transfers
        console.log('[CSP DEBUG] Processing categorized transfer:', txn.payee_name, 'category:', categoryMap.get(txn.category_id)?.name);
      }
      if (txn.payee_name?.toLowerCase().startsWith('transfer :') && !txn.category_id) {
        return;
      }

      // Skip reconciliation
      if (txn.payee_name === 'Reconciliation Balance Adjustment' ||
          txn.payee_name === 'Starting Balance') {
        return;
      }

      const amount = getTransactionAmount(txn);
      const categoryInfo = categoryMap.get(txn.category_id) || { name: txn.category_name, groupName: '' };
      const monthKey = txnDate.toISOString().slice(0, 7);

      // Initialize monthly data
      if (!monthlyBuckets[monthKey]) {
        monthlyBuckets[monthKey] = {
          income: 0,
          fixedCosts: 0,
          investments: 0,
          savings: 0,
          guiltFree: 0
        };
      }

      // Check if income
      if (INCOME_CATEGORIES.includes(txn.category_name)) {
        const payeeName = txn.payee_name || 'Unknown';
        const categoryId = txn.category_id;
        const categoryName = txn.category_name || 'Uncategorized';

        // Track all income by payee for the UI
        if (!incomeByPayee.has(payeeName)) {
          incomeByPayee.set(payeeName, { name: payeeName, amount: 0, transactionCount: 0 });
        }
        const payeeData = incomeByPayee.get(payeeName);

        // Track income by category for the UI
        if (!incomeByCategory.has(categoryId)) {
          incomeByCategory.set(categoryId, {
            id: categoryId,
            name: categoryName,
            amount: 0,
            transactionCount: 0
          });
        }
        const categoryData = incomeByCategory.get(categoryId);
        payeeData.amount += amount;
        payeeData.transactionCount++;
        categoryData.amount += amount;
        categoryData.transactionCount++;

        // Only count income if payee AND category are not excluded
        const isPayeeExcluded = excludedPayees.has(payeeName);
        const isCategoryExcluded = excludedCategories.has(categoryId);

        if (!isPayeeExcluded && !isCategoryExcluded) {
          totalIncome += amount;
          monthlyBuckets[monthKey].income += amount;
        }
        return;
      }

      // Process both expenses (negative) and savings/investment inflows (positive non-income)
      // Expenses are negative amounts (outflows from budget)
      // Some savings categories may have positive amounts (inflows like reimbursements, sale proceeds)

      const isExpense = amount < 0;
      const expenseAmount = Math.abs(amount);

      // Determine bucket for this category
      const bucket = categorizeTransaction(
        txn.category_id,
        categoryInfo.name,
        categoryInfo.groupName,
        categoryMappings,
        settings.useKeywordFallback
      );

      // DEBUG: Log mortgage category processing
      if (categoryInfo.name?.toLowerCase().includes('mortgage')) {
        console.log('[CSP BUCKET DEBUG] Mortgage category bucket assignment:', {
          categoryId: txn.category_id,
          categoryName: categoryInfo.name,
          mappedBucket: categoryMappings[txn.category_id],
          assignedBucket: bucket,
          amount: amount / 1000,
          isExpense: amount < 0
        });
      }

      // Track by category (always, for UI purposes - both expenses and positive amounts)
      const catKey = categoryInfo.name || 'Uncategorized';
      if (!categoryTotals.has(catKey)) {
        categoryTotals.set(catKey, {
          id: txn.category_id,
          name: catKey,
          bucket,
          amount: 0,
          excludedAmount: 0,
          groupName: categoryInfo.groupName,
          transactionCount: 0
        });
      }
      const catData = categoryTotals.get(catKey);
      catData.transactionCount++;

      // Check if this expense category is excluded
      const isExpenseCategoryExcluded = excludedExpenseCategories.has(txn.category_id);

      // Handle expenses and refunds
      if (isExpense) {
        // Normal expense - add to bucket
        if (isExpenseCategoryExcluded) {
          // Track excluded amount separately for UI
          catData.excludedAmount += expenseAmount;
        } else {
          // Track amount by category - bucket totals calculated later using current mappings
          catData.amount += expenseAmount;
          // Also track by month for charts (we'll recalculate with proper buckets below)
          if (!catData.monthlyAmounts) {
            catData.monthlyAmounts = {};
          }
          if (!catData.monthlyAmounts[monthKey]) {
            catData.monthlyAmounts[monthKey] = 0;
          }
          catData.monthlyAmounts[monthKey] += expenseAmount;
        }
      } else if (amount > 0 && !INCOME_CATEGORIES.includes(txn.category_name)) {
        // Refund/return - subtract from bucket (matching YNAB behavior)
        if (!isExpenseCategoryExcluded) {
          catData.amount -= amount;
          if (!catData.monthlyAmounts) {
            catData.monthlyAmounts = {};
          }
          if (!catData.monthlyAmounts[monthKey]) {
            catData.monthlyAmounts[monthKey] = 0;
          }
          catData.monthlyAmounts[monthKey] -= amount;
        }
      }
    });

    // Calculate monthly averages
    // For "This Month" (periodMonths=0), force numMonths=1 since it's partial month data
    const numMonths = periodMonths === 0 ? 1 : Math.max(1, Object.keys(monthlyBuckets).length);
    const monthlyIncome = totalIncome / numMonths;

    // NOW calculate bucket totals using current category mappings
    // This ensures custom mappings are respected
    const recalculatedBucketTotals = {
      fixedCosts: 0,
      investments: 0,
      savings: 0,
      guiltFree: 0
    };

    // Also recalculate monthly buckets for charts
    const recalculatedMonthlyBuckets = {};
    Object.keys(monthlyBuckets).forEach(monthKey => {
      recalculatedMonthlyBuckets[monthKey] = {
        income: monthlyBuckets[monthKey].income,
        fixedCosts: 0,
        investments: 0,
        savings: 0,
        guiltFree: 0
      };
    });

    // Iterate through all categories and assign amounts to buckets based on current mappings
    // For SAVINGS categories, use MONTHLY BUDGETED amounts (what you're contributing), not accumulated balance
    const bucketDebug = { fixedCosts: [], investments: [], savings: [], guiltFree: [] };
    categoryTotals.forEach((catData, catKey) => {
      // Determine the current bucket for this category
      // Priority: 1) Custom mapping, 2) Inferred bucket (if keyword fallback enabled), 3) Original bucket
      const inferredBucket = settings.useKeywordFallback !== false
        ? getInferredBucket(catData.name, catData.groupName)
        : null;
      const currentBucket = categoryMappings[catData.id] || inferredBucket || catData.bucket || 'guiltFree';

      // Use actual transaction amounts for all buckets (savings, investments, fixed costs, guilt-free)
      // This ensures CSP accurately reflects real money movement, not just budgeted intentions
      // Previously savings used budgeted amounts which hid large one-time transfers (like house sale proceeds)
      let amountToUse = catData.amount;
      let monthlyAmountsToUse = catData.monthlyAmounts || {};

      // Ensure amounts don't go negative from refunds exceeding purchases
      if (amountToUse < 0) amountToUse = 0;
      Object.keys(monthlyAmountsToUse).forEach(key => {
        if (monthlyAmountsToUse[key] < 0) monthlyAmountsToUse[key] = 0;
      });

      // Debug: track what goes into each bucket (include group name)
      if (amountToUse !== 0) {
        bucketDebug[currentBucket]?.push({
          name: catKey,
          group: catData.groupName || 'Unknown',
          amount: amountToUse,
          hasCustomMapping: !!categoryMappings[catData.id]
        });
      }

      // Add to bucket totals
      recalculatedBucketTotals[currentBucket] += amountToUse;

      // Update catData for display purposes
      catData.bucket = currentBucket;
      catData.displayAmount = amountToUse; // Store the amount we're using for display

      // Add to monthly buckets for charts
      Object.entries(monthlyAmountsToUse).forEach(([monthKey, amount]) => {
        if (recalculatedMonthlyBuckets[monthKey]) {
          recalculatedMonthlyBuckets[monthKey][currentBucket] += amount;
        }
      });
    });

    // Debug output: show what categories went into each bucket
    console.log('[CSP DEBUG] Period:', periodMonths, 'months');
    console.log('[CSP DEBUG] Date range:', startDate.toISOString().slice(0, 10), 'to', endDate ? endDate.toISOString().slice(0, 10) : 'now');
    console.log('[CSP DEBUG] Months with data:', Object.keys(recalculatedMonthlyBuckets).sort());
    console.log('[CSP DEBUG] numMonths used for averaging:', numMonths);
    console.log('[CSP DEBUG] categoryMappings keys:', Object.keys(categoryMappings));
    console.log('[CSP DEBUG] categoryMappings:', categoryMappings);
    console.log('[CSP DEBUG] Fixed Costs categories:', bucketDebug.fixedCosts.sort((a, b) => b.amount - a.amount));
    console.log('[CSP DEBUG] Fixed Costs total:', recalculatedBucketTotals.fixedCosts);
    console.log('[CSP DEBUG] Guilt-Free total:', recalculatedBucketTotals.guiltFree);

    // Also check for savings categories that have Available balances but NO transactions
    // These won't be in categoryTotals yet, so we need to add them
    // This is critical for savings goals where you accumulate money but don't spend from them
    // IMPORTANT: Only do this for multi-month views. For 30-day snapshot, we want actual transactions only
    // to match the income timing (which also uses actual transactions)
    if (categoryBudgetedAmounts.size > 0 && periodMonths > 1) {
      const processedCategoryIds = new Set(Array.from(categoryTotals.values()).map(c => c.id));

      categoryBudgetedAmounts.forEach((budgetedData, categoryId) => {
        // Skip if we already processed this category from transactions
        if (processedCategoryIds.has(categoryId)) {
          return;
        }

        // For CSP, we want MONTHLY CONTRIBUTION to savings, not accumulated balance
        // Use monthlyBudgeted (what was assigned this month) as the primary measure
        // Fall back to available only if monthlyBudgeted is 0 and available is reasonable
        const monthlyContribution = budgetedData.monthlyBudgeted || 0;

        // Skip if no monthly contribution (we don't want accumulated balances)
        if (monthlyContribution <= 0) {
          return;
        }

        const categoryName = budgetedData.categoryName || 'Unknown Category';
        const groupName = budgetedData.groupName || '';

        // Only use custom mappings - check if explicitly mapped to savings
        const mappedBucket = categoryMappings[categoryId];

        // Only add if this is explicitly mapped to savings
        if (mappedBucket !== 'savings') {
          return;
        }

        // Create monthly amounts using the monthly budgeted amount
        // This represents actual savings contribution, not accumulated balance
        const monthlyAmounts = {};
        const now = new Date();
        for (let i = 0; i < periodMonths; i++) {
          const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthKey = monthDate.toISOString().slice(0, 7);
          // Use the current month's budgeted amount as a proxy for all months
          // (YNAB only gives us current month's budget, not historical)
          monthlyAmounts[monthKey] = monthlyContribution;
        }

        // Total for the period = monthly contribution × number of months
        const totalForPeriod = monthlyContribution * periodMonths;

        // Add this savings category with MONTHLY CONTRIBUTION (not accumulated balance)
        categoryTotals.set(categoryName, {
          id: categoryId,
          name: categoryName,
          bucket: 'savings',
          amount: totalForPeriod,
          displayAmount: totalForPeriod,
          excludedAmount: 0,
          groupName: groupName,
          transactionCount: 0,
          monthlyAmounts: monthlyAmounts,
          // Store the accumulated balance separately for reference
          accumulatedBalance: budgetedData.available
        });

        // Add to bucket totals (monthly contribution × period)
        recalculatedBucketTotals.savings += totalForPeriod;

        // Add to monthly buckets
        Object.entries(monthlyAmounts).forEach(([monthKey, amount]) => {
          if (recalculatedMonthlyBuckets[monthKey]) {
            recalculatedMonthlyBuckets[monthKey].savings += amount;
          }
        });
      });
    }

    // Use the recalculated totals
    // Calculate Guilt-Free as REMAINDER per Ramit's CSP formula:
    // Guilt-Free = Income - Fixed Costs - Investments - Savings
    // This ensures all 4 buckets always add to exactly 100%
    const fixedCostsMonthly = recalculatedBucketTotals.fixedCosts / numMonths;
    const investmentsMonthly = recalculatedBucketTotals.investments / numMonths;
    const savingsMonthly = recalculatedBucketTotals.savings / numMonths;
    const guiltFreeMonthly = monthlyIncome - fixedCostsMonthly - investmentsMonthly - savingsMonthly;

    // Use actual spending for all buckets (don't override guilt-free with remainder)
    // This shows what was ACTUALLY spent in each category
    // Percentages may exceed 100% if spending exceeds income - that's informative!
    const adjustedBucketTotals = recalculatedBucketTotals;

    const totalSpending = Object.values(adjustedBucketTotals).reduce((sum, val) => sum + val, 0);
    const monthlySpending = totalSpending / numMonths;

    const buckets = {};
    Object.entries(adjustedBucketTotals).forEach(([key, total]) => {
      const monthlyAmount = total / numMonths;
      const percentage = monthlyIncome > 0 ? (monthlyAmount / monthlyIncome) * 100 : 0;

      // Get categories for this bucket (bucket was already updated to current mapping above)
      // Use displayAmount for savings categories (budgeted amount) instead of spent amount
      const bucketCategories = Array.from(categoryTotals.values())
        .filter(cat => cat.bucket === key)
        .map(cat => ({
          ...cat,
          monthlyAmount: (cat.displayAmount || cat.amount) / numMonths
        }))
        .sort((a, b) => b.monthlyAmount - a.monthlyAmount);

      // Determine if bucket is on target based on the Ramit Sethi approach:
      // - For fixedCosts/guiltFree: only a problem if ABOVE max (overspending)
      // - For investments/savings: only a problem if BELOW min (under-saving)
      let isOnTarget;
      if (key === 'fixedCosts' || key === 'guiltFree') {
        // These buckets are fine unless you're overspending
        isOnTarget = percentage <= CSP_TARGETS[key].max;
      } else {
        // investments and savings - these buckets are fine unless you're under-saving
        isOnTarget = percentage >= CSP_TARGETS[key].min;
      }

      buckets[key] = {
        amount: monthlyAmount,
        total,
        percentage: Math.round(percentage * 10) / 10,
        target: CSP_TARGETS[key],
        categories: bucketCategories,
        isOnTarget,
        difference: percentage - CSP_TARGETS[key].max
      };
    });

    // Build monthly chart data (using recalculated buckets with current mappings)
    // Use actual spending for each bucket (no remainder calculation)
    const monthlyData = Object.entries(recalculatedMonthlyBuckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-periodMonths)
      .map(([monthKey, data]) => {
        const date = new Date(monthKey + '-01');
        return {
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          monthKey,
          income: data.income,
          fixedCosts: data.fixedCosts,
          investments: data.investments,
          savings: data.savings,
          guiltFree: data.guiltFree  // Use actual guilt-free spending
        };
      });

    // Generate suggestions
    // Only warn about things that matter:
    // - Above target for fixedCosts or guiltFree (overspending)
    // - Below target for investments or savings (under-saving)
    const suggestions = [];

    if (buckets.fixedCosts.percentage > CSP_TARGETS.fixedCosts.max) {
      suggestions.push({
        type: 'warning',
        bucket: 'fixedCosts',
        message: `Your fixed costs are ${Math.round(buckets.fixedCosts.percentage)}% of income. Consider reducing to under ${CSP_TARGETS.fixedCosts.max}%.`
      });
    }

    if (buckets.guiltFree.percentage > CSP_TARGETS.guiltFree.max) {
      suggestions.push({
        type: 'warning',
        bucket: 'guiltFree',
        message: `Your guilt-free spending is ${Math.round(buckets.guiltFree.percentage)}% of income. Consider reducing to under ${CSP_TARGETS.guiltFree.max}%.`
      });
    }

    if (buckets.investments.percentage < CSP_TARGETS.investments.min) {
      suggestions.push({
        type: 'alert',
        bucket: 'investments',
        message: `You're investing only ${Math.round(buckets.investments.percentage)}% of income. Try to reach at least ${CSP_TARGETS.investments.min}%.`
      });
    }

    if (buckets.savings.percentage < CSP_TARGETS.savings.min) {
      suggestions.push({
        type: 'alert',
        bucket: 'savings',
        message: `Your savings rate is ${Math.round(buckets.savings.percentage)}%. Aim for at least ${CSP_TARGETS.savings.min}% for goals.`
      });
    }

    // Check if overall plan is on track
    // On track if: not overspending on fixed costs or guilt-free, AND meeting invest+save minimums
    const isOnTrack =
      buckets.fixedCosts.percentage <= CSP_TARGETS.fixedCosts.max &&
      buckets.guiltFree.percentage <= CSP_TARGETS.guiltFree.max &&
      buckets.investments.percentage >= CSP_TARGETS.investments.min &&
      buckets.savings.percentage >= CSP_TARGETS.savings.min;

    // All categories sorted by amount
    const categoryBreakdown = Array.from(categoryTotals.values())
      .map(cat => ({
        ...cat,
        monthlyAmount: cat.amount / numMonths
      }))
      .sort((a, b) => b.monthlyAmount - a.monthlyAmount);

    // Build income payees list for exclusion UI, sorted by amount descending
    const incomePayees = Array.from(incomeByPayee.values())
      .map(payee => ({
        ...payee,
        monthlyAmount: payee.amount / numMonths,
        isExcluded: excludedPayees.has(payee.name)
      }))
      .sort((a, b) => b.amount - a.amount);

    // Build income categories list for exclusion UI
    const incomeCategories = Array.from(incomeByCategory.values())
      .map(cat => ({
        ...cat,
        monthlyAmount: cat.amount / numMonths,
        isExcluded: excludedCategories.has(cat.id)
      }))
      .sort((a, b) => b.amount - a.amount);

    // Build all expense categories list for bucket mapping UI
    // This should include ALL categories from YNAB, not just those with transactions
    // Ordered by category group as they appear in YNAB
    const allExpenseCategories = [];

    if (categories?.category_groups) {
      categories.category_groups.forEach((group, groupIndex) => {
        // Skip internal YNAB groups
        if (group.hidden || group.name === 'Internal Master Category') {
          return;
        }

        if (group.categories) {
          group.categories.forEach((cat, catIndex) => {
            // Skip hidden categories and income categories
            if (cat.hidden || INCOME_CATEGORIES.includes(cat.name)) {
              return;
            }

            // Get transaction data if it exists
            const txnData = categoryTotals.get(cat.name);
            const amount = txnData?.amount || 0;
            const excludedAmount = txnData?.excludedAmount || 0;
            const transactionCount = txnData?.transactionCount || 0;

            // Determine the bucket
            // Priority: 1) Custom mapping, 2) Inferred bucket (if keyword fallback enabled), 3) Original bucket
            const customBucket = categoryMappings[cat.id] || null;
            const inferredBucket = getInferredBucket(cat.name, group.name); // Keep for UI display
            const bucket = customBucket ||
              (settings.useKeywordFallback !== false ? inferredBucket : null) ||
              (txnData?.bucket) ||
              'guiltFree';

            allExpenseCategories.push({
              id: cat.id,
              name: cat.name,
              bucket,
              amount,
              excludedAmount,
              groupName: group.name,
              groupIndex,
              catIndex,
              transactionCount,
              totalAmount: amount + excludedAmount,
              monthlyAmount: amount / numMonths,
              monthlyExcludedAmount: excludedAmount / numMonths,
              customBucket,
              inferredBucket,
              isExcluded: excludedExpenseCategories.has(cat.id)
            });
          });
        }
      });
    }

    // Add categories that have transactions but are hidden in YNAB (e.g., mortgage/loan categories)
    // These won't appear in the category_groups loop above because they're hidden
    const addedCategoryIds = new Set(allExpenseCategories.map(c => c.id));
    categoryTotals.forEach((catData, catKey) => {
      // Skip if already added from visible categories
      if (addedCategoryIds.has(catData.id)) {
        return;
      }
      // Skip synthetic transfer categories (those we created for investment transfers)
      if (catData.id?.startsWith('transfer-')) {
        return;
      }
      // Skip if no category ID (uncategorized)
      if (!catData.id) {
        return;
      }

      // This is a hidden category with actual transactions - add it for mapping
      const customBucket = categoryMappings[catData.id] || null;
      const inferredBucket = getInferredBucket(catData.name, catData.groupName || 'Hidden Categories');
      const bucket = customBucket || catData.bucket || 'guiltFree';

      console.log('[CSP DEBUG] Adding hidden category with transactions:', catData.name, 'id:', catData.id, 'bucket:', bucket, 'customBucket:', customBucket);

      allExpenseCategories.push({
        id: catData.id,
        name: catData.name,
        bucket,
        amount: catData.amount,
        excludedAmount: catData.excludedAmount || 0,
        groupName: catData.groupName || 'Hidden Categories',
        groupIndex: 9999, // Put at end
        catIndex: 0,
        transactionCount: catData.transactionCount,
        totalAmount: catData.amount + (catData.excludedAmount || 0),
        monthlyAmount: catData.amount / numMonths,
        monthlyExcludedAmount: (catData.excludedAmount || 0) / numMonths,
        customBucket,
        inferredBucket,
        isExcluded: excludedExpenseCategories.has(catData.id),
        isHidden: true // Mark as hidden for UI styling
      });
    });

    // Sort by group order then category order (matching YNAB)
    allExpenseCategories.sort((a, b) => {
      if (a.groupIndex !== b.groupIndex) {
        return a.groupIndex - b.groupIndex;
      }
      return a.catIndex - b.catIndex;
    });

    // Calculate Net Worth totals
    const netWorthAssets = netWorthAccounts.assets.reduce((sum, acc) => sum + acc.balance, 0);
    const netWorthInvestments = netWorthAccounts.investments.reduce((sum, acc) => sum + acc.balance, 0);
    const netWorthSavings = netWorthAccounts.savings.reduce((sum, acc) => sum + acc.balance, 0);
    const netWorthDebt = netWorthAccounts.debt.reduce((sum, acc) => sum + Math.abs(acc.balance), 0);
    const netWorthTotal = netWorthAssets + netWorthInvestments + netWorthSavings - netWorthDebt;

    // Build pre-tax and post-tax investment summaries
    const preTaxInvestments = {
      amount: preTaxContributions.total,
      monthlyAmount: preTaxContributions.total / numMonths,
      accounts: Array.from(preTaxContributions.accounts.values()).map(acc => ({
        ...acc,
        monthlyAmount: acc.amount / numMonths
      }))
    };

    const postTaxInvestments = {
      amount: postTaxContributions.total,
      monthlyAmount: postTaxContributions.total / numMonths,
      accounts: Array.from(postTaxContributions.accounts.values()).map(acc => ({
        ...acc,
        monthlyAmount: acc.amount / numMonths
      }))
    };

    return {
      monthlyIncome,
      totalIncome,
      monthlySpending,
      totalSpending,
      buckets,
      categoryBreakdown,
      monthlyData,
      isOnTrack,
      suggestions,
      periodMonths: numMonths,
      incomePayees,
      incomeCategories,
      allExpenseCategories,
      // Net Worth data
      netWorth: {
        assets: netWorthAssets,
        investments: netWorthInvestments,
        savings: netWorthSavings,
        debt: netWorthDebt,
        total: netWorthTotal,
        breakdown: {
          assets: netWorthAccounts.assets,
          investments: netWorthAccounts.investments,
          savings: netWorthAccounts.savings,
          debt: netWorthAccounts.debt
        }
      },
      // Pre-tax vs post-tax investment contributions (period totals)
      preTaxInvestments,
      postTaxInvestments
    };
  }, [transactions, categories, accounts, periodMonths, categoryMappings, excludedCategories, excludedPayees, excludedExpenseCategories, settings, months]);
}
