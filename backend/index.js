// backend/index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const axios = require('axios');
const fs = require('fs');

dotenv.config();

// Add startup logging
console.log('🚀 Starting backend server...');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Port:', process.env.PORT || 5001);

// Check if Firebase service account file exists
let serviceAccount;
try {
  if (fs.existsSync('./firebaseServiceAccount.json')) {
    serviceAccount = require('./firebaseServiceAccount.json');
    console.log('✅ Firebase service account loaded successfully');
  } else {
    console.log('⚠️ Firebase service account file not found, using environment variables');
    serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
    };
  }
} catch (error) {
  console.error('❌ Error loading Firebase service account:', error.message);
  process.exit(1);
}

console.log('Loaded ENV:', {
  YNAB_CLIENT_ID: process.env.YNAB_CLIENT_ID,
  YNAB_CLIENT_SECRET: process.env.YNAB_CLIENT_SECRET ? '***' : undefined,
  YNAB_REDIRECT_URI: process.env.YNAB_REDIRECT_URI,
});

const app = express();

// Configure CORS to allow your Netlify domain
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173', // Vite dev server
      'https://serene-kelpie-1319e6.netlify.app', // Old Netlify domain
      'https://ynabwealthdashboard.netlify.app', // New Netlify domain
      'https://my-finance-dashboard.onrender.com' // Your backend domain
    ];
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.log('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));

// Handle preflight requests explicitly
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://serene-kelpie-1319e6.netlify.app',
    'https://ynabwealthdashboard.netlify.app',
    'https://my-finance-dashboard.onrender.com'
  ];
  
  if (!origin || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.status(200).end();
  } else {
    console.log('Preflight request blocked for origin:', origin);
    res.status(403).end();
  }
});

app.use(express.json());

// Add request logging for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

// Basic routes - these should come early
const YNAB_CLIENT_ID = process.env.YNAB_CLIENT_ID;
const YNAB_CLIENT_SECRET = process.env.YNAB_CLIENT_SECRET;
// Set redirect URI based on environment
const YNAB_REDIRECT_URI = process.env.YNAB_REDIRECT_URI || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://ynabwealthdashboard.netlify.app/auth/ynab/callback'
    : 'http://localhost:5173/auth/ynab/callback');
const YNAB_API_BASE_URL = 'https://api.ynab.com/v1';

// Initialize Firebase Admin
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized successfully');
  }
} catch (error) {
  console.error('❌ Error initializing Firebase:', error.message);
  process.exit(1);
}

const db = admin.firestore();
console.log('✅ Firestore initialized');

// Test database connection
try {
  db.settings({ ignoreUndefinedProperties: true });
  console.log('✅ Firestore settings configured');
} catch (error) {
  console.error('⚠️ Firestore settings warning:', error.message);
}

app.get('/', (req, res) => {
  res.json({ 
    status: 'YNAB backend is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5001
  });
});
console.log('✅ Registered route: GET /');

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
console.log('✅ Registered route: GET /health');

// Debug endpoint to check environment variables
app.get('/api/debug/env', (req, res) => {
  res.json({
    YNAB_CLIENT_ID: YNAB_CLIENT_ID ? 'SET' : 'MISSING',
    YNAB_CLIENT_SECRET: YNAB_CLIENT_SECRET ? 'SET' : 'MISSING',
    YNAB_REDIRECT_URI: YNAB_REDIRECT_URI || 'MISSING',
    NODE_ENV: process.env.NODE_ENV || 'not set'
  });
});

// Debug endpoint to check auth URL generation
app.get('/api/debug/auth-url', (req, res) => {
  const authUrl = `https://app.ynab.com/oauth/authorize?client_id=${YNAB_CLIENT_ID}&redirect_uri=${encodeURIComponent(YNAB_REDIRECT_URI)}&response_type=code`;
  res.json({
    client_id: YNAB_CLIENT_ID,
    redirect_uri: YNAB_REDIRECT_URI,
    encoded_redirect_uri: encodeURIComponent(YNAB_REDIRECT_URI),
    full_auth_url: authUrl
  });
});

