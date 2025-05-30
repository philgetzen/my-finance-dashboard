// Debug script to identify route issues
const express = require('express');

console.log('Creating Express app...');
const app = express();

// Add logging for each route registration
const originalUse = app.use;
const originalGet = app.get;
const originalPost = app.post;
const originalPut = app.put;
const originalDelete = app.delete;

app.use = function(...args) {
  console.log('Registering middleware/route with USE:', args[0]);
  return originalUse.apply(this, args);
};

app.get = function(path, ...handlers) {
  console.log('Registering GET route:', path);
  return originalGet.apply(this, [path, ...handlers]);
};

app.post = function(path, ...handlers) {
  console.log('Registering POST route:', path);
  return originalPost.apply(this, [path, ...handlers]);
};

app.put = function(path, ...handlers) {
  console.log('Registering PUT route:', path);
  return originalPut.apply(this, [path, ...handlers]);
};

app.delete = function(path, ...handlers) {
  console.log('Registering DELETE route:', path);
  return originalDelete.apply(this, [path, ...handlers]);
};

// Test the problematic routes one by one
try {
  console.log('\n=== Testing basic routes ===');
  app.get('/', (req, res) => res.json({ test: 'ok' }));
  
  console.log('\n=== Testing parameterized routes ===');
  app.get('/api/ynab/budgets/:budgetId/accounts', (req, res) => res.json({ test: 'ok' }));
  app.get('/api/ynab/budgets/:budgetId/transactions', (req, res) => res.json({ test: 'ok' }));
  app.get('/api/ynab/budgets/:budgetId/categories', (req, res) => res.json({ test: 'ok' }));
  app.get('/api/ynab/budgets/:budgetId/months', (req, res) => res.json({ test: 'ok' }));
  
  app.put('/api/manual_accounts/:accountId', (req, res) => res.json({ test: 'ok' }));
  app.delete('/api/manual_accounts/:accountId', (req, res) => res.json({ test: 'ok' }));
  
  console.log('\n=== Testing catch-all route ===');
  app.use('*', (req, res) => res.status(404).json({ error: 'Not found' }));
  
  console.log('\n✅ All routes registered successfully!');
  
} catch (error) {
  console.error('❌ Error registering routes:', error.message);
  console.error('Stack trace:', error.stack);
}
