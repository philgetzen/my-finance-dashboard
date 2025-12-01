import React from 'react';

export default function Card({ children, className = '', padding = true }) {
  return (
    <div
      className={`bg-white dark:bg-[var(--color-surface)] rounded-xl border border-gray-200 dark:border-[var(--color-border)] shadow-sm ${
        padding ? 'p-6' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
