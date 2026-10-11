import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useFinanceData } from '../contexts/ConsolidatedDataContext';

// LocalStorage key for demo mode
const INCOME_SCENARIO_KEY = 'income_scenario';

// Spending categories that can be cut in a scenario. Investing isn't
// spending, so it never counts toward burn and has no toggle.
export const EXPENSE_BUCKETS = {
  fixedCosts: { label: 'Fixed Costs', description: 'Rent, utilities, insurance' },
  savings: { label: 'Savings Goals', description: 'Purchases from sinking funds' },
  guiltFree: { label: 'Guilt-Free', description: 'Discretionary spending' }
};

// Default expense buckets (all included)
const DEFAULT_EXPENSE_BUCKETS = {
  fixedCosts: true,
  savings: true,
  guiltFree: true
};

// Share of gross pay that reaches your accounts after taxes and pre-tax
// deductions (401k, benefits). Historical income in YNAB is take-home pay.
export const DEFAULT_TAKE_HOME_RATE = 70;

// Default scenario state
const DEFAULT_SCENARIO = {
  enabled: false,
  // Explicit so clearing writes false over a saved true (Firestore merge keeps absent keys)
  incomeEdited: false,
  salary: { annual: 0 },
  bonus: { annual: 0, frequency: 'annual' },
  stock: { annualValue: 0 },
  takeHomeRate: DEFAULT_TAKE_HOME_RATE,
  expenseBuckets: DEFAULT_EXPENSE_BUCKETS
};

function takeHomeShare(scenario) {
  return (scenario?.takeHomeRate ?? DEFAULT_TAKE_HOME_RATE) / 100;
}

/**
 * Calculate monthly take-home income from scenario values.
 * Salary, bonus and stock are entered gross; spending is paid from take-home
 * pay, so the gross total is scaled by the take-home rate.
 * @param {Object} scenario - The income scenario object
 * @returns {number} Monthly take-home income
 */
export function calculateScenarioMonthlyIncome(scenario) {
  if (!scenario) return 0;

  const salaryAnnual = scenario.salary?.annual || 0;
  const bonusAnnual = scenario.bonus?.annual || 0;
  const stockAnnual = scenario.stock?.annualValue || 0;

  return ((salaryAnnual + bonusAnnual + stockAnnual) * takeHomeShare(scenario)) / 12;
}

/**
 * Income override for the runway calculator, or undefined to use history.
 * An enabled scenario whose income the user set to $0 means "no income" and
 * must yield 0, not fall back to the historical average. A scenario that
 * never had income entered (e.g. only expense filters) keeps history.
 */
export function resolveScenarioIncome({ isEnabled, hasScenarioValues, hasIncomeInput, scenarioMonthlyIncome }) {
  if (!isEnabled) return undefined;
  if (hasScenarioValues || hasIncomeInput) return scenarioMonthlyIncome;
  return undefined;
}

/**
 * Hook to manage Income Scenario for runway planning
 * Follows the same pattern as useCSPGoals for Firestore sync
 * @param {number} historicalAvgIncome - Historical average monthly income from runway calculator
 * @returns {Object} Scenario state and actions
 */
