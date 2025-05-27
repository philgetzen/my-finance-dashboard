#!/bin/bash

echo "🚀 Testing backend server locally..."

# Set environment variables for testing
export NODE_ENV=development
export FIREBASE_PROJECT_ID=healthy-wealth-9d3c3

echo "Starting server in background..."
cd /Users/philgetzen/development/my-finance-dashboard/backend
node index.js &
SERVER_PID=$!

echo "Server PID: $SERVER_PID"
sleep 5

echo "Testing routes..."

echo "Testing GET /"
curl -s http://localhost:5001/ | jq .

echo "Testing GET /health"
curl -s http://localhost:5001/health | jq .

echo "Testing invalid route"
curl -s http://localhost:5001/invalid-route | jq .

echo "Stopping server..."
kill $SERVER_PID

echo "Test complete!"
