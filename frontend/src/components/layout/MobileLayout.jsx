import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { usePrivacy, useFinanceData } from '../../contexts/ConsolidatedDataContext';
import Button from '../ui/Button';
import DemoModeIndicator from '../ui/DemoModeIndicator';
import DemoModeFloatingModule from '../ui/DemoModeFloatingModule';
import {
  HomeIcon,
  CreditCardIcon,
  ListBulletIcon,
  BanknotesIcon,
  Cog6ToothIcon,
  ArrowRightStartOnRectangleIcon,
  SunIcon,
  MoonIcon,
  EyeSlashIcon,
  EyeIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  CreditCardIcon as CreditCardIconSolid,
  ListBulletIcon as ListBulletIconSolid,
  BanknotesIcon as BanknotesIconSolid,
} from '@heroicons/react/24/solid';

const navItems = [
  { name: 'Dashboard', path: '/', icon: HomeIcon, iconActive: HomeIconSolid },
  { name: 'Accounts', path: '/accounts', icon: CreditCardIcon, iconActive: CreditCardIconSolid },
  { name: 'Income vs Expense', path: '/balance-sheet', icon: ListBulletIcon, iconActive: ListBulletIconSolid },
  { name: 'Investments', path: '/investment-allocation', icon: BanknotesIcon, iconActive: BanknotesIconSolid },
];

