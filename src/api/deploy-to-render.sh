#!/bin/bash

# Deploy SVG to STL API to Render
echo "🚀 Preparing to deploy SVG to STL API to Render..."

# Check if we're in the right directory
if [ ! -f "svg-to-stl-server.js" ]; then
    echo "❌ Error: Please run this script from the src/api directory"
    exit 1
fi

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit for Render deployment"
fi

# Check if we have a remote origin
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "⚠️  No remote origin found. Please add your Git repository:"
    echo "   git remote add origin <your-repo-url>"
    echo "   git push -u origin main"
    exit 1
fi

# Push to remote repository
echo "📤 Pushing to remote repository..."
git add .
git commit -m "Deploy SVG to STL API to Render" || echo "No changes to commit"
git push origin main

echo "✅ Code pushed to repository!"
echo ""
echo "🎯 Next steps:"
echo "1. Go to https://dashboard.render.com/"
echo "2. Click 'New +' → 'Web Service'"
echo "3. Connect your Git repository"
echo "4. Configure the service:"
echo "   - Root Directory: src/api"
echo "   - Build Command: npm install"
echo "   - Start Command: npm start"
echo "   - Health Check Path: /api/health"
echo "5. Click 'Create Web Service'"
echo ""
echo "📚 For detailed instructions, see RENDER_DEPLOYMENT.md"
