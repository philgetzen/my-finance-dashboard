import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useFinanceData } from '../contexts/ConsolidatedDataContext';
import { CSP_BUCKETS, CSP_TARGETS } from './useConsciousSpendingPlan';

// LocalStorage key for demo mode
const CSP_GOALS_KEY = 'csp_goals';

/**
 * Calculate CSP score based on bucket percentages
 * Reusable function extracted from CSPScoreRing component
 * @param {Object} percentages - { fixedCosts, investments, savings, guiltFree } as numbers
 * @returns {number} Score from 0-100
 */
export function calculateCSPScore(percentages) {
  const { fixedCosts = 0, investments = 0, savings = 0, guiltFree = 0 } = percentages;
  let score = 0;

  // Fixed costs: Good if <= max (25 points)
  if (fixedCosts <= CSP_TARGETS.fixedCosts.max) {
    score += 25;
  } else {
    const over = fixedCosts - CSP_TARGETS.fixedCosts.max;
    score += Math.max(0, 25 - over);
  }

  // Guilt-free: Good if <= max (25 points)
  if (guiltFree <= CSP_TARGETS.guiltFree.max) {
    score += 25;
  } else {
    const over = guiltFree - CSP_TARGETS.guiltFree.max;
    score += Math.max(0, 25 - over);
  }

  // Investments: Good if >= min (25 points)
  if (investments >= CSP_TARGETS.investments.min) {
    score += 25;
  } else {
    const ratio = investments / CSP_TARGETS.investments.min;
    score += Math.min(25, ratio * 25);
  }

  // Savings: Good if >= min (25 points)
  if (savings >= CSP_TARGETS.savings.min) {
    score += 25;
  } else {
    const ratio = savings / CSP_TARGETS.savings.min;
    score += Math.min(25, ratio * 25);
  }

  return Math.round(score);
}

/**
 * Generate a unique ID for goals
 */
