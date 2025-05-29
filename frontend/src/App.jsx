import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { YNABDataProvider, PrivacyProvider, useYNAB } from './contexts/YNABDataContext.jsx';
import { queryClient } from './lib/queryClient';
import Layout from './components/layout/Layout';
import LoginCard from './components/auth/LoginCard';
import YNABCallback from './components/auth/YNABCallback';
import Dashboard from './components/pages/Dashboard';
import Accounts from './components/pages/Accounts';
import BalanceSheet from './components/pages/BalanceSheet';
import InvestmentAllocation from './components/pages/InvestmentAllocation';
// import Holdings from './components/pages/Holdings'; // Removed
import LoadingSpinner from './components/ui/LoadingSpinner';
import './App.css';

// Root App component
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PrivacyProvider>
        <YNABDataProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<LoginWrapper />} />
              <Route path="/auth/ynab/callback" element={<YNABCallback />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </Router>
        </YNABDataProvider>
      </PrivacyProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

// Login wrapper component
function LoginWrapper() {
  const { user, loading } = useYNAB();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <LoginCard />;
}

// Protected routes wrapper
function ProtectedRoutes() {
  const { user, loading } = useYNAB();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/balance-sheet" element={<BalanceSheet />} />
        <Route path="/investment-allocation" element={<InvestmentAllocation />} />
        {/* <Route path="/holdings" element={<Holdings />} /> */} {/* Removed */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}
