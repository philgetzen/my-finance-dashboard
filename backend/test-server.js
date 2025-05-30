// Minimal test server to isolate the route issue
const express = require('express');
const cors = require('cors');

console.log('🚀 Starting minimal test server...');

const app = express();
app.use(express.json());
app.use(cors());

// Test each route type individually
console.log('Testing basic routes...');
app.get('/', (req, res) => {
  res.json({ status: 'Test server is running!' });
});

console.log('Testing health check...');
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

console.log('Testing YNAB auth routes...');
app.get('/api/ynab/auth', (req, res) => {
  res.json({ test: 'ynab auth route' });
});

app.post('/api/ynab/token', (req, res) => {
  res.json({ test: 'ynab token route' });
});

console.log('Testing parameterized routes...');
try {
  app.get('/api/ynab/budgets/:budgetId/accounts', (req, res) => {
    res.json({ budgetId: req.params.budgetId, test: 'accounts' });
  });
  console.log('✅ budgets/:budgetId/accounts route registered');
} catch (error) {
  console.error('❌ Error with budgets/:budgetId/accounts:', error.message);
}

try {
  app.get('/api/ynab/budgets/:budgetId/transactions', (req, res) => {
    res.json({ budgetId: req.params.budgetId, test: 'transactions' });
  });
  console.log('✅ budgets/:budgetId/transactions route registered');
} catch (error) {
  console.error('❌ Error with budgets/:budgetId/transactions:', error.message);
}

try {
  app.get('/api/ynab/budgets/:budgetId/categories', (req, res) => {
    res.json({ budgetId: req.params.budgetId, test: 'categories' });
  });
  console.log('✅ budgets/:budgetId/categories route registered');
} catch (error) {
  console.error('❌ Error with budgets/:budgetId/categories:', error.message);
}

try {
  app.get('/api/ynab/budgets/:budgetId/months', (req, res) => {
    res.json({ budgetId: req.params.budgetId, test: 'months' });
  });
  console.log('✅ budgets/:budgetId/months route registered');
} catch (error) {
  console.error('❌ Error with budgets/:budgetId/months:', error.message);
}

console.log('Testing manual accounts routes...');
try {
  app.get('/api/manual_accounts', (req, res) => {
    res.json({ test: 'manual accounts list' });
  });
  console.log('✅ manual_accounts route registered');
} catch (error) {
  console.error('❌ Error with manual_accounts:', error.message);
}

try {
  app.post('/api/manual_accounts', (req, res) => {
    res.json({ test: 'create manual account' });
  });
  console.log('✅ POST manual_accounts route registered');
} catch (error) {
  console.error('❌ Error with POST manual_accounts:', error.message);
}

try {
  app.put('/api/manual_accounts/:accountId', (req, res) => {
    res.json({ accountId: req.params.accountId, test: 'update account' });
  });
  console.log('✅ PUT manual_accounts/:accountId route registered');
} catch (error) {
  console.error('❌ Error with PUT manual_accounts/:accountId:', error.message);
}

try {
  app.delete('/api/manual_accounts/:accountId', (req, res) => {
    res.json({ accountId: req.params.accountId, test: 'delete account' });
  });
  console.log('✅ DELETE manual_accounts/:accountId route registered');
} catch (error) {
  console.error('❌ Error with DELETE manual_accounts/:accountId:', error.message);
}

// Test the catch-all route last - using different syntax to avoid path-to-regexp error
console.log('Testing catch-all route...');
try {
  // Option 1: Use a more specific pattern
  app.use((req, res) => {
    res.status(404).json({ 
      error: 'Route not found',
      path: req.path,
      method: req.method
    });
  });
  console.log('✅ Catch-all route registered (without * pattern)');
} catch (error) {
  console.error('❌ Error with catch-all route:', error.message);
}

const PORT = process.env.PORT || 5002; // Different port to avoid conflicts

const server = app.listen(PORT, () => {
  console.log(`✅ Test server running on port ${PORT}`);
  console.log('All routes registered successfully!');
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
});
