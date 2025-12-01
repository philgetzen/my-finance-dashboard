import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { FinanceDataProvider, PrivacyProvider, useFinanceData } from './contexts/ConsolidatedDataContext';
import { queryClient } from './lib/queryClient';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/ui/LoadingSpinner';
import './App.css';

// Lazy load pages for better initial load performance
const Layout = lazy(() => import('./components/layout/Layout'));
const AuthenticationPage = lazy(() => import('./components/auth/AuthenticationPage'));
const YNABCallback = lazy(() => import('./components/auth/YNABCallback'));
const Dashboard = lazy(() => import('./components/pages/Dashboard'));
const Accounts = lazy(() => import('./components/pages/Accounts'));
const CashFlow = lazy(() => import('./components/pages/CashFlow'));
const InvestmentAllocation = lazy(() => import('./components/pages/InvestmentAllocation'));

// Loading component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <LoadingSpinner size="lg" />
  </div>
);

// Root App component
export default function App() {
  // Add resize animation stopper for better performance
  useEffect(() => {
    let resizeTimer;
    const handleResize = () => {
      document.body.classList.add('resize-animation-stopper');
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        document.body.classList.remove('resize-animation-stopper');
      }, 400);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <PrivacyProvider>
          <FinanceDataProvider>
            <Suspense fallback={<PageLoader />}>
              <Router>
                <Routes>
                  <Route path="/login" element={<LoginWrapper />} />
                  <Route path="/auth/ynab/callback" element={<YNABCallback />} />
                  <Route path="/*" element={<ProtectedRoutes />} />
                </Routes>
              </Router>
            </Suspense>
          </FinanceDataProvider>
        </PrivacyProvider>
      </ErrorBoundary>
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}

// Login wrapper component
function LoginWrapper() {
  const { user, loading, isDemoMode } = useFinanceData();

  if (loading) {
    return <PageLoader />;
  }

  // If in demo mode, redirect to dashboard
  if (isDemoMode) {
    return <Navigate to="/" replace />;
  }

  // Always show AuthenticationPage - it will handle the authenticated state
  return <AuthenticationPage />;
}

// Protected routes wrapper
function ProtectedRoutes() {
  const { user, loading, isDemoMode } = useFinanceData();

  if (loading) {
    return <PageLoader />;
  }

  // Allow access if user is authenticated OR in demo mode
  if (!user && !isDemoMode) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/spending" element={<CashFlow />} />
          <Route path="/investments" element={<InvestmentAllocation />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
