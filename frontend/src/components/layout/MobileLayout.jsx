import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { usePrivacy } from '../../contexts/YNABDataContext';
import {
  HomeIcon,
  CreditCardIcon,
  ListBulletIcon,
  BanknotesIcon,
  TrophyIcon,
  Cog6ToothIcon,
  ArrowRightStartOnRectangleIcon,
  SunIcon,
  MoonIcon,
  EyeSlashIcon,
  EyeIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  CreditCardIcon as CreditCardIconSolid,
  ListBulletIcon as ListBulletIconSolid,
  BanknotesIcon as BanknotesIconSolid,
  TrophyIcon as TrophyIconSolid,
} from '@heroicons/react/24/solid';

const navItems = [
  { name: 'Dashboard', path: '/', icon: HomeIcon, iconActive: HomeIconSolid },
  { name: 'Accounts', path: '/accounts', icon: CreditCardIcon, iconActive: CreditCardIconSolid },
  { name: 'Balance', path: '/balance-sheet', icon: ListBulletIcon, iconActive: ListBulletIconSolid },
  { name: 'Invest', path: '/investment-allocation', icon: BanknotesIcon, iconActive: BanknotesIconSolid },
  { name: 'Holdings', path: '/holdings', icon: TrophyIcon, iconActive: TrophyIconSolid },
];

export default function MobileLayout({ children, darkMode, setDarkMode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isPrivacyMode, togglePrivacyMode } = usePrivacy();
  const [showSettings, setShowSettings] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  // Handle resize events
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  // Settings drawer for mobile
  const SettingsDrawer = () => (
    <div 
      className={`fixed inset-0 z-50 lg:hidden ${showSettings ? 'block' : 'hidden'}`}
      onClick={() => setShowSettings(false)}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div 
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h2>
          <button onClick={() => setShowSettings(false)}>
            <XMarkIcon className="h-6 w-6 text-gray-500" />
          </button>
        </div>
        
        <button
          onClick={() => {
            setDarkMode(!darkMode);
            setShowSettings(false);
          }}
          className="w-full flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700"
        >
          <div className="flex items-center gap-3">
            {darkMode ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </div>
        </button>
        
        <button
          onClick={() => {
            togglePrivacyMode();
            setShowSettings(false);
          }}
          className="w-full flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700"
        >
          <div className="flex items-center gap-3">
            {isPrivacyMode ? <EyeIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />}
            <span>{isPrivacyMode ? 'Show Numbers' : 'Privacy Mode'}</span>
          </div>
        </button>
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-between p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600"
        >
          <div className="flex items-center gap-3">
            <ArrowRightStartOnRectangleIcon className="h-5 w-5" />
            <span>Sign Out</span>
          </div>
        </button>
      </div>
    </div>
  );

  // Desktop sidebar
  const DesktopSidebar = () => (
    <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
      <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
        {/* Logo */}
        <div className="flex items-center h-16 flex-shrink-0 px-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">HW</span>
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">Healthy Wealth</span>
          </div>
        </div>
        
        {/* Navigation */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          <nav className="flex-1 px-2 py-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = isActive ? item.iconActive : item.icon;
              return (
                <button
                  key={item.name}
                  onClick={() => navigate(item.path)}
                  className={`group flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className={`mr-3 h-5 w-5 ${
                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'
                  }`} />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
          
          {/* Settings */}
          <div className="flex-shrink-0 flex flex-col p-4 space-y-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
            >
              {darkMode ? <SunIcon className="h-5 w-5 mr-3" /> : <MoonIcon className="h-5 w-5 mr-3" />}
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
            
            <button
              onClick={togglePrivacyMode}
              className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
            >
              {isPrivacyMode ? <EyeIcon className="h-5 w-5 mr-3" /> : <EyeSlashIcon className="h-5 w-5 mr-3" />}
              {isPrivacyMode ? 'Show Numbers' : 'Privacy Mode'}
            </button>
            
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
            >
              <ArrowRightStartOnRectangleIcon className="h-5 w-5 mr-3" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Mobile bottom navigation
  const MobileBottomNav = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 lg:hidden z-40 safe-area-inset">
      <div className="grid grid-cols-6 h-16 pb-safe">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = isActive ? item.iconActive : item.icon;
          return (
            <button
              key={item.name}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center gap-1 text-xs"
            >
              <Icon className={`h-5 w-5 ${
                isActive 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-400 dark:text-gray-500'
              }`} />
              <span className={`${
                isActive 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-500 dark:text-gray-400'
              }`}>
                {item.name.length > 8 ? item.name.substring(0, 7) + '.' : item.name}
              </span>
            </button>
          );
        })}
        
        <button
          onClick={() => setShowSettings(true)}
          className="flex flex-col items-center justify-center gap-1 text-xs"
        >
          <Cog6ToothIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          <span className="text-gray-500 dark:text-gray-400">More</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <DesktopSidebar />
      
      {/* Main content */}
      <div className={`flex flex-col min-h-screen ${isDesktop ? 'lg:pl-64' : ''}`}>
        <main className="flex-1 pb-20 lg:pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8 safe-area-inset">
            {children}
          </div>
        </main>
      </div>
      
      {/* Mobile bottom navigation */}
      <MobileBottomNav />
      
      {/* Mobile settings drawer */}
      <SettingsDrawer />
    </>
  );
}