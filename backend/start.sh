#!/bin/bash
echo "🚀 Starting YNAB Finance Dashboard Backend..."
echo "Environment: ${NODE_ENV:-development}"
echo "Port: ${PORT:-5001}"

# Check if we have the required environment variables
if [ -z "$FIREBASE_PROJECT_ID" ] && [ ! -f "./firebaseServiceAccount.json" ]; then
    echo "❌ ERROR: Neither FIREBASE_PROJECT_ID nor firebaseServiceAccount.json found"
    echo "Please set Firebase environment variables or ensure firebaseServiceAccount.json exists"
    exit 1
fi

# Start the application
exec node index.js
