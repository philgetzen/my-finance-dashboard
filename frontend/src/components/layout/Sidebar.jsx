import React from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  EyeIcon
} from '@heroicons/react/24/outline';

const navItems = [
  { name: 'Dashboard', path: '/', icon: HomeIcon },
  { name: 'Accounts', path: '/accounts', icon: CreditCardIcon },
  { name: 'Balance Sheet', path: '/balance-sheet', icon: ListBulletIcon },
  { name: 'Investments', path: '/investment-allocation', icon: BanknotesIcon },
  { name: 'Holdings', path: '/holdings', icon: TrophyIcon },
];

export default function Sidebar({ darkMode, setDarkMode }) {
  const location = useLocation();
  const { isPrivacyMode, togglePrivacyMode } = usePrivacy();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  return (
    <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col min-h-screen shrink-0">
      {/* Logo */}
      <div className="p-4 lg:p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-green-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">HW</span>
          </div>
          <span className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white">Healthy Wealth</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 lg:px-4 py-4 lg:py-6 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <item.icon
                className={`mr-3 h-5 w-5 transition-colors ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                }`}
              />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
        
        {/* Settings and Theme */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <Button
            onClick={() => setDarkMode(!darkMode)}
            variant="outline"
            className="w-full flex items-center gap-2"
          >
            {darkMode ? (
              <SunIcon className="h-4 w-4" />
            ) : (
              <MoonIcon className="h-4 w-4" />
            )}
            <span className="truncate">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </Button>
          
          <Button
            onClick={togglePrivacyMode}
            variant="outline"
            className="w-full flex items-center gap-2"
          >
            {isPrivacyMode ? (
              <EyeIcon className="h-4 w-4" />
            ) : (
              <EyeSlashIcon className="h-4 w-4" />
            )}
            <span className="truncate">{isPrivacyMode ? 'Show Numbers' : 'Privacy Mode'}</span>
          </Button>
          
          <Button
            variant="outline"
            className="w-full flex items-center gap-2"
          >
            <Cog6ToothIcon className="h-4 w-4" />
            <span className="truncate">Settings</span>
          </Button>
        </div>
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 lg:p-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full flex items-center gap-2 text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
          <span className="truncate">Sign Out</span>
        </Button>
      </div>
    </div>
  );
}