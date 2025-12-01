import React from 'react';
import MobileLayout from './MobileLayout';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0F1114]">
      <MobileLayout>
        {children}
      </MobileLayout>
    </div>
  );
}
