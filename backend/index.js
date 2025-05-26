// backend/index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const serviceAccount = require('./firebaseServiceAccount.json');
const axios = require('axios');

dotenv.config();

console.log('Loaded ENV:', {
  YNAB_CLIENT_ID: process.env.YNAB_CLIENT_ID,
  YNAB_CLIENT_SECRET: process.env.YNAB_CLIENT_SECRET ? '***' : undefined,
  YNAB_REDIRECT_URI: process.env.YNAB_REDIRECT_URI,
});

const app = express();

// Configure CORS to allow your Netlify domain
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173', // Vite dev server
    'https://serene-kelpie-1319e6.netlify.app', // Your Netlify domain
    'https://my-finance-dashboard.onrender.com' // Your backend domain
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const YNAB_CLIENT_ID = process.env.YNAB_CLIENT_ID;
const YNAB_CLIENT_SECRET = process.env.YNAB_CLIENT_SECRET;
const YNAB_REDIRECT_URI = process.env.YNAB_REDIRECT_URI || 'http://localhost:5173/auth/ynab/callback';
const YNAB_API_BASE_URL = 'https://api.ynab.com/v1';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
  // credential: admin.credential.applicationDefault(),
});
const db = admin.firestore();

app.get('/', (req, res) => {
  res.send('YNAB backend is running!');
});

// YNAB OAuth endpoints
app.get('/api/ynab/auth', (req, res) => {
  const authUrl = `https://app.ynab.com/oauth/authorize?client_id=${YNAB_CLIENT_ID}&redirect_uri=${encodeURIComponent(YNAB_REDIRECT_URI)}&response_type=code`;
  res.json({ authUrl });
});

app.post('/api/ynab/token', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }
  
  try {
    const response = await axios.post('https://app.ynab.com/oauth/token', {
      client_id: YNAB_CLIENT_ID,
      client_secret: YNAB_CLIENT_SECRET,
      redirect_uri: YNAB_REDIRECT_URI,
      grant_type: 'authorization_code',
      code
    });
    
    const { access_token, refresh_token } = response.data;
    res.json({ access_token, refresh_token });
  } catch (error) {
    console.error('Error exchanging YNAB code:', error.response?.data || error.message);
    res.status(500).json({ error: 'Unable to exchange authorization code' });
  }
});

// YNAB API proxy endpoints
app.get('/api/ynab/budgets', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' });
  }
  
  try {
    const response = await axios.get(`${YNAB_API_BASE_URL}/budgets`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching budgets:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Unable to fetch budgets' });
  }
});

app.get('/api/ynab/budgets/:budgetId/accounts', async (req, res) => {
  const { budgetId } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' });
  }
  
  try {
    const response = await axios.get(`${YNAB_API_BASE_URL}/budgets/${budgetId}/accounts`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching accounts:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Unable to fetch accounts' });
  }
});

app.get('/api/ynab/budgets/:budgetId/transactions', async (req, res) => {
  const { budgetId } = req.params;
  const { since_date } = req.query;
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' });
  }
  
  try {
    let url = `${YNAB_API_BASE_URL}/budgets/${budgetId}/transactions`;
    if (since_date) {
      url += `?since_date=${since_date}`;
    }
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching transactions:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Unable to fetch transactions' });
  }
});

app.get('/api/ynab/budgets/:budgetId/categories', async (req, res) => {
  const { budgetId } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' });
  }
  
  try {
    const response = await axios.get(`${YNAB_API_BASE_URL}/budgets/${budgetId}/categories`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching categories:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Unable to fetch categories' });
  }
});

app.get('/api/ynab/budgets/:budgetId/months', async (req, res) => {
  const { budgetId } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' });
  }
  
  try {
    const response = await axios.get(`${YNAB_API_BASE_URL}/budgets/${budgetId}/months`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching months:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Unable to fetch months' });
  }
});

// Save YNAB tokens to Firestore
app.post('/api/ynab/save_token', async (req, res) => {
  const { user_id, access_token, refresh_token } = req.body;
  if (!user_id || !access_token) {
    return res.status(400).json({ error: 'user_id and access_token are required' });
  }
  
  try {
    const userDocRef = db.collection('ynab_tokens').doc(user_id);
    await userDocRef.set({
      access_token,
      refresh_token,
      updated_at: new Date().toISOString()
    }, { merge: true });
    
    console.log('Successfully saved YNAB tokens for user:', user_id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving YNAB token:', error.message);
    res.status(500).json({ error: 'Unable to save YNAB token' });
  }
});

// Get YNAB token from Firestore
app.get('/api/ynab/token', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }
  
  try {
    const doc = await db.collection('ynab_tokens').doc(user_id).get();
    if (!doc.exists) {
      return res.json({ access_token: null, refresh_token: null });
    }
    
    const { access_token, refresh_token } = doc.data();
    res.json({ access_token, refresh_token });
  } catch (error) {
    console.error('Error fetching YNAB token:', error);
    res.status(500).json({ error: 'Unable to fetch YNAB token' });
  }
});

// Remove YNAB connection
app.delete('/api/ynab/disconnect', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }
  
  try {
    await db.collection('ynab_tokens').doc(user_id).delete();
    console.log('Successfully disconnected YNAB for user:', user_id);
    res.json({ success: true, message: 'YNAB disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting YNAB:', error);
    res.status(500).json({ error: 'Unable to disconnect YNAB' });
  }
});

// Get manual accounts from Firestore
app.get('/api/manual_accounts', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }
  
  try {
    const snapshot = await db.collection('manual_accounts')
      .where('userId', '==', user_id)
      .get();
    
    const accounts = [];
    snapshot.forEach(doc => {
      accounts.push({ id: doc.id, ...doc.data() });
    });
    
    res.json({ accounts });
  } catch (error) {
    console.error('Error fetching manual accounts:', error);
    res.status(500).json({ error: 'Unable to fetch manual accounts' });
  }
});

// Create manual account
app.post('/api/manual_accounts', async (req, res) => {
  const { user_id, account } = req.body;
  if (!user_id || !account) {
    return res.status(400).json({ error: 'user_id and account data are required' });
  }
  
  try {
    const docRef = await db.collection('manual_accounts').add({
      ...account,
      userId: user_id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    res.json({ id: docRef.id, ...account });
  } catch (error) {
    console.error('Error creating manual account:', error);
    res.status(500).json({ error: 'Unable to create manual account' });
  }
});

// Update manual account
app.put('/api/manual_accounts/:accountId', async (req, res) => {
  const { accountId } = req.params;
  const { account } = req.body;
  if (!account) {
    return res.status(400).json({ error: 'account data is required' });
  }
  
  try {
    await db.collection('manual_accounts').doc(accountId).update({
      ...account,
      updatedAt: new Date().toISOString()
    });
    
    res.json({ id: accountId, ...account });
  } catch (error) {
    console.error('Error updating manual account:', error);
    res.status(500).json({ error: 'Unable to update manual account' });
  }
});

// Delete manual account
app.delete('/api/manual_accounts/:accountId', async (req, res) => {
  const { accountId } = req.params;
  
  try {
    await db.collection('manual_accounts').doc(accountId).delete();
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting manual account:', error);
    res.status(500).json({ error: 'Unable to delete manual account' });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
