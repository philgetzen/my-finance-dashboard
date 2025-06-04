import React, { Suspense, lazy } from 'react';
import LoadingSpinner from './LoadingSpinner';

// Lazy load chart components for better performance
const PieChart = lazy(() => 
  import('recharts').then(module => ({ default: module.PieChart }))
);
const Pie = lazy(() => 
  import('recharts').then(module => ({ default: module.Pie }))
);
const Cell = lazy(() => 
  import('recharts').then(module => ({ default: module.Cell }))
);
const Tooltip = lazy(() => 
  import('recharts').then(module => ({ default: module.Tooltip }))
);
const ResponsiveContainer = lazy(() => 
  import('recharts').then(module => ({ default: module.ResponsiveContainer }))
);
const BarChart = lazy(() => 
  import('recharts').then(module => ({ default: module.BarChart }))
);
const Bar = lazy(() => 
  import('recharts').then(module => ({ default: module.Bar }))
);
const XAxis = lazy(() => 
  import('recharts').then(module => ({ default: module.XAxis }))
);
const YAxis = lazy(() => 
  import('recharts').then(module => ({ default: module.YAxis }))
);
const CartesianGrid = lazy(() => 
  import('recharts').then(module => ({ default: module.CartesianGrid }))
);
const LineChart = lazy(() => 
  import('recharts').then(module => ({ default: module.LineChart }))
);
const Line = lazy(() => 
  import('recharts').then(module => ({ default: module.Line }))
);

// Chart loading skeleton
const ChartSkeleton = ({ height = 300 }) => (
  <div 
    className="flex items-center justify-center animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg"
    style={{ height }}
  >
    <LoadingSpinner size="lg" />
  </div>
);

// Lazy loaded chart wrapper
export const LazyChart = ({ children, height = 300 }) => (
  <Suspense fallback={<ChartSkeleton height={height} />}>
    {children}
  </Suspense>
);

// Export lazy loaded components
export {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line
};
