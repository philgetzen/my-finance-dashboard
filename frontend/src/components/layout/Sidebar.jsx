import React, { useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useFinanceData, usePrivacy } from '../../contexts/ConsolidatedDataContext';
import {
  HomeIcon,
  BanknotesIcon,
  ChartBarIcon,
  ChartPieIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  MoonIcon,
  SunIcon,
  EyeIcon,
  EyeSlashIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

const NavItem = React.memo(({ to, icon: IconComponent, children, onClick }) => {
  const baseClasses = "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200";
  const activeClasses = "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium";
  const inactiveClasses = "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800";

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${baseClasses} ${inactiveClasses} w-full text-left`}
      >
        <IconComponent className="h-5 w-5" />
        <span>{children}</span>
      </button>
    );
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) => 
        `${baseClasses} ${isActive ? activeClasses : inactiveClasses}`
      }
    >
      <Icon className="h-5 w-5" />
      <span>{children}</span>
    </NavLink>
  );
});

NavItem.displayName = 'NavItem';

export default function Sidebar({ onClose }) {
  const navigate = useNavigate();
  const { user, darkMode, toggleDarkMode } = useFinanceData();
  const { privacyMode, setPrivacyMode } = usePrivacy();

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      navigate('/login');
      if (onClose) onClose();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, [navigate, onClose]);

  return (
    <aside className="h-full flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      {/* Logo/Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Finance Dashboard
        </h2>
        {user && (
          <div className="mt-3 flex items-center gap-3">
            <UserCircleIcon className="h-8 w-8 text-gray-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user.displayName || 'User'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user.email}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <NavItem to="/" icon={HomeIcon}>
          Dashboard
        </NavItem>
        <NavItem to="/accounts" icon={BanknotesIcon}>
          Accounts
        </NavItem>
        <NavItem to="/balance-sheet" icon={ChartBarIcon}>
          Balance Sheet
        </NavItem>
        <NavItem to="/investment-allocation" icon={ChartPieIcon}>
          Investments
        </NavItem>
      </nav>

      {/* Settings Section */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-1">
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 w-full text-left"
        >
          {darkMode ? (
            <>
              <SunIcon className="h-5 w-5" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <MoonIcon className="h-5 w-5" />
              <span>Dark Mode</span>
            </>
          )}
        </button>

        {/* Privacy Mode Toggle */}
        <button
          onClick={() => setPrivacyMode(!privacyMode)}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 w-full text-left"
        >
          {privacyMode ? (
            <>
              <EyeIcon className="h-5 w-5" />
              <span>Show Numbers</span>
            </>
          ) : (
            <>
              <EyeSlashIcon className="h-5 w-5" />
              <span>Privacy Mode</span>
            </>
          )}
        </button>

        {/* Settings (placeholder) */}
        <button
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 w-full text-left opacity-50 cursor-not-allowed"
          disabled
        >
          <Cog6ToothIcon className="h-5 w-5" />
          <span>Settings</span>
        </button>

        {/* Logout */}
        <NavItem onClick={handleLogout} icon={ArrowRightOnRectangleIcon}>
          Logout
        </NavItem>
      </div>
    </aside>
  );
}
