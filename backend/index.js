// backend/index.js - Cleaned version
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const axios = require('axios');
const fs = require('fs');
const cron = require('node-cron');
const logger = require('./logger');

dotenv.config();

// Add startup logging
console.log('🚀 Starting backend server...');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Port:', process.env.PORT || 5001);

// Initialize Express app first
const app = express();

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'https://serene-kelpie-1319e6.netlify.app',
      'https://ynabwealthdashboard.netlify.app',
      'https://my-finance-dashboard.onrender.com'
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
  optionsSuccessStatus: 200
}));

// Handle preflight requests (avoiding '*' pattern)
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'https://serene-kelpie-1319e6.netlify.app',
      'https://ynabwealthdashboard.netlify.app',
      'https://my-finance-dashboard.onrender.com'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.header('Access-Control-Allow-Credentials', 'true');
      return res.status(200).end();
    } else {
      console.log('Preflight request blocked for origin:', origin);
      return res.status(403).end();
    }
  }
  next();
});

app.use(express.json());

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

// Firebase initialization
let serviceAccount;
try {
  if (fs.existsSync('./firebaseServiceAccount.json')) {
    serviceAccount = require('./firebaseServiceAccount.json');
    console.log('✅ Firebase service account loaded successfully');
  } else {
    console.log('⚠️ Firebase service account file not found, using environment variables');
    
    const requiredEnvVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_CLIENT_ID'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      console.error('❌ Missing required Firebase environment variables:', missingVars);
      process.exit(1);
    }
    
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
    
    console.log('✅ Firebase service account constructed from environment variables');
  }
} catch (error) {
  console.error('❌ Error loading Firebase service account:', error.message);
  process.exit(1);
}

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

// YNAB configuration
const YNAB_CLIENT_ID = process.env.YNAB_CLIENT_ID;
const YNAB_CLIENT_SECRET = process.env.YNAB_CLIENT_SECRET;
const YNAB_REDIRECT_URI = process.env.YNAB_REDIRECT_URI || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://ynabwealthdashboard.netlify.app/auth/ynab/callback'
    : 'http://localhost:5173/auth/ynab/callback');
const YNAB_API_BASE_URL = 'https://api.ynab.com/v1';

console.log('Loaded ENV:', {
  YNAB_CLIENT_ID: YNAB_CLIENT_ID,
  YNAB_CLIENT_SECRET: YNAB_CLIENT_SECRET ? '***' : undefined,
  YNAB_REDIRECT_URI: YNAB_REDIRECT_URI,
});

// Track processed authorization codes
const processedCodes = new Set();

// In-memory cache for YNAB API responses (works within warm serverless instances)
const ynabCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCacheKey(token, endpoint) {
  // Use first 10 chars of token + endpoint as cache key
  const tokenPrefix = token ? token.substring(0, 10) : 'notoken';
  return `${tokenPrefix}:${endpoint}`;
}

function getFromCache(key) {
  const cached = ynabCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`Cache HIT for ${key}`);
    return cached.data;
  }
  if (cached) {
    ynabCache.delete(key); // Clean up expired entry
  }
  return null;
}

