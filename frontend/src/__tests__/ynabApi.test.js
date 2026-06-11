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
