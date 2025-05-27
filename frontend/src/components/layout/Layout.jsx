import React, { useState, useEffect } from 'react';
import MobileLayout from './MobileLayout';

export default function Layout({ children }) {
  // Initialize dark mode from localStorage immediately to prevent flash
  const [darkMode, setDarkMode] = useState(() => {
    // Check for saved preference first
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode !== null) {
      const isDark = JSON.parse(savedMode);
      // Apply immediately on initialization
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return isDark;
    }
    
    // Fall back to system preference
    const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (systemDark) {
      document.documentElement.classList.add('dark');
    }
    // Save the system preference
    localStorage.setItem('darkMode', JSON.stringify(systemDark));
    return systemDark;
  });

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      // Only update if no explicit preference is saved
      const savedMode = localStorage.getItem('darkMode');
      if (savedMode === null) {
        setDarkMode(e.matches);
        localStorage.setItem('darkMode', JSON.stringify(e.matches));
      }
    };
    
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return (
    <MobileLayout darkMode={darkMode} setDarkMode={setDarkMode}>
      {children}
    </MobileLayout>
  );
}