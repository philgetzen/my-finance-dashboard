import { useState, useEffect, useCallback, useRef } from 'react';
import { XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import SummaryView from './SummaryView';
import CategoryView from './CategoryView';

const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 480;

/**
 * Debug Drawer - Floating panel for verifying calculations against YNAB
 * Activated by pressing 'D' twice quickly
 * Resizable by dragging the left edge
 */
export default function DebugDrawer({
  // Data from the app
  appData = {},
  // Function to fetch fresh comparison data
  onRefresh,
  // Loading state
  isLoading = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [lastKeyTime, setLastKeyTime] = useState(0);
  const [activeTab, setActiveTab] = useState('summary');
  const [width, setWidth] = useState(() => {
    // Restore width from localStorage if available
    const saved = localStorage.getItem('debugDrawerWidth');
    return saved ? Math.min(Math.max(parseInt(saved, 10), MIN_WIDTH), MAX_WIDTH) : DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const drawerRef = useRef(null);

  // Handle 'D' key double-press to toggle drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key.toLowerCase() === 'd') {
        const now = Date.now();
        if (now - lastKeyTime < 500) {
          // Double press detected
          setIsOpen(prev => !prev);
          setLastKeyTime(0);
        } else {
          setLastKeyTime(now);
        }
      }

      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lastKeyTime, isOpen]);

  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      onRefresh();
    }
  }, [onRefresh]);

  // Handle resize
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const newWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.min(Math.max(newWidth, MIN_WIDTH), MAX_WIDTH);
      setWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // Save width to localStorage
      localStorage.setItem('debugDrawerWidth', width.toString());
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, width]);

  if (!isOpen) return null;

  return (
    <div
      ref={drawerRef}
      style={{ width: `${width}px` }}
      className={`fixed right-0 top-0 h-full bg-gray-900 text-gray-100 shadow-2xl z-50 flex flex-col border-l border-gray-700 ${isResizing ? 'select-none' : ''}`}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-indigo-500 transition-colors z-10"
        title="Drag to resize"
      />
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-indigo-400">Debug Drawer</span>
          <span className="text-xs text-gray-500">(Press D twice to toggle)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-1.5 rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded hover:bg-gray-700 transition-colors"
            title="Close (Esc)"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'summary'
              ? 'bg-gray-800 text-indigo-400 border-b-2 border-indigo-400'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
          }`}
        >
          Summary
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'categories'
              ? 'bg-gray-800 text-indigo-400 border-b-2 border-indigo-400'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
          }`}
        >
          Categories
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'summary' ? (
          <SummaryView data={appData} isLoading={isLoading} />
        ) : (
          <CategoryView data={appData} isLoading={isLoading} />
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-700 bg-gray-800">
        <div className="text-xs text-gray-500">
          Period: {appData?.period || 'Not set'} |
          Last updated: {appData?.lastUpdated ? new Date(appData.lastUpdated).toLocaleTimeString() : 'Never'}
        </div>
      </div>
    </div>
  );
}

/**
 * Status indicator for match/mismatch
 */
export function MatchIndicator({ isMatch, tolerance = 0.01 }) {
  if (isMatch) {
    return <CheckCircleIcon className="h-4 w-4 text-green-500" title="Match" />;
  }
  return <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" title="Mismatch" />;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

/**
 * Check if two amounts match within tolerance
 */
export function amountsMatch(a, b, tolerance = 0.01) {
  return Math.abs((a || 0) - (b || 0)) <= tolerance;
}
