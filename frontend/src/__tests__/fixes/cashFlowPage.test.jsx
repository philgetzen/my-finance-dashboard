import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

const processorSpy = vi.fn(() => ({
  processedCategoryGroups: [],
  monthHeaders: [],
  grandTotals: { income: 0, expenses: 0, net: 0 },
  monthlySummaryTotals: {}
}));
const cspSettings = {
  categoryMappings: { cat1: 'savings' },
  excludedPayees: new Set(['Reimburser']),
  excludedCategories: new Set(),
  excludedExpenseCategories: new Set(['cat2']),
  settings: { useKeywordFallback: false }
};

vi.mock('../../firebase', () => ({ db: {}, auth: {} }));
vi.mock('../../contexts/ConsolidatedDataContext', () => ({
  useFinanceData: () => ({ ynabAccounts: [], ynabTransactions: [], ynabCategories: { category_groups: [] }, isLoading: false }),
  usePrivacy: () => ({ privacyMode: false })
}));
vi.mock('../../hooks/useConsciousSpendingPlan', () => ({ useCSPSettings: () => cspSettings }));
vi.mock('../../hooks/useCategoryProcessor', () => ({ useCategoryProcessor: (...args) => processorSpy(...args) }));
vi.mock('../../components/ui/PageTransition', () => ({ default: ({ children }) => children }));

import CashFlow from '../../components/pages/CashFlow';

describe('CashFlow page', () => {
  it('passes payee and expense-category exclusions to the processor', () => {
    render(<CashFlow />);
    const options = processorSpy.mock.calls.at(-1)[5];
    expect(options.cspSettings.excludedPayees).toBe(cspSettings.excludedPayees);
    expect(options.cspSettings.excludedExpenseCategories).toBe(cspSettings.excludedExpenseCategories);
    expect(options.cspSettings.categoryMappings).toBe(cspSettings.categoryMappings);
  });
});