function setCache(key, data) {
  // Limit cache size to prevent memory issues
  if (ynabCache.size > 1000) {
    const entries = Array.from(ynabCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    entries.slice(0, 500).forEach(([k]) => ynabCache.delete(k));
  }
  ynabCache.set(key, { data, timestamp: Date.now() });
}

// Set cache headers for Vercel edge caching
// This persists across serverless cold starts
function setCacheHeaders(res, isPrivate = true) {
  if (isPrivate) {
    // Private cache - cached per user (uses Authorization header as key)
    res.set('Cache-Control', 'private, max-age=3600, stale-while-revalidate=7200');
  } else {
    // Public cache - same for all users
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=7200');
  }
  res.set('Vary', 'Authorization');
}

// Routes
app.get('/', (req, res) => {
  res.json({ 
    status: 'YNAB backend is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5001
  });
});
console.log('✅ Registered route: GET /');

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
console.log('✅ Registered route: GET /health');

app.get('/api/debug/env', (req, res) => {
  res.json({
    YNAB_CLIENT_ID: YNAB_CLIENT_ID ? 'SET' : 'MISSING',
    YNAB_CLIENT_SECRET: YNAB_CLIENT_SECRET ? 'SET' : 'MISSING',
    YNAB_REDIRECT_URI: YNAB_REDIRECT_URI || 'MISSING',
    NODE_ENV: process.env.NODE_ENV || 'not set'
  });
});

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

app.post('/api/ynab/token', async (req, res) => {
  const { code } = req.body;
  console.log('=== TOKEN EXCHANGE REQUEST RECEIVED ===');
  console.log('Request body:', req.body);
  console.log('Authorization code received:', code ? 'YES' : 'NO');
  
  if (!code) {
    console.error('❌ No authorization code provided');
    return res.status(400).json({ error: 'Authorization code is required' });
  }
  
  if (processedCodes.has(code)) {
    console.log('⚠️ Duplicate authorization code request detected, ignoring');
    return res.status(409).json({ error: 'Authorization code already processed' });
  }
  
  processedCodes.add(code);
  
  if (processedCodes.size > 100) {
    const codesArray = Array.from(processedCodes);
    processedCodes.clear();
    codesArray.slice(-50).forEach(c => processedCodes.add(c));
  }
  
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
      timeout: 10000
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

// YNAB API proxy endpoints (with caching for faster responses)
app.get('/api/ynab/budgets', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const { budgetId, resource } = req.query;
  const token = authHeader.replace('Bearer ', '');

  // Handle resource parameter for combined endpoint
  if (budgetId && resource) {
    const cacheKey = getCacheKey(token, `budgets/${budgetId}/${resource}`);
    const cached = getFromCache(cacheKey);
    if (cached) {
      setCacheHeaders(res);
      return res.json(cached);
    }

    try {
      const response = await axios.get(`${YNAB_API_BASE_URL}/budgets/${budgetId}/${resource}`, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      });
      setCache(cacheKey, response.data);
      setCacheHeaders(res);
      res.json(response.data);
    } catch (error) {
      console.error(`Error fetching ${resource}:`, error.response?.data || error.message);
      res.status(error.response?.status || 500).json({ error: `Unable to fetch ${resource}` });
    }
    return;
  }

  // Default: fetch all budgets
  const cacheKey = getCacheKey(token, 'budgets');
  const cached = getFromCache(cacheKey);
  if (cached) {
    setCacheHeaders(res);
    return res.json(cached);
  }

  try {
    const response = await axios.get(`${YNAB_API_BASE_URL}/budgets`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });
    setCache(cacheKey, response.data);
    setCacheHeaders(res);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching budgets:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Unable to fetch budgets' });
  }
});

// Fixed parameterized routes with caching
app.get('/api/ynab/budgets/:budgetId/accounts', async (req, res) => {
  const { budgetId } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.replace('Bearer ', '');
  const cacheKey = getCacheKey(token, `budgets/${budgetId}/accounts`);
  const cached = getFromCache(cacheKey);
  if (cached) {
    setCacheHeaders(res);
    return res.json(cached);
  }

  try {
    const response = await axios.get(`${YNAB_API_BASE_URL}/budgets/${budgetId}/accounts`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });
    setCache(cacheKey, response.data);
    setCacheHeaders(res);
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

  const token = authHeader.replace('Bearer ', '');
  const cacheKey = getCacheKey(token, `budgets/${budgetId}/transactions${since_date ? `?since=${since_date}` : ''}`);
  const cached = getFromCache(cacheKey);
  if (cached) {
    setCacheHeaders(res);
    return res.json(cached);
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
    setCache(cacheKey, response.data);
    setCacheHeaders(res);
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

  const token = authHeader.replace('Bearer ', '');
  const cacheKey = getCacheKey(token, `budgets/${budgetId}/categories`);
  const cached = getFromCache(cacheKey);
  if (cached) {
    setCacheHeaders(res);
    return res.json(cached);
  }

  try {
    const response = await axios.get(`${YNAB_API_BASE_URL}/budgets/${budgetId}/categories`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });
    setCache(cacheKey, response.data);
    setCacheHeaders(res);
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

  const token = authHeader.replace('Bearer ', '');
  const cacheKey = getCacheKey(token, `budgets/${budgetId}/months`);
  const cached = getFromCache(cacheKey);
  if (cached) {
    setCacheHeaders(res);
    return res.json(cached);
  }

  try {
    const response = await axios.get(`${YNAB_API_BASE_URL}/budgets/${budgetId}/months`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });
    setCache(cacheKey, response.data);
    setCacheHeaders(res);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching months:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Unable to fetch months' });
  }
});

// Scheduled transactions endpoint
app.get('/api/ynab/budgets/:budgetId/scheduled_transactions', async (req, res) => {
  const { budgetId } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.replace('Bearer ', '');
  const cacheKey = getCacheKey(token, `budgets/${budgetId}/scheduled_transactions`);
  const cached = getFromCache(cacheKey);
  if (cached) {
    setCacheHeaders(res);
    return res.json(cached);
  }

  try {
    const response = await axios.get(`${YNAB_API_BASE_URL}/budgets/${budgetId}/scheduled_transactions`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });
    setCache(cacheKey, response.data);
    setCacheHeaders(res);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching scheduled transactions:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Unable to fetch scheduled transactions' });
  }
});

