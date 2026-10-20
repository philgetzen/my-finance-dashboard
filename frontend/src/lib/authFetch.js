import { auth } from '../firebase';

// fetch() for the app's own /api routes: attaches the signed-in user's
// Firebase ID token so the server can verify who is calling.
export async function authFetch(url, options = {}) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Not signed in');
  }

  const idToken = await user.getIdToken();
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${idToken}`);

  return fetch(url, { ...options, headers });
}