export default function MobileLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { privacyMode, setPrivacyMode } = usePrivacy();
  const { darkMode, toggleDarkMode, isDemoMode, logout } = useFinanceData();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  // Handle resize events
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
      if (window.innerWidth >= 1024) {
        setShowMobileMenu(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Dark mode is now handled by the context

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Desktop sidebar with glassmorphism
  const DesktopSidebar = () => (
    <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-50">
      <div className="flex-1 flex flex-col min-h-0 glass-sidebar">
        {/* Logo */}
        <div className="flex items-center h-16 flex-shrink-0 px-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 glass-card-emerald rounded-lg flex items-center justify-center glow-emerald">
              <span className="text-white font-bold text-sm">HW</span>
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">Healthy Wealth</span>
          </div>
        </div>
        
        {/* Demo Mode Indicator */}
        <div className="px-4 py-2">
          <DemoModeIndicator />
        </div>
        
        {/* Navigation */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = isActive ? item.iconActive : item.icon;
              return (
                <button
                  key={item.name}
                  onClick={() => navigate(item.path)}
                  className={`group flex items-center w-full px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${
                    isActive
                      ? 'glass-card-blue text-white glow-blue'
                      : 'glass-button text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className={`mr-3 h-5 w-5 ${
                    isActive ? 'text-white' : 'text-gray-400 dark:text-gray-300 group-hover:text-gray-600 dark:group-hover:text-gray-100'
                  }`} />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
          
          {/* Settings Section */}
          <div className="flex-shrink-0 flex flex-col p-4 space-y-2 border-t border-white/10">
            <Button
              variant="ghost"
              onClick={toggleDarkMode}
              className="w-full justify-start glass-button"
              size="sm"
            >
              {darkMode ? <SunIcon className="h-4 w-4 mr-2" /> : <MoonIcon className="h-4 w-4 mr-2" />}
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </Button>
            
            <Button
              variant="ghost"
              onClick={() => setPrivacyMode(!privacyMode)}
              className="w-full justify-start glass-button"
              size="sm"
            >
              {privacyMode ? <EyeIcon className="h-4 w-4 mr-2" /> : <EyeSlashIcon className="h-4 w-4 mr-2" />}
              {privacyMode ? 'Show Numbers' : 'Privacy Mode'}
            </Button>
            
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start glass-button text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
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

  // Mobile header with hamburger menu
  const MobileHeader = () => (
    <div className="lg:hidden sticky top-0 z-50 glass-nav">
      <div className="flex items-center justify-between h-16 px-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 glass-card-emerald rounded-lg flex items-center justify-center glow-emerald">
            <span className="text-white font-bold text-sm">HW</span>
          </div>
          <span className="text-lg font-bold text-gray-900 dark:text-white">Healthy Wealth</span>
        </div>
        
        <div className="flex items-center space-x-3">
          <DemoModeIndicator />
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="glass-button p-2 rounded-lg"
          >
            {showMobileMenu ? (
              <XMarkIcon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
            ) : (
              <Bars3Icon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Mobile menu overlay
  const MobileMenu = () => (
    <div 
      className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${
        showMobileMenu ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      onClick={() => setShowMobileMenu(false)}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div 
        className={`absolute top-0 left-0 bottom-0 w-80 max-w-[85vw] glass-sidebar transform transition-transform duration-300 ease-out ${
          showMobileMenu ? 'translate-x-0' : '-translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 glass-card-emerald rounded-lg flex items-center justify-center glow-emerald">
              <span className="text-white font-bold text-sm">HW</span>
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">Healthy Wealth</span>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = isActive ? item.iconActive : item.icon;
            return (
              <button
                key={item.name}
                onClick={() => {
                  navigate(item.path);
                  setShowMobileMenu(false);
                }}
                className={`group flex items-center w-full px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'glass-card-blue text-white glow-blue'
                    : 'glass-button text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon className={`mr-3 h-5 w-5 ${
                  isActive ? 'text-white' : 'text-gray-400 dark:text-gray-300 group-hover:text-gray-600 dark:group-hover:text-gray-100'
                }`} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
        
        {/* Settings Section */}
        <div className="px-4 py-4 space-y-2 border-t border-white/10">
          <Button
            variant="ghost"
            onClick={() => {
              toggleDarkMode();
              setShowMobileMenu(false);
            }}
            className="w-full justify-start glass-button"
            size="sm"
          >
            {darkMode ? <SunIcon className="h-4 w-4 mr-2" /> : <MoonIcon className="h-4 w-4 mr-2" />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </Button>
          
          <Button
            variant="ghost"
            onClick={() => {
              setPrivacyMode(!privacyMode);
              setShowMobileMenu(false);
            }}
            className="w-full justify-start glass-button"
            size="sm"
          >
            {privacyMode ? <EyeIcon className="h-4 w-4 mr-2" /> : <EyeSlashIcon className="h-4 w-4 mr-2" />}
            {privacyMode ? 'Show Numbers' : 'Privacy Mode'}
          </Button>
          
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start glass-button text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            size="sm"
          >
            <ArrowRightStartOnRectangleIcon className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );

  // Mobile bottom navigation - iOS style
  const MobileBottomNav = () => (
    <div className="fixed bottom-0 left-0 right-0 glass-nav border-t border-white/10 lg:hidden z-40 pb-safe">
      <div className="grid grid-cols-5 h-[60px]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = isActive ? item.iconActive : item.icon;
          return (
            <button
              key={item.name}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] transition-all duration-200 rounded-md mx-1 my-1 py-1 hover:bg-white/5 ${
                isActive 
                  ? 'glass-card-blue text-white' 
                  : 'text-gray-400 dark:text-gray-300'
              }`}
            >
              <Icon className={`h-6 w-6 transition-all duration-200 ${
                isActive 
                  ? 'text-white scale-110' 
                  : 'text-gray-400 dark:text-gray-300'
              }`} />
              <span className={`font-medium transition-all duration-200 ${
                isActive 
                  ? 'text-white' 
                  : 'text-gray-500 dark:text-gray-300'
              }`}>
                {item.name}
              </span>
            </button>
          );
        })}
        
        <button
          onClick={() => setShowMobileMenu(true)}
          className="flex flex-col items-center justify-center gap-0.5 text-[10px] transition-all duration-200 hover:bg-white/5 rounded-md mx-1 my-1 py-1 text-gray-400 dark:text-gray-300"
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
      
      {/* Mobile header */}
      <MobileHeader />
      
      {/* Mobile menu */}
      <MobileMenu />
      
      {/* Main content */}
      <div className={`flex flex-col min-h-screen ${isDesktop ? 'lg:pl-64' : ''}`}>
        <main className="flex-1 pb-32 lg:pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8">
            {children}
          </div>
        </main>
      </div>
      
      {/* Mobile bottom navigation */}
      <MobileBottomNav />
      
      {/* Demo mode floating module */}
      <DemoModeFloatingModule />
    </>
  );
}