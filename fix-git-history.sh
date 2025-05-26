#!/bin/bash

# Navigate to your project directory
cd /Users/philgetzen/Development/my-finance-dashboard

# Force remove the firebase service account file from git history
git filter-repo --path backend/firebaseServiceAccount.json --invert-paths --force

# Add the file to .gitignore if not already there
echo "backend/firebaseServiceAccount.json" >> .gitignore
echo ".env" >> .gitignore
echo "backend/.env" >> .gitignore

# Remove duplicates from .gitignore
sort .gitignore | uniq > .gitignore.tmp && mv .gitignore.tmp .gitignore

# Commit the .gitignore changes
git add .gitignore
git commit -m "Add sensitive files to .gitignore"

# Force push to overwrite remote history
git push --force-with-lease origin main

echo "Git history cleaned and pushed!"
