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
} from '@heroicons/react/24/outline';

const NavItem = React.memo(({ to, icon: IconComponent, children, onClick, onNavigate }) => {
  const baseClasses = "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-150 text-sm font-medium";
  const activeClasses = "bg-[var(--sidebar-active)] text-white border-l-2 border-[var(--accent-purple)] -ml-[2px] pl-[18px]";
  const inactiveClasses = "text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)]";

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${baseClasses} ${inactiveClasses} w-full text-left`}
      >
        <IconComponent className="h-5 w-5 flex-shrink-0" />
        <span>{children}</span>
      </button>
    );
  }

  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `${baseClasses} ${isActive ? activeClasses : inactiveClasses}`
      }
    >
      <IconComponent className="h-5 w-5 flex-shrink-0" />
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
    <aside className="h-full flex flex-col bg-[var(--sidebar-bg)]">
      {/* Logo/Header */}
      <div className="p-5 border-b border-[var(--sidebar-border)]">
        <h2 className="text-lg font-semibold text-white tracking-tight">
          Finance Dashboard
        </h2>
        {user && (
          <div className="mt-4 flex items-center gap-3">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="h-8 w-8 rounded-full ring-2 ring-[var(--sidebar-border)] object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-8 w-8 rounded-full ring-2 ring-[var(--sidebar-border)] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--sidebar-text)] truncate">
                {user.displayName || 'User'}
              </p>
              <p className="text-xs text-[var(--sidebar-text-muted)] truncate">
                {user.email}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <p className="px-4 py-2 text-xs font-medium text-[var(--sidebar-text-muted)] uppercase tracking-wider">
          Overview
        </p>
        <NavItem to="/" icon={HomeIcon} onNavigate={onClose}>
          Dashboard
        </NavItem>
        <NavItem to="/accounts" icon={BanknotesIcon} onNavigate={onClose}>
          Accounts
        </NavItem>

        <p className="px-4 py-2 mt-4 text-xs font-medium text-[var(--sidebar-text-muted)] uppercase tracking-wider">
          Reports
        </p>
        <NavItem to="/spending" icon={ChartBarIcon} onNavigate={onClose}>
          Spending
        </NavItem>
        <NavItem to="/investments" icon={ChartPieIcon} onNavigate={onClose}>
          Investments
        </NavItem>
      </nav>

      {/* Settings Section */}
      <div className="p-3 border-t border-[var(--sidebar-border)] space-y-1">
        <p className="px-4 py-2 text-xs font-medium text-[var(--sidebar-text-muted)] uppercase tracking-wider">
          Settings
        </p>

        {/* Dark Mode Toggle */}
        <button
          onClick={() => {
            toggleDarkMode();
            if (onClose) onClose();
          }}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)] transition-all duration-150 w-full text-left text-sm font-medium"
        >
          {darkMode ? (
            <>
              <SunIcon className="h-5 w-5 flex-shrink-0" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <MoonIcon className="h-5 w-5 flex-shrink-0" />
              <span>Dark Mode</span>
            </>
          )}
        </button>

        {/* Privacy Mode Toggle */}
        <button
          onClick={() => {
            setPrivacyMode(!privacyMode);
            if (onClose) onClose();
          }}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)] transition-all duration-150 w-full text-left text-sm font-medium"
        >
          {privacyMode ? (
            <>
              <EyeIcon className="h-5 w-5 flex-shrink-0" />
              <span>Show Numbers</span>
            </>
          ) : (
            <>
              <EyeSlashIcon className="h-5 w-5 flex-shrink-0" />
              <span>Privacy Mode</span>
            </>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-[var(--sidebar-text-muted)] hover:bg-red-500/10 hover:text-red-400 transition-all duration-150 w-full text-left text-sm font-medium"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5 flex-shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
