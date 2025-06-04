#!/bin/bash
# Migration script to update imports from old to new context

# Update all files that import from YNABDataContext
find frontend/src -name "*.jsx" -o -name "*.js" | while read file; do
  # Update imports
  sed -i '' 's/import { useYNAB/import { useFinanceData as useYNAB/g' "$file"
  sed -i '' 's/import { usePrivacy/import { usePrivacy/g' "$file"
  
  # Update any direct imports
  sed -i '' "s/from '..\/contexts\/YNABDataContext'/from '..\/contexts\/ConsolidatedDataContext'/g" "$file"
  sed -i '' "s/from '..\/..\/contexts\/YNABDataContext'/from '..\/..\/contexts\/ConsolidatedDataContext'/g" "$file"
done

echo "Migration complete! Please review the changes and test thoroughly."
