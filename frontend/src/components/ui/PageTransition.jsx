import React from 'react';

export default function PageTransition({ children, className = '' }) {
  return (
    <div 
      className={`animate-in fade-in-0 slide-in-from-bottom-4 duration-300 ${className}`}
    >
      {children}
    </div>
  );
}