function generateGoalId() {
  return `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hook to manage CSP Future Goals - draft state, projections, and persistence
 * @param {Object} actualCSPData - Current CSP data from useConsciousSpendingPlan
 * @returns {Object} Goal management state and actions
 */
export function useCSPGoals(actualCSPData) {
  const { user, isDemoMode } = useFinanceData();
  const userId = user?.uid;

  // Track if we're currently saving to prevent listener loops
  const isSaving = useRef(false);

  // Panel visibility
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Draft state (null = use actual value)
  const [draftIncome, setDraftIncome] = useState(null);
  const [draftBucketAmounts, setDraftBucketAmounts] = useState({});

  // Saved goals
  const [savedGoals, setSavedGoals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Currently loaded goal (for edit tracking)
  const [activeGoalId, setActiveGoalId] = useState(null);

  // ===============================
  // Computed Values
  // ===============================

  // Get actual values from CSP data with safe fallbacks
  const actualIncome = actualCSPData?.monthlyIncome ?? 0;
  const actualBuckets = useMemo(() => {
    const buckets = actualCSPData?.buckets ?? {};
    return {
      fixedCosts: buckets.fixedCosts?.amount ?? 0,
      investments: buckets.investments?.amount ?? 0,
      savings: buckets.savings?.amount ?? 0,
      guiltFree: buckets.guiltFree?.amount ?? 0
    };
  }, [actualCSPData]);

  const actualPercentages = useMemo(() => {
    const buckets = actualCSPData?.buckets ?? {};
    return {
      fixedCosts: buckets.fixedCosts?.percentage ?? 0,
      investments: buckets.investments?.percentage ?? 0,
      savings: buckets.savings?.percentage ?? 0,
      guiltFree: buckets.guiltFree?.percentage ?? 0
    };
  }, [actualCSPData]);

  const actualScore = useMemo(() => {
    return calculateCSPScore(actualPercentages);
  }, [actualPercentages]);

  // Effective values (draft overrides actual)
  const effectiveIncome = draftIncome ?? actualIncome;

  const effectiveBuckets = useMemo(() => {
    return Object.keys(CSP_BUCKETS).reduce((acc, key) => {
      acc[key] = draftBucketAmounts[key] ?? actualBuckets[key];
      return acc;
    }, {});
  }, [draftBucketAmounts, actualBuckets]);

  // Projected percentages based on effective values
  const projectedPercentages = useMemo(() => {
    const percentages = {};
    Object.keys(CSP_BUCKETS).forEach(key => {
      percentages[key] = effectiveIncome > 0
        ? (effectiveBuckets[key] / effectiveIncome) * 100
        : 0;
    });
    return percentages;
  }, [effectiveIncome, effectiveBuckets]);

  // Projected score
  const projectedScore = useMemo(() => {
    return calculateCSPScore(projectedPercentages);
  }, [projectedPercentages]);

  // Full projected data object
  const projectedData = useMemo(() => ({
    income: effectiveIncome,
    buckets: effectiveBuckets,
    percentages: projectedPercentages,
    score: projectedScore
  }), [effectiveIncome, effectiveBuckets, projectedPercentages, projectedScore]);

  // Deltas from actual
  const deltas = useMemo(() => ({
    income: effectiveIncome - actualIncome,
    buckets: Object.keys(CSP_BUCKETS).reduce((acc, key) => {
      acc[key] = effectiveBuckets[key] - actualBuckets[key];
      return acc;
    }, {}),
    percentages: Object.keys(CSP_BUCKETS).reduce((acc, key) => {
      acc[key] = projectedPercentages[key] - actualPercentages[key];
      return acc;
    }, {}),
    score: projectedScore - actualScore
  }), [effectiveIncome, actualIncome, effectiveBuckets, actualBuckets, projectedPercentages, actualPercentages, projectedScore, actualScore]);

  // Check if any changes have been made
  const hasChanges = useMemo(() => {
    if (draftIncome !== null) return true;
    return Object.values(draftBucketAmounts).some(v => v !== null && v !== undefined);
  }, [draftIncome, draftBucketAmounts]);

  // ===============================
  // Panel Actions
  // ===============================

  const resetDraft = useCallback(() => {
    setDraftIncome(null);
    setDraftBucketAmounts({});
    setActiveGoalId(null);
    setError(null);
  }, []);

  const openPanel = useCallback(() => {
    setIsPanelOpen(true);
    setError(null);
  }, []);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
    resetDraft();
  }, [resetDraft]);

  // ===============================
  // Bucket Amount Setter
  // ===============================

  const setDraftBucketAmount = useCallback((bucketKey, value) => {
    setDraftBucketAmounts(prev => ({
      ...prev,
      [bucketKey]: value
    }));
  }, []);

  // ===============================
  // Firestore / LocalStorage Persistence
  // ===============================

  // Load goals on mount
  useEffect(() => {
    if (isDemoMode || !userId) {
      // Load from localStorage for demo mode
      try {
        const stored = localStorage.getItem(CSP_GOALS_KEY);
        setSavedGoals(stored ? JSON.parse(stored) : []);
      } catch (e) {
        console.error('Failed to load goals from localStorage:', e);
        setSavedGoals([]);
      }
      setIsLoading(false);
      return;
    }

    // Load from Firestore with real-time sync
    const docRef = doc(db, 'csp_settings', userId);

    const unsubscribe = onSnapshot(docRef, (snap) => {
      // Skip if we're currently saving
      if (isSaving.current) return;

      if (snap.exists()) {
        const data = snap.data();
        setSavedGoals(data.goals || []);
      } else {
        setSavedGoals([]);
      }
      setIsLoading(false);
    }, (err) => {
      console.error('Error listening to CSP goals:', err);
      setError('Failed to load goals');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId, isDemoMode]);

  // Save goals to storage
  const saveGoalsToStorage = useCallback(async (goals) => {
    if (isDemoMode || !userId) {
      // Save to localStorage
      try {
        localStorage.setItem(CSP_GOALS_KEY, JSON.stringify(goals));
      } catch (e) {
        console.error('Failed to save goals to localStorage:', e);
        throw new Error('Failed to save goal');
      }
      return;
    }

    // Save to Firestore
    isSaving.current = true;
    try {
      const docRef = doc(db, 'csp_settings', userId);
      await setDoc(docRef, {
        goals,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error('Failed to save goals to Firestore:', e);
      throw new Error('Failed to save goal');
    } finally {
      // Small delay to prevent onSnapshot from overwriting
      setTimeout(() => {
        isSaving.current = false;
      }, 100);
    }
  }, [userId, isDemoMode]);

  // ===============================
  // Goal CRUD Operations
  // ===============================

  const saveGoal = useCallback(async (name) => {
    if (!name?.trim()) {
      setError('Please enter a goal name');
      return false;
    }

    const trimmedName = name.trim();

    // Create new goal from current draft state
    const newGoal = {
      id: generateGoalId(),
      name: trimmedName,
      createdAt: new Date().toISOString(),
      targetIncome: effectiveIncome,
      bucketAmounts: { ...effectiveBuckets }
    };

    try {
      setError(null);
      const updatedGoals = [...savedGoals, newGoal];
      await saveGoalsToStorage(updatedGoals);
      setSavedGoals(updatedGoals);
      setActiveGoalId(newGoal.id);
      return true;
    } catch (e) {
      setError(e.message || 'Failed to save goal');
      return false;
    }
  }, [effectiveIncome, effectiveBuckets, savedGoals, saveGoalsToStorage]);

  const loadGoal = useCallback((goalId) => {
    const goal = savedGoals.find(g => g.id === goalId);
    if (!goal) {
      setError('Goal not found');
      return false;
    }

    setDraftIncome(goal.targetIncome);
    setDraftBucketAmounts(goal.bucketAmounts || {});
    setActiveGoalId(goalId);
    setError(null);
    return true;
  }, [savedGoals]);

  const deleteGoal = useCallback(async (goalId) => {
    try {
      setError(null);
      const updatedGoals = savedGoals.filter(g => g.id !== goalId);
      await saveGoalsToStorage(updatedGoals);
      setSavedGoals(updatedGoals);

      // If we deleted the active goal, clear draft
      if (activeGoalId === goalId) {
        resetDraft();
      }
      return true;
    } catch (e) {
      setError(e.message || 'Failed to delete goal');
      return false;
    }
  }, [savedGoals, saveGoalsToStorage, activeGoalId, resetDraft]);

  const updateGoal = useCallback(async (goalId, updates) => {
    const goalIndex = savedGoals.findIndex(g => g.id === goalId);
    if (goalIndex === -1) {
      setError('Goal not found');
      return false;
    }

    try {
      setError(null);
      const updatedGoals = [...savedGoals];
      updatedGoals[goalIndex] = {
        ...updatedGoals[goalIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      await saveGoalsToStorage(updatedGoals);
      setSavedGoals(updatedGoals);
      return true;
    } catch (e) {
      setError(e.message || 'Failed to update goal');
      return false;
    }
  }, [savedGoals, saveGoalsToStorage]);

  // ===============================
  // Return API
  // ===============================

  return {
    // Panel state
    isPanelOpen,
    openPanel,
    closePanel,

    // Draft state
    draftIncome,
    setDraftIncome,
    draftBucketAmounts,
    setDraftBucketAmount,
    hasChanges,
    resetDraft,

    // Actual values (for comparison)
    actualIncome,
    actualBuckets,
    actualPercentages,
    actualScore,

    // Projected values
    projectedData,
    deltas,

    // Saved goals
    savedGoals,
    activeGoalId,
    saveGoal,
    loadGoal,
    deleteGoal,
    updateGoal,

    // Loading/error state
    isLoading,
    error,
    setError
  };
}

export default useCSPGoals;
