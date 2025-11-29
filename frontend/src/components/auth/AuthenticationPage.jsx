import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import YNABConnectionCard from '../ui/YNABConnectionCard';
import { useFinanceData } from '../../contexts/ConsolidatedDataContext';

// Authentication states
const AUTH_STATES = {
  LOGGED_OUT: 'logged_out',           // No authentication
  GOOGLE_ONLY: 'google_only',         // Google authenticated, YNAB not connected
  YNAB_CONNECTING: 'ynab_connecting', // YNAB connection in progress
  FULLY_AUTHENTICATED: 'fully_authenticated' // Both Google and YNAB connected
};

export default function AuthenticationPage() {
  const navigate = useNavigate();
  const { 
    user, 
    initializeDemoMode, 
    saveYNABToken, 
    ynabToken, 
    isAutoConnectingYNAB,
    autoConnectMessage,
    hasAutoConnected,
    logout
  } = useFinanceData();
  const [authState, setAuthState] = useState(AUTH_STATES.LOGGED_OUT);
  const [googleAuthError, setGoogleAuthError] = useState(null);
  const [ynabAuthError, setYnabAuthError] = useState(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Update auth state based on user and token status
  useEffect(() => {
    if (!user && !ynabToken) {
      setAuthState(AUTH_STATES.LOGGED_OUT);
    } else if (user && !ynabToken) {
      setAuthState(AUTH_STATES.GOOGLE_ONLY);
    } else if (user && ynabToken) {
      setAuthState(AUTH_STATES.FULLY_AUTHENTICATED);
    }
  }, [user, ynabToken]);

  const handleDemoMode = () => {
    initializeDemoMode();
    navigate('/');
  };

  const handleGoogleAuthSuccess = () => {
    setGoogleAuthError(null);
    // State will automatically update via useEffect when user changes
  };

  const handleGoogleAuthError = (error) => {
    setGoogleAuthError(error);
    setAuthState(AUTH_STATES.LOGGED_OUT);
  };

  const handleYNABConnect = async (accessToken, refreshToken) => {
    try {
      setYnabAuthError(null);
      setAuthState(AUTH_STATES.YNAB_CONNECTING);
      await saveYNABToken(accessToken, refreshToken);
      // State will automatically update to FULLY_AUTHENTICATED via useEffect
    } catch (error) {
      setYnabAuthError(error.message || 'Failed to connect YNAB');
      setAuthState(AUTH_STATES.GOOGLE_ONLY);
    }
  };

  const handleYNABError = (error) => {
    setYnabAuthError(error);
    setAuthState(AUTH_STATES.GOOGLE_ONLY);
  };

  const handleContinueToDashboard = () => {
    navigate('/');
  };

  const handleRetryYNAB = () => {
    setYnabAuthError(null);
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      const { auth } = await import('../../firebase');
      
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      handleGoogleAuthSuccess();
    } catch (err) {
      console.error("Login error:", err);
      const errorMessage = err.message || 'Failed to authenticate with Google';
      handleGoogleAuthError(errorMessage);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Determine what UI elements should be shown based on auth state
  const shouldShowDemoMode = authState !== AUTH_STATES.FULLY_AUTHENTICATED;
  const shouldShowContinueButton = authState === AUTH_STATES.FULLY_AUTHENTICATED;
  const isYNABDisabled = authState === AUTH_STATES.LOGGED_OUT;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8">
      <main className="w-full max-w-md sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl" role="main">
        {/* Header */}
        <header className="text-center mb-8 sm:mb-10 lg:mb-12">
          <div 
            className="mx-auto w-14 h-14 sm:w-16 sm:h-16 lg:w-18 lg:h-18 bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center mb-4"
            role="img"
            aria-label="Healthy Wealth logo"
          >
            <span className="text-white font-bold text-lg sm:text-xl lg:text-2xl" aria-hidden="true">HW</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome to Healthy Wealth
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Your personal finance wellness dashboard
          </p>
        </header>

        {/* Authentication Progress Indicator */}
        {authState !== AUTH_STATES.LOGGED_OUT && (
          <div className="mb-6 text-center">
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
              <div className={`flex items-center ${user ? 'text-green-600 dark:text-green-400' : ''}`}>
                <div className={`w-3 h-3 rounded-full mr-2 ${user ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                Google Account
              </div>
              <div className="w-8 border-t border-gray-300 dark:border-gray-600"></div>
              <div className={`flex items-center ${ynabToken ? 'text-green-600 dark:text-green-400' : ''}`}>
                <div className={`w-3 h-3 rounded-full mr-2 ${ynabToken ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                YNAB Budget
              </div>
            </div>
          </div>
        )}

        {/* Authentication Options */}
        <section 
          className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8"
          aria-label="Authentication options"
        >
          {/* Google Auth Box */}
          <Card className="min-h-[320px] flex items-center">
            <div className="text-center w-full">
              {user ? (
                <>
                  {/* Authenticated state - match YNAB card structure */}
                  <svg 
                    className="mx-auto h-12 w-12 text-green-500 mb-4" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Welcome, {user.displayName || user.email}!
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    You're signed in with Google
                  </p>
                  {(isAutoConnectingYNAB || hasAutoConnected) && autoConnectMessage && (
                    <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">
                      {autoConnectMessage}
                    </p>
                  )}
                  <Button
                    onClick={logout}
                    variant="outline"
                    className="text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    aria-label="Sign out of Google account"
                  >
                    <svg 
                      className="w-4 h-4 mr-2" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  {/* Unauthenticated state - match YNAB card structure */}
                  <svg 
                    className="mx-auto h-12 w-12 text-blue-500 mb-4" 
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Sign In with Google
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Get started with your Google account
                  </p>
                  <Button
                    onClick={handleGoogleLogin}
                    loading={isGoogleLoading}
                    variant="outline"
                    className="w-full sm:w-auto"
                    aria-label="Sign in with Google authentication"
                    disabled={isGoogleLoading}
                  >
                    {isGoogleLoading ? 'Signing in...' : 'Continue with Google'}
                  </Button>
                </>
              )}
            </div>
          </Card>

          {/* YNAB Auth Box */}
          <Card className="min-h-[320px] flex items-center">
            <div className="w-full">
              <YNABConnectionCard 
                onConnect={handleYNABConnect}
                onError={handleYNABError}
                isConnected={!!ynabToken}
                isDisabled={isYNABDisabled}
                isConnecting={authState === AUTH_STATES.YNAB_CONNECTING}
                error={ynabAuthError}
                onRetry={handleRetryYNAB}
                compact={false}
              />
            </div>
          </Card>
        </section>

        {/* Action Section - Demo Mode or Continue Button */}
        <section className="text-center max-w-lg mx-auto" aria-label="Next steps">
          {/* Separator */}
          <div className="relative mb-4 sm:mb-6" role="separator" aria-label="Next steps">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                {shouldShowContinueButton ? 'ready' : 'or'}
              </span>
            </div>
          </div>

          {shouldShowContinueButton ? (
            /* Continue to Dashboard Section */
            <div className="mb-4">
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm sm:text-base lg:text-lg">
                🎉 All set! Your accounts are connected and ready.
              </p>
              <Button
                onClick={handleContinueToDashboard}
                variant="primary"
                size="lg"
                className="w-full sm:w-auto text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4"
                aria-label="Continue to your dashboard with connected accounts"
              >
                <svg 
                  className="w-5 h-5 mr-2" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                Continue to Dashboard
              </Button>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-3">
                View your real financial data and insights
              </p>
            </div>
          ) : (
            /* Demo Mode Section */
            <div className="mb-4">
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm sm:text-base lg:text-lg" id="demo-description">
                {authState === AUTH_STATES.LOGGED_OUT 
                  ? "Don't have a YNAB account yet?" 
                  : "Want to explore the demo instead?"}
              </p>
              <Button
                onClick={handleDemoMode}
                variant="outline"
                size="lg"
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:from-emerald-100 hover:to-green-100 dark:hover:from-emerald-900/30 dark:hover:to-green-900/30 hover:border-emerald-300 dark:hover:border-emerald-600 transition-all duration-200 text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4"
                aria-describedby="demo-description demo-features"
                aria-label="Try demo mode - experience all features with sample data, no signup required"
              >
                <svg 
                  className="w-5 h-5 mr-2" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Try Demo Mode
              </Button>
              
              <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 mb-3 mt-4" id="demo-features">
                Experience all features with realistic sample data
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-0" role="list" aria-label="Demo mode benefits">
                <div className="flex items-center text-xs lg:text-sm text-gray-400 dark:text-gray-500" role="listitem">
                  <svg 
                    className="w-3 h-3 lg:w-4 lg:h-4 mr-1" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  No signup required
                </div>
                <span className="hidden sm:inline mx-2 text-gray-300 dark:text-gray-600" aria-hidden="true">•</span>
                <div className="flex items-center text-xs lg:text-sm text-gray-400 dark:text-gray-500" role="listitem">
                  <svg 
                    className="w-3 h-3 lg:w-4 lg:h-4 mr-1" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  Safe & secure
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Next Steps Message for partial authentication */}
        {authState === AUTH_STATES.GOOGLE_ONLY && !ynabAuthError && (
          <div className="text-center max-w-lg mx-auto mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Great! Now connect your YNAB budget to see your real financial data, or try the demo to explore features first.
            </p>
          </div>
        )}

        {/* Error Messages */}
        {(googleAuthError || ynabAuthError) && (
          <div className="text-center max-w-lg mx-auto mt-4">
            {googleAuthError && (
              <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
                Google authentication failed: {googleAuthError}
              </div>
            )}
            {ynabAuthError && (
              <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
                <div className="flex items-center justify-between">
                  <span>YNAB connection failed: {ynabAuthError}</span>
                  <Button
                    onClick={handleRetryYNAB}
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 ml-2"
                  >
                    Retry
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}