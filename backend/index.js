// backend/index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const admin = require('firebase-admin');
const serviceAccount = require('./firebaseServiceAccount.json');

// ...existing imports and setup...

app.get('/api/access_tokens', async (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'user_id is required' });

  try {
    const userTokensDoc = await db.collection('user_tokens').doc(userId).get();
    if (!userTokensDoc.exists) return res.json([]);
    const tokens = userTokensDoc.data().tokens || [];
    res.json(tokens);
  } catch (error) {
    console.error('Error fetching access tokens:', error);
    res.status(500).json({ error: 'Unable to fetch access tokens' });
  }
});

dotenv.config();

console.log('Loaded ENV:', {
  PLAID_CLIENT_ID: process.env.PLAID_CLIENT_ID,
  PLAID_SECRET: process.env.PLAID_SECRET ? '***' : undefined,
  PLAID_ENV: process.env.PLAID_ENV,
});

const app = express();
app.use(cors());
app.use(express.json());

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
      'PLAID-SECRET': PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(configuration);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

app.get('/', (req, res) => {
  res.send('Plaid backend is running!');
});

app.post('/api/create_link_token', async (req, res) => {
  console.log('Received request to /api/create_link_token');
  try {
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: 'unique-user-id', // Replace with real user id in production
      },
      client_name: 'My Finance Dashboard',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
      redirect_uri: undefined, // Set if using OAuth
    });
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Error creating link token:', error);
    res.status(500).json({ error: 'Unable to create link token' });
  }
});

app.post('/api/exchange_public_token', async (req, res) => {
  const { public_token } = req.body;
  if (!public_token) {
    return res.status(400).json({ error: 'public_token is required' });
  }
  try {
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const access_token = response.data.access_token;
    // In production, store access_token securely and associate with the user
    console.log('Access Token:', access_token);
    res.json({ access_token });
  } catch (error) {
    console.error('Error exchanging public token:', error);
    res.status(500).json({ error: 'Unable to exchange public token' });
  }
});

app.post('/api/accounts', async (req, res) => {
  const { access_token } = req.body;
  if (!access_token) {
    return res.status(400).json({ error: 'access_token is required' });
  }
  try {
    const response = await plaidClient.accountsGet({ access_token });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Unable to fetch accounts' });
  }
});

async function fetchTransactionsWithRetry(access_token, retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch('http://localhost:5001/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token }),
    });
    const data = await res.json();
    if (!data.error || data.error.error_code !== 'PRODUCT_NOT_READY') {
      return data;
    }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw new Error('Transactions not ready after several attempts.');
}

app.post('/api/transactions', async (req, res) => {
  const { access_token, start_date, end_date } = req.body;
  if (!access_token) {
    return res.status(400).json({ error: 'access_token is required' });
  }
  // Default to last 30 days if dates not provided
  const end = end_date || new Date().toISOString().slice(0, 10);
  const start = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  try {
    const response = await plaidClient.transactionsGet({
      access_token,
      start_date: start,
      end_date: end,
      options: { count: 100, offset: 0 },
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Unable to fetch transactions' });
  }
});

app.post('/api/save_access_token', async (req, res) => {
  const { user_id, access_token } = req.body;
  if (!user_id || !access_token) {
    console.error('Missing user_id or access_token');
    return res.status(400).json({ error: 'user_id and access_token are required' });
  }
  // Additional logging for debugging
  console.log('Received request to save access token:', { user_id, access_token });

  try {
    const userDocRef = db.collection('user_tokens').doc(user_id);
    const doc = await userDocRef.get();
    console.log('Document exists:', doc.exists);

    let tokens = [];
    if (doc.exists && doc.data().tokens) {
      tokens = doc.data().tokens;
      console.log('Existing tokens:', tokens);
    }

    // Avoid duplicates
    if (!tokens.includes(access_token)) {
      tokens.push(access_token);
      console.log('Added new access token:', access_token);
    } else {
      console.log('Access token already exists, not adding:', access_token);
    }

    const tokenPattern = /^access-(sandbox|development|production)-[a-z0-9-]+$/;
    if (!tokenPattern.test(access_token)) {
      console.error('Invalid access token format:', access_token);
      return res.status(400).json({ error: 'Invalid access token format' });
    }

    if (!doc.exists) {
      await userDocRef.set({ tokens: [] }); // Initialize with an empty tokens array
      console.log('Initialized new user document with empty tokens array');
    }

    await userDocRef.set({ tokens }, { merge: true });
    console.log('Successfully saved access tokens:', tokens);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving access token:', error.message);
    res.status(500).json({ error: 'Unable to save access token' });
  }
});

app.get('/api/access_tokens', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }
  try {
    const doc = await db.collection('user_tokens').doc(user_id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'No tokens found for this user' });
    }
    const tokens = doc.data().tokens || [];
    console.log('Retrieved tokens:', tokens);
    res.json({ tokens });
  } catch (error) {
    console.error('Error fetching access tokens:', error);
    res.status(500).json({ error: 'Unable to fetch access tokens' });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});