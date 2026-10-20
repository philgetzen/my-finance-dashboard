import { afterEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({ currentUser: null }));
vi.mock('../firebase', () => ({ auth: authState, db: {} }));

import { authFetch } from '../lib/authFetch';
import { ynabService } from '../lib/ynabApi';

const signIn = (token = 'id-token-123') => {
  authState.currentUser = { uid: 'alice', getIdToken: vi.fn().mockResolvedValue(token) };
};

describe('authFetch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    authState.currentUser = null;
  });

  it('sends the Firebase ID token as a bearer header and keeps other headers', async () => {
    signIn();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });

    await authFetch('/api/manual_accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/manual_accounts');
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer id-token-123');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('refuses to call the API when nobody is signed in', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(authFetch('/api/ynab/token')).rejects.toThrow(/not signed in/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('ynabService token refresh', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    authState.currentUser = null;
    ynabService.init(null, null, null);
  });

  it('authenticates the refresh call and no longer sends user_id', async () => {
    signIn('id-token-xyz');
    ynabService.init('old-access', 'old-refresh', 'alice');
    vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'new-access', refresh_token: 'new-refresh' })
    });

    await ynabService._doRefresh();

    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url, 'http://localhost').pathname).toBe('/api/ynab/refresh_token');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer id-token-xyz');
    expect(JSON.parse(init.body)).toEqual({ refresh_token: 'old-refresh' });
  });
});