// YNAB OAuth endpoints
app.get('/api/ynab/auth', (req, res) => {
  // Set CORS headers explicitly for this endpoint
  const origin = req.headers.origin;
  if (origin && [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://serene-kelpie-1319e6.netlify.app',
    'https://ynabwealthdashboard.netlify.app',
    'https://my-finance-dashboard.onrender.com'
  ].includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  console.log('Generating YNAB auth URL with:', {
    client_id: YNAB_CLIENT_ID,
    redirect_uri: YNAB_REDIRECT_URI
  });
  
  if (!YNAB_CLIENT_ID) {
    return res.status(500).json({ error: 'YNAB_CLIENT_ID not configured' });
  }
  
  const authUrl = `https://app.ynab.com/oauth/authorize?client_id=${YNAB_CLIENT_ID}&redirect_uri=${encodeURIComponent(YNAB_REDIRECT_URI)}&response_type=code`;
  console.log('Generated auth URL:', authUrl);
  res.json({ authUrl });
});

// Track processed authorization codes to prevent duplicates
const processedCodes = new Set();

app.post('/api/ynab/token', async (req, res) => {
  const { code } = req.body;
  console.log('=== TOKEN EXCHANGE REQUEST RECEIVED ===');
  console.log('Request body:', req.body);
  console.log('Authorization code received:', code ? 'YES' : 'NO');
  
  if (!code) {
    console.error('❌ No authorization code provided');
    return res.status(400).json({ error: 'Authorization code is required' });
  }
  
  // Check for duplicate requests
  if (processedCodes.has(code)) {
    console.log('⚠️ Duplicate authorization code request detected, ignoring');
    return res.status(409).json({ error: 'Authorization code already processed' });
  }
  
  // Mark code as being processed
  processedCodes.add(code);
  
  // Clean up old codes (keep last 100 to prevent memory issues)
  if (processedCodes.size > 100) {
    const codesArray = Array.from(processedCodes);
    processedCodes.clear();
    codesArray.slice(-50).forEach(c => processedCodes.add(c));
  }
  
  // Debug logging
  console.log('Token exchange attempt:', {
    client_id: YNAB_CLIENT_ID,
    client_secret: YNAB_CLIENT_SECRET ? 'SET' : 'MISSING',
    redirect_uri: YNAB_REDIRECT_URI,
    code: code ? 'PROVIDED' : 'MISSING'
  });
  
  if (!YNAB_CLIENT_ID || !YNAB_CLIENT_SECRET) {
    console.error('❌ Missing YNAB credentials:', {
      YNAB_CLIENT_ID: !!YNAB_CLIENT_ID,
      YNAB_CLIENT_SECRET: !!YNAB_CLIENT_SECRET
    });
    return res.status(500).json({ error: 'Server configuration error: Missing YNAB credentials' });
  }
  
  try {
    const tokenPayload = {
      client_id: YNAB_CLIENT_ID,
      client_secret: YNAB_CLIENT_SECRET,
      redirect_uri: YNAB_REDIRECT_URI,
      grant_type: 'authorization_code',
      code
    };
    
    console.log('📤 Sending token request to YNAB with payload:', {
      ...tokenPayload,
      client_secret: '***',
      code: code.substring(0, 10) + '...'
    });
    
    const response = await axios.post('https://app.ynab.com/oauth/token', tokenPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });
    
    console.log('✅ YNAB token exchange successful');
    console.log('Response status:', response.status);
    
    const { access_token, refresh_token } = response.data;
    res.json({ access_token, refresh_token });
  } catch (error) {
    console.error('❌ Error exchanging YNAB code:');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response statusText:', error.response.statusText);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('Request was made but no response received');
      console.error('Request details:', error.request);
    } else {
      console.error('Error setting up request:', error.message);
    }
    
    res.status(500).json({ 
      error: 'Unable to exchange authorization code',
      details: error.response?.data || error.message,
      status: error.response?.status
    });
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
  // Set CORS headers explicitly for this endpoint
  const origin = req.headers.origin;
  if (origin && [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://serene-kelpie-1319e6.netlify.app',
    'https://ynabwealthdashboard.netlify.app',
    'https://my-finance-dashboard.onrender.com'
  ].includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
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

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Catch-all route for debugging - should be last
app.use('*', (req, res) => {
  console.log(`❓ Unhandled route: ${req.method} ${req.path}`);
  console.log('Available routes: /, /health, /api/debug/env, /api/debug/auth-url, /api/ynab/*, /api/manual_accounts');
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method,
    availableRoutes: ['/', '/health', '/api/debug/env', '/api/debug/auth-url', '/api/ynab/*', '/api/manual_accounts']
  });
});

const PORT = process.env.PORT || 5001;

// Add error handling for the server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Backend server running on port ${PORT}`);
  console.log(`🌐 Server URL: http://0.0.0.0:${PORT}`);
  console.log('📡 Server is ready to accept connections');
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🚦 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('🚦 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});
