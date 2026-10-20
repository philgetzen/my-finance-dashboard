const { getFirebaseAdmin } = require('./firebase');

class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Verifies `Authorization: Bearer <Firebase ID token>` and returns the uid.
// Throws AuthError(401) for a missing, malformed, or unverifiable token.
async function requireUser(req) {
  const header = req.headers?.authorization || '';
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  if (!match) {
    throw new AuthError(401, 'Missing bearer token');
  }

  // Outside the try: a broken Admin SDK setup is a 500, not a bad token.
  const admin = getFirebaseAdmin();
  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    return decoded.uid;
  } catch {
    throw new AuthError(401, 'Invalid or expired token');
  }
}

// Wraps a handler so it only runs for a verified user and receives that uid.
// A client-supplied user_id is never trusted: one that disagrees with the
// token is refused with 403. Compose inside handleCors so preflight still works.
// The 401 code is UNAUTHENTICATED, distinct from the YNAB REAUTH_REQUIRED code.
function withUser(handler) {
  return async (req, res) => {
    let uid;
    try {
      uid = await requireUser(req);
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(error.status).json({ error: error.message, code: 'UNAUTHENTICATED' });
      }
      throw error;
    }

    const claimed = req.query?.user_id ?? req.body?.user_id;
    if (claimed !== undefined && claimed !== uid) {
      return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    }

    return handler(req, res, uid);
  };
}

// Owner of a Firestore document. Server routes write `userId`; client-written
// documents use `user_id`, the only field firestore.rules checks. A client can
// therefore set `userId` freely, so when both are present and disagree the
// document has no owner.
function ownerOf(data) {
  const { userId, user_id: legacyUserId } = data || {};
  if (userId !== undefined && legacyUserId !== undefined && userId !== legacyUserId) {
    return undefined;
  }
  return userId ?? legacyUserId;
}

module.exports = { requireUser, withUser, ownerOf, AuthError };
