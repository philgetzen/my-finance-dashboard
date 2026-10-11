import { afterEach, describe, expect, it, vi } from 'vitest';
import { ynabService } from '../lib/ynabApi';

describe('ynabService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    ynabService.init(null, null, null);
  });

  it('fetches scheduled transactions through the Vercel query-param proxy', async () => {
    ynabService.init('access-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { scheduled_transactions: [] } })
    });

    await ynabService.getScheduledTransactions('last-used');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(requestUrl.pathname).toBe('/api/ynab/budgets');
    expect(requestUrl.searchParams.get('budgetId')).toBe('last-used');
    expect(requestUrl.searchParams.get('resource')).toBe('scheduled_transactions');
  });
});

describe('ynabService.getBudgetSummary failures', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    ynabService.init(null, null, null);
  });

  const respond = (failing) => vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const resource = new URL(url).searchParams.get('resource');
    if (failing.includes(resource)) return { ok: false, status: 400, json: async () => ({ error: 'boom' }), text: async () => 'boom' };
    return { ok: true, json: async () => ({ data: { budgets: [], accounts: [{ id: 'a1' }], transactions: [{ id: 't1' }], category_groups: [], months: [], scheduled_transactions: [] } }) };
  });

  it('rejects when transactions fail instead of returning partial data', async () => {
    ynabService.init('access-token');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    respond(['transactions']);
    await expect(ynabService.getBudgetSummary('last-used')).rejects.toThrow();
  });

  it('rejects when accounts fail', async () => {
    ynabService.init('access-token');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    respond(['accounts']);
    await expect(ynabService.getBudgetSummary('last-used')).rejects.toThrow();
  });

  it('still resolves when only categories or months fail', async () => {
    ynabService.init('access-token');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    respond(['categories', 'months']);
    const summary = await ynabService.getBudgetSummary('last-used');
    expect(summary.accounts).toEqual([{ id: 'a1' }]);
    expect(summary.categories).toEqual({ category_groups: [] });
  });
});