// Altruist CSV import endpoint
app.post('/api/import-altruist-holdings', async (req, res) => {
  const { user_id, csvData } = req.body;

  if (!user_id || !csvData) {
    return res.status(400).json({ error: 'user_id and csvData are required' });
  }

  try {
    const lines = csvData.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV data is too short or empty' });
    }

    const header = lines[0].split(',').map(h => h.trim());
    const expectedHeader = ['Ticker', 'Description', 'Account', 'Held', 'Price', 'Quantity', 'Amount'];
    if (JSON.stringify(header) !== JSON.stringify(expectedHeader)) {
      console.warn('CSV header does not match expected:', header);
    }
    
    const holdings = [];
    const disclaimerKeywords = ["This report is provided", "Brokerage related products", "Download date:"];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (disclaimerKeywords.some(keyword => line.startsWith(keyword))) {
        console.log('Skipping disclaimer line:', line);
        continue;
      }

      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/g).map(v => v.trim().replace(/^"|"$/g, ''));

      if (values.length !== expectedHeader.length) {
        console.warn(`Skipping malformed line ${i + 1}: expected ${expectedHeader.length} values, got ${values.length}. Line: "${line}"`);
        continue;
      }
      
      const holding = {
        userId: user_id,
        source: "AltruistCSV",
        importDate: new Date().toISOString(),
        ticker: values[0],
        description: values[1],
        accountNumber: values[2],
        heldPercentage: parseFloat(values[3].replace('%', '')) || 0,
        price: parseFloat(values[4].replace('$', '').replace(/,/g, '')) || 0,
        quantity: parseFloat(values[5].replace(/,/g, '')) || 0,
        marketValue: parseFloat(values[6].replace('$', '').replace(/,/g, '')) || 0,
      };
      holdings.push(holding);
    }

    if (holdings.length === 0) {
      return res.status(400).json({ error: 'No valid holdings data found in CSV' });
    }

    // Delete existing holdings
    const existingHoldingsQuery = db.collection('user_holdings')
      .where('userId', '==', user_id)
      .where('source', '==', 'AltruistCSV');
    const existingDocsSnapshot = await existingHoldingsQuery.get();
    
    const batchDelete = db.batch();
    existingDocsSnapshot.forEach(doc => {
      batchDelete.delete(doc.ref);
    });
    await batchDelete.commit();
    console.log(`Deleted ${existingDocsSnapshot.size} existing AltruistCSV holdings for user ${user_id}`);

    // Add new holdings
    const batchAdd = db.batch();
    const holdingsCollection = db.collection('user_holdings');
    holdings.forEach(holding => {
      const docRef = holdingsCollection.doc();
      batchAdd.set(docRef, holding);
    });
    await batchAdd.commit();

    res.json({ success: true, message: `${holdings.length} holdings imported successfully.` });

  } catch (error) {
    console.error('Error importing Altruist holdings:', error);
    res.status(500).json({ error: 'Failed to import holdings.' });
  }
});

// YNAB token management
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

// YNAB token refresh - exchanges refresh_token for new access_token
app.post('/api/ynab/refresh_token', async (req, res) => {
  const { user_id, refresh_token } = req.body;

  if (!user_id || !refresh_token) {
    return res.status(400).json({ error: 'user_id and refresh_token are required' });
  }

  if (!YNAB_CLIENT_ID || !YNAB_CLIENT_SECRET) {
    console.error('❌ Missing YNAB credentials for token refresh');
    return res.status(500).json({ error: 'Server configuration error: Missing YNAB credentials' });
  }

  try {
    console.log('Attempting YNAB token refresh for user:', user_id);

    const tokenPayload = {
      client_id: YNAB_CLIENT_ID,
      client_secret: YNAB_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token
    };

    const response = await axios.post('https://app.ynab.com/oauth/token', tokenPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    const { access_token: new_access_token, refresh_token: new_refresh_token } = response.data;

    // Save new tokens to Firestore
    const userDocRef = db.collection('ynab_tokens').doc(user_id);
    await userDocRef.set({
      access_token: new_access_token,
      refresh_token: new_refresh_token,
      updated_at: new Date().toISOString()
    }, { merge: true });

    console.log('✅ YNAB token refresh successful for user:', user_id);
    res.json({ access_token: new_access_token, refresh_token: new_refresh_token });
  } catch (error) {
    console.error('❌ Error refreshing YNAB token:', error.message);

    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);

      // If refresh token is invalid/expired, user needs to re-authenticate
      if (error.response.status === 401 || error.response.status === 400) {
        return res.status(401).json({
          error: 'Refresh token expired or invalid. Please re-authenticate with YNAB.',
          requiresReauth: true
        });
      }
    }

    res.status(500).json({ error: 'Unable to refresh YNAB token' });
  }
});

