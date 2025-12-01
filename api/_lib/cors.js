const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
];

function handleCors(handler) {
  return async (req, res) => {
    const origin = req.headers.origin;

    // Allow Vercel preview URLs and production
    const isAllowed = !origin ||
      ALLOWED_ORIGINS.includes(origin) ||
      origin?.endsWith('.vercel.app');

    if (isAllowed && origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    return handler(req, res);
  };
}

module.exports = { handleCors };