export function useIncomeScenario(historicalAvgIncome = 0) {
  const { user, isDemoMode } = useFinanceData();
  const userId = user?.uid;

  // Track if we're currently saving to prevent listener loops
  const isSaving = useRef(false);

  // Panel visibility
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Scenario state
  const [scenario, setScenario] = useState(DEFAULT_SCENARIO);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // ===============================
  // Computed Values
  // ===============================

  // Calculate monthly income from scenario
  const scenarioMonthlyIncome = useMemo(() => {
    return calculateScenarioMonthlyIncome(scenario);
  }, [scenario]);

  // The effective income to use in runway calculations
  // When scenario is enabled, use scenario income; otherwise use historical
  const effectiveMonthlyIncome = useMemo(() => {
    return scenario.enabled ? scenarioMonthlyIncome : historicalAvgIncome;
  }, [scenario.enabled, scenarioMonthlyIncome, historicalAvgIncome]);

  // Delta from historical average
  const incomeDelta = useMemo(() => {
    return scenarioMonthlyIncome - historicalAvgIncome;
  }, [scenarioMonthlyIncome, historicalAvgIncome]);

  // Check if scenario has meaningful values
  const hasScenarioValues = useMemo(() => {
    const salary = scenario.salary?.annual || 0;
    const bonus = scenario.bonus?.annual || 0;
    const stock = scenario.stock?.annualValue || 0;
    return salary > 0 || bonus > 0 || stock > 0;
  }, [scenario]);

  // True once the user has entered any income figure, including $0
  const hasIncomeInput = scenario.incomeEdited === true;

  // Expense bucket filters
  const expenseBuckets = useMemo(() => {
    return scenario.expenseBuckets || DEFAULT_EXPENSE_BUCKETS;
  }, [scenario.expenseBuckets]);

  // Check if any expense buckets have been modified from default
  // (ignores keys from older saved scenarios, like the removed investments toggle)
  const hasExpenseFilters = useMemo(() => {
    const buckets = scenario.expenseBuckets || DEFAULT_EXPENSE_BUCKETS;
    return Object.keys(EXPENSE_BUCKETS).some(key => buckets[key] === false);
  }, [scenario.expenseBuckets]);

  // ===============================
  // Panel Actions
  // ===============================

  const openPanel = useCallback(() => {
    setIsPanelOpen(true);
    setError(null);
  }, []);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  const togglePanel = useCallback(() => {
    setIsPanelOpen(prev => !prev);
  }, []);

  // ===============================
  // Scenario Actions
  // ===============================

  const setEnabled = useCallback((enabled) => {
    setScenario(prev => ({ ...prev, enabled }));
  }, []);

  const setSalary = useCallback((annual) => {
    setScenario(prev => ({
      ...prev,
      incomeEdited: true,
      salary: { ...prev.salary, annual: Math.max(0, annual || 0) }
    }));
  }, []);

  const setBonus = useCallback((annual, frequency = 'annual') => {
    setScenario(prev => ({
      ...prev,
      incomeEdited: true,
      bonus: { annual: Math.max(0, annual || 0), frequency }
    }));
  }, []);

  const setStock = useCallback((annualValue) => {
    setScenario(prev => ({
      ...prev,
      incomeEdited: true,
      stock: { ...prev.stock, annualValue: Math.max(0, annualValue || 0) }
    }));
  }, []);

  const setTakeHomeRate = useCallback((percent) => {
    const value = Number.isFinite(percent) ? percent : DEFAULT_TAKE_HOME_RATE;
    setScenario(prev => ({
      ...prev,
      takeHomeRate: Math.min(100, Math.max(1, value))
    }));
  }, []);

  // Toggle an expense bucket on/off
  const toggleExpenseBucket = useCallback((bucketKey) => {
    setScenario(prev => ({
      ...prev,
      expenseBuckets: {
        ...(prev.expenseBuckets || DEFAULT_EXPENSE_BUCKETS),
        [bucketKey]: !(prev.expenseBuckets?.[bucketKey] ?? true)
      }
    }));
  }, []);

  // Reset expense buckets to all included
  const resetExpenseBuckets = useCallback(() => {
    setScenario(prev => ({
      ...prev,
      expenseBuckets: DEFAULT_EXPENSE_BUCKETS
    }));
  }, []);

  // Reset to historical values (pre-fill with historical average)
  const resetToCurrent = useCallback(() => {
    setScenario(prev => ({
      ...prev,
      // Historical income is take-home; convert back to the gross salary that produces it
      incomeEdited: true,
      salary: { annual: Math.round((historicalAvgIncome * 12) / takeHomeShare(prev)) },
      bonus: { annual: 0, frequency: 'annual' },
      stock: { annualValue: 0 }
    }));
  }, [historicalAvgIncome]);

  // Clear all scenario values
  const clearScenario = useCallback(() => {
    setScenario(DEFAULT_SCENARIO);
  }, []);

  // ===============================
  // Firestore / LocalStorage Persistence
  // ===============================

  // Load scenario on mount
  useEffect(() => {
    if (isDemoMode || !userId) {
      // Load from localStorage for demo mode
      try {
        const stored = localStorage.getItem(INCOME_SCENARIO_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setScenario({ ...DEFAULT_SCENARIO, ...parsed });
        }
      } catch (e) {
        console.error('Failed to load income scenario from localStorage:', e);
      }
      setIsLoading(false);
      return;
    }

    // Load from Firestore with real-time sync
    const docRef = doc(db, 'income_scenarios', userId);

    const unsubscribe = onSnapshot(docRef, (snap) => {
      // Skip if we're currently saving
      if (isSaving.current) return;

      if (snap.exists()) {
        const data = snap.data();
        setScenario({ ...DEFAULT_SCENARIO, ...data.scenario });
      } else {
        setScenario(DEFAULT_SCENARIO);
      }
      setIsLoading(false);
    }, (err) => {
      console.error('Error listening to income scenario:', err);
      setError('Failed to load scenario');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId, isDemoMode]);

  // Save scenario when it changes (debounced via effect dependency)
  const saveScenario = useCallback(async (scenarioToSave) => {
    if (isDemoMode || !userId) {
      // Save to localStorage for demo mode
      try {
        localStorage.setItem(INCOME_SCENARIO_KEY, JSON.stringify(scenarioToSave));
      } catch (e) {
        console.error('Failed to save income scenario to localStorage:', e);
        throw new Error('Failed to save scenario');
      }
      return;
    }

    // Save to Firestore
    isSaving.current = true;
    try {
      const docRef = doc(db, 'income_scenarios', userId);
      await setDoc(docRef, {
        scenario: scenarioToSave,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error('Failed to save income scenario to Firestore:', e);
      throw new Error('Failed to save scenario');
    } finally {
      // Small delay to prevent onSnapshot from overwriting
      setTimeout(() => {
        isSaving.current = false;
      }, 100);
    }
  }, [userId, isDemoMode]);

  // Auto-save when scenario changes (after initial load)
  useEffect(() => {
    if (isLoading) return;

    const timeoutId = setTimeout(() => {
      saveScenario(scenario).catch(err => {
        setError(err.message);
      });
    }, 500); // Debounce saves by 500ms

    return () => clearTimeout(timeoutId);
  }, [scenario, isLoading, saveScenario]);

  // ===============================
  // Return API
  // ===============================

  return {
    // Panel state
    isPanelOpen,
    openPanel,
    closePanel,
    togglePanel,

    // Scenario state
    scenario,
    isEnabled: scenario.enabled,
    setEnabled,

    // Individual field setters
    salary: scenario.salary?.annual || 0,
    setSalary,
    bonus: scenario.bonus?.annual || 0,
    bonusFrequency: scenario.bonus?.frequency || 'annual',
    setBonus,
    stock: scenario.stock?.annualValue || 0,
    setStock,
    takeHomeRate: scenario.takeHomeRate ?? DEFAULT_TAKE_HOME_RATE,
    setTakeHomeRate,

    // Computed values
    scenarioMonthlyIncome,
    effectiveMonthlyIncome,
    historicalAvgIncome,
    incomeDelta,
    hasScenarioValues,
    hasIncomeInput,

    // Expense bucket filters
    expenseBuckets,
    hasExpenseFilters,
    toggleExpenseBucket,
    resetExpenseBuckets,

    // Actions
    resetToCurrent,
    clearScenario,

    // Loading/error state
    isLoading,
    error,
    setError
  };
}

export default useIncomeScenario;
