#!/bin/bash
# Quick test script to verify the refactored app works

echo "🚀 Testing Finance Dashboard Refactoring..."
echo ""

# Check if we're in the right directory
if [ ! -f "frontend/package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

cd frontend

echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔨 Building the app..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed. Check the errors above."
    exit 1
fi

echo ""
echo "🧪 Running development server..."
echo "   Open http://localhost:5173 in your browser"
echo "   Press Ctrl+C to stop"
echo ""

npm run dev
