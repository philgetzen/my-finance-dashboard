import React from 'react';
import MobileLayout from './MobileLayout';

export default function Layout({ children }) {
  // Dark mode is now handled by ConsolidatedDataContext
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <MobileLayout>
        {children}
      </MobileLayout>
    </div>
  );
}