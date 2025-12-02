import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePrivacy, useFinanceData } from '../../contexts/ConsolidatedDataContext';
import DemoModeIndicator from '../ui/DemoModeIndicator';
import DemoModeFloatingModule from '../ui/DemoModeFloatingModule';
import Sidebar from './Sidebar';
import {
  HomeIcon,
  CreditCardIcon,
  ChartBarIcon,
  ChartPieIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  CreditCardIcon as CreditCardIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  ChartPieIcon as ChartPieIconSolid,
} from '@heroicons/react/24/solid';

const navItems = [
  { name: 'Dashboard', path: '/', icon: HomeIcon, iconActive: HomeIconSolid },
  { name: 'Accounts', path: '/accounts', icon: CreditCardIcon, iconActive: CreditCardIconSolid },
  { name: 'Spending', path: '/spending', icon: ChartBarIcon, iconActive: ChartBarIconSolid },
  { name: 'Invest', path: '/investments', icon: ChartPieIcon, iconActive: ChartPieIconSolid },
];

export default function MobileLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { privacyMode, setPrivacyMode } = usePrivacy();
  const { darkMode, toggleDarkMode, isDemoMode, logout } = useFinanceData();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

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

  // Scroll to top on route change
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Desktop sidebar - uses the Sidebar component
  const DesktopSidebar = () => (
    <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-50">
      <Sidebar />
    </div>
  );

  // Mobile header
  const MobileHeader = () => (
    <div className="lg:hidden sticky top-0 z-50 bg-[var(--sidebar-bg)]">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center space-x-3">
          <span className="text-lg font-semibold text-white">Finance Dashboard</span>
        </div>

        <div className="flex items-center space-x-3">
          <DemoModeIndicator />
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="p-2 rounded-lg text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover)] transition-colors"
          >
            {showMobileMenu ? (
              <XMarkIcon className="h-6 w-6" />
            ) : (
              <Bars3Icon className="h-6 w-6" />
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
      <div className="absolute inset-0 bg-black/60" />
      <div
        className={`absolute top-0 left-0 bottom-0 w-72 max-w-[85vw] bg-[var(--sidebar-bg)] transform transition-transform duration-300 ease-out ${
          showMobileMenu ? 'translate-x-0' : '-translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <Sidebar onClose={() => setShowMobileMenu(false)} />
      </div>
    </div>
  );

  // Mobile bottom navigation - clean tab bar
  const MobileBottomNav = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-[var(--sidebar-bg)] border-t border-[var(--sidebar-border)] lg:hidden z-40 safe-area-bottom">
      <div className="grid grid-cols-5 h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = isActive ? item.iconActive : item.icon;
          return (
            <button
              key={item.name}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive
                  ? 'text-[var(--accent-purple)]'
                  : 'text-[var(--sidebar-text-muted)]'
              }`}
            >
              <Icon className="h-6 w-6" />
              <span className="text-[10px] font-medium">{item.name}</span>
            </button>
          );
        })}

        <button
          onClick={() => setShowMobileMenu(true)}
          className="flex flex-col items-center justify-center gap-1 text-[var(--sidebar-text-muted)]"
        >
          <Cog6ToothIcon className="h-6 w-6" />
          <span className="text-[10px] font-medium">More</span>
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
        <main className="flex-1 pb-24 lg:pb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
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