app.get('/api/ynab/token', async (req, res) => {
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

// Manual accounts endpoints
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

// ============================================
// NEWSLETTER API ENDPOINTS
// ============================================

// Lazy load newsletter service to avoid circular dependencies
let newsletterService = null;
function getNewsletterService() {
  if (!newsletterService) {
    newsletterService = require('./services/newsletterService');
  }
  return newsletterService;
}

// Manual trigger - send newsletter now
app.post('/api/newsletter/send', async (req, res) => {
  const { user_id, skipAI = false } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  logger.info('Manual newsletter trigger', { userId: user_id, skipAI });

  try {
    const service = getNewsletterService();
    const result = await service.generateAndSend(user_id, { skipAI });
    res.json({
      success: true,
      message: 'Newsletter sent successfully',
      ...result
    });
  } catch (error) {
    logger.error('Manual newsletter failed', { userId: user_id, error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
      stage: error.stage || 'unknown'
    });
  }
});

// Preview email without sending (returns HTML)
app.get('/api/newsletter/preview', async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  try {
    const service = getNewsletterService();
    const html = await service.generatePreview(user_id);
    res.type('html').send(html);
  } catch (error) {
    logger.error('Newsletter preview failed', { userId: user_id, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Preview AI prompt without calling Claude (saves tokens)
app.get('/api/newsletter/preview-prompt', async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  try {
    const service = getNewsletterService();
    const result = await service.buildAIPrompt(user_id);
    res.json(result);
  } catch (error) {
    logger.error('Newsletter prompt preview failed', { userId: user_id, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// View recent logs + check last send status
app.get('/api/newsletter/logs', async (req, res) => {
  const { user_id, limit = 10 } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  try {
    const service = getNewsletterService();
    const logs = await service.getLogs(user_id, parseInt(limit));
    res.json(logs);
  } catch (error) {
    logger.error('Newsletter logs fetch failed', { userId: user_id, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Check status of last newsletter (for UI)
app.get('/api/newsletter/status', async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  try {
    const service = getNewsletterService();
    const status = await service.getStatus(user_id);
    res.json(status);
  } catch (error) {
    logger.error('Newsletter status check failed', { userId: user_id, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Check newsletter configuration
app.get('/api/newsletter/config', (req, res) => {
  try {
    const service = getNewsletterService();
    const config = service.validateConfiguration();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

console.log('✅ Registered newsletter routes: /api/newsletter/*');

// ============================================
// NEWSLETTER CRON SCHEDULER
// ============================================

// Initialize cron job for automatic newsletter sending
// Saturday at 9am in configured timezone
const NEWSLETTER_CRON = '0 9 * * 6'; // Every Saturday at 9:00 AM
const NEWSLETTER_TIMEZONE = process.env.NEWSLETTER_TIMEZONE || 'America/Los_Angeles';

// Only start cron if Resend is configured
if (process.env.RESEND_API_KEY && process.env.NEWSLETTER_RECIPIENTS) {
  cron.schedule(NEWSLETTER_CRON, async () => {
    logger.info('Newsletter cron triggered', { timezone: NEWSLETTER_TIMEZONE });

    try {
      // Get all users with newsletter enabled
      // For single-user setup, we'll use the first user with YNAB tokens
      const tokensSnapshot = await db.collection('ynab_tokens').limit(1).get();

      if (tokensSnapshot.empty) {
        logger.warn('No users with YNAB tokens found for newsletter');
        return;
      }

      const userId = tokensSnapshot.docs[0].id;
      const service = getNewsletterService();
      const result = await service.generateAndSend(userId);

      logger.info('Scheduled newsletter completed', { userId, result });
    } catch (error) {
      logger.error('Scheduled newsletter failed', { error: error.message });
    }
  }, {
    timezone: NEWSLETTER_TIMEZONE
  });

  console.log(`✅ Newsletter cron scheduled: ${NEWSLETTER_CRON} (${NEWSLETTER_TIMEZONE})`);
} else {
  console.log('⚠️ Newsletter cron not started - missing RESEND_API_KEY or NEWSLETTER_RECIPIENTS');
}

// Error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Catch-all route - keep this last (avoiding '*' pattern to prevent path-to-regexp error)
app.use((req, res) => {
  console.log(`❓ Unhandled route: ${req.method} ${req.path}`);
  const availableRoutes = [
    '/', 
    '/health', 
    '/api/debug/env', 
    '/api/debug/auth-url', 
    '/api/ynab/*', 
    '/api/manual_accounts', 
    '/api/import-altruist-holdings'
  ];
  console.log('Available routes:', availableRoutes.join(', '));
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method,
    availableRoutes
  });
});

const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Backend server running on port ${PORT}`);
  console.log(`🌐 Server URL: http://0.0.0.0:${PORT}`);
  console.log('📡 Server is ready to accept connections');
});

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
