import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { usePrivacy } from '../../contexts/YNABDataContext';
import Button from '../ui/Button';
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

  // Settings drawer for mobile - iOS style
  const SettingsDrawer = () => (
    <div 
      className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${showSettings ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      onClick={() => setShowSettings(false)}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl shadow-xl transform transition-transform duration-300 ease-out ${showSettings ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mt-3 mb-6" />
        <div className="px-6 pb-8 space-y-2">
          <Button
            variant="secondary"
            onClick={() => {
              setDarkMode(!darkMode);
              setShowSettings(false);
            }}
            className="w-full justify-start text-base"
            size="lg"
          >
            {darkMode ? <SunIcon className="h-5 w-5 mr-3" /> : <MoonIcon className="h-5 w-5 mr-3" />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </Button>
          
          <Button
            variant="secondary"
            onClick={() => {
              togglePrivacyMode();
              setShowSettings(false);
            }}
            className="w-full justify-start text-base"
            size="lg"
          >
            {isPrivacyMode ? <EyeIcon className="h-5 w-5 mr-3" /> : <EyeSlashIcon className="h-5 w-5 mr-3" />}
            {isPrivacyMode ? 'Show Numbers' : 'Privacy Mode'}
          </Button>
          
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-4">
            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full justify-start text-base text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
              size="lg"
            >
              <ArrowRightStartOnRectangleIcon className="h-5 w-5 mr-3" />
              Sign Out
            </Button>
          </div>
        </div>
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
                  className={`group flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 border ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                      : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className={`mr-3 h-5 w-5 ${
                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-300 group-hover:text-gray-500 dark:group-hover:text-gray-100'
                  }`} />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
          
          {/* Settings */}
          <div className="flex-shrink-0 flex flex-col p-4 space-y-2 border-t border-gray-200 dark:border-gray-700">
          <Button
          variant="secondary"
          onClick={() => setDarkMode(!darkMode)}
            className="w-full justify-start"
          size="sm"
          >
            {darkMode ? <SunIcon className="h-4 w-4 mr-2" /> : <MoonIcon className="h-4 w-4 mr-2" />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </Button>
          
          <Button
            variant="secondary"
          onClick={togglePrivacyMode}
          className="w-full justify-start"
            size="sm"
          >
            {isPrivacyMode ? <EyeIcon className="h-4 w-4 mr-2" /> : <EyeSlashIcon className="h-4 w-4 mr-2" />}
          {isPrivacyMode ? 'Show Numbers' : 'Privacy Mode'}
          </Button>
          
          <Button
          variant="outline"
            onClick={handleLogout}
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
            size="sm"
          >
            <ArrowRightStartOnRectangleIcon className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
        </div>
      </div>
    </div>
  );

  // Mobile bottom navigation - iOS style
  const MobileBottomNav = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg border-t border-gray-300 dark:border-gray-700 shadow-[0_-2px_5px_rgba(0,0,0,0.03)] dark:shadow-[0_-2px_5px_rgba(0,0,0,0.08)] lg:hidden z-40 safe-area-inset">
      <div className="grid grid-cols-6 h-[60px] pb-safe">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = isActive ? item.iconActive : item.icon;
          return (
            <button
              key={item.name}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] transition-all duration-200 rounded-md mx-1 my-1 py-1 dark:hover:bg-gray-700 ${
                isActive 
                  ? 'dark:bg-blue-900/20 dark:border-blue-800 border border-blue-200 bg-blue-50' // Added border for light active, bg for light active
                  : 'dark:bg-transparent dark:border-transparent'
              }`}
            >
              <Icon className={`h-6 w-6 transition-all duration-200 ${
                isActive 
                  ? 'text-blue-600 dark:text-blue-400 scale-110' 
                  : 'text-gray-400 dark:text-gray-300' // Adjusted inactive dark icon color
              }`} />
              <span className={`font-medium transition-all duration-200 ${
                isActive 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-500 dark:text-gray-300' // Adjusted inactive dark text color
              }`}>
                {item.name}
              </span>
            </button>
          );
        })}
        
        <button
          onClick={() => setShowSettings(true)}
          className="flex flex-col items-center justify-center gap-0.5 text-[10px] transition-all duration-200 dark:hover:bg-gray-700 rounded-md mx-1 my-1 py-1 dark:bg-transparent dark:border-transparent" // Added hover, bg, border for consistency
        >
          <Cog6ToothIcon className="h-6 w-6 text-gray-400 dark:text-gray-300" /> 
          <span className="text-gray-500 dark:text-gray-300 font-medium">More</span>
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
