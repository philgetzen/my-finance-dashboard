import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useFinanceData } from '../contexts/ConsolidatedDataContext';

// LocalStorage key for demo mode
const INCOME_SCENARIO_KEY = 'income_scenario';

// CSP bucket configuration
export const EXPENSE_BUCKETS = {
  fixedCosts: { label: 'Fixed Costs', description: 'Rent, utilities, insurance' },
  investments: { label: 'Investments', description: '401k, IRA, brokerage' },
  savings: { label: 'Savings', description: 'Emergency fund, goals' },
  guiltFree: { label: 'Guilt-Free', description: 'Discretionary spending' }
};

// Default expense buckets (all included)
const DEFAULT_EXPENSE_BUCKETS = {
  fixedCosts: true,
  investments: true,
  savings: true,
  guiltFree: true
};

// Default scenario state
const DEFAULT_SCENARIO = {
  enabled: false,
  salary: { annual: 0 },
  bonus: { annual: 0, frequency: 'annual' },
  stock: { annualValue: 0 },
  expenseBuckets: DEFAULT_EXPENSE_BUCKETS
};

/**
 * Calculate monthly income from scenario values
 * @param {Object} scenario - The income scenario object
 * @returns {number} Monthly income
 */
export function calculateScenarioMonthlyIncome(scenario) {
  if (!scenario) return 0;

  const salaryAnnual = scenario.salary?.annual || 0;
  const bonusAnnual = scenario.bonus?.annual || 0;
  const stockAnnual = scenario.stock?.annualValue || 0;

  return (salaryAnnual + bonusAnnual + stockAnnual) / 12;
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

  // Expense bucket filters
  const expenseBuckets = useMemo(() => {
    return scenario.expenseBuckets || DEFAULT_EXPENSE_BUCKETS;
  }, [scenario.expenseBuckets]);

  // Check if any expense buckets have been modified from default
  const hasExpenseFilters = useMemo(() => {
    const buckets = scenario.expenseBuckets || DEFAULT_EXPENSE_BUCKETS;
    return Object.values(buckets).some(v => v === false);
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
      salary: { ...prev.salary, annual: Math.max(0, annual || 0) }
    }));
  }, []);

  const setBonus = useCallback((annual, frequency = 'annual') => {
    setScenario(prev => ({
      ...prev,
      bonus: { annual: Math.max(0, annual || 0), frequency }
    }));
  }, []);

  const setStock = useCallback((annualValue) => {
    setScenario(prev => ({
      ...prev,
      stock: { ...prev.stock, annualValue: Math.max(0, annualValue || 0) }
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
    // Estimate annual from monthly historical average
    const estimatedAnnual = Math.round(historicalAvgIncome * 12);
    setScenario(prev => ({
      ...prev,
      salary: { annual: estimatedAnnual },
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

    // Computed values
    scenarioMonthlyIncome,
    effectiveMonthlyIncome,
    historicalAvgIncome,
    incomeDelta,
    hasScenarioValues,

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
