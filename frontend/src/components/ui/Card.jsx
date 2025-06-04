import React from 'react';

export default function Card({ children, className = '', padding = true }) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-visible ${
        padding ? 'p-6' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}