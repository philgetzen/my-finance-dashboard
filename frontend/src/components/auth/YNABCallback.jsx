import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function YNABCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    console.log('=== YNAB Callback component loaded ===');
    console.log('Current URL:', window.location.href);
    console.log('Search params:', window.location.search);
    console.log('Window opener exists:', !!window.opener);
    
    // Get the authorization code from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    const state = urlParams.get('state');

    console.log('OAuth callback params:', { 
      code: code ? `EXISTS (${code.substring(0, 10)}...)` : 'MISSING', 
      error, 
      errorDescription,
      state 
    });

    if (error) {
      // Handle error
      console.error('❌ YNAB authorization error:', { error, errorDescription });
      
      if (window.opener) {
        console.log('Sending error message to parent window');
        window.opener.postMessage({
          type: 'ynab-auth-error',
          error: error,
          description: errorDescription
        }, window.location.origin);
      }
      
      console.log('Closing callback window due to error');
      window.close();
      return;
    }

    if (code) {
      console.log('✅ Authorization code received, sending to parent window');
      
      // Send the code back to the parent window
      if (window.opener) {
        console.log('Posting success message to parent');
        window.opener.postMessage({
          type: 'ynab-auth-success',
          code: code
        }, window.location.origin);
        
        console.log('Closing callback window after successful auth');
        window.close();
      } else {
        console.log('⚠️ No opener window found, redirecting to dashboard');
        // If no opener, redirect to dashboard
        navigate('/');
      }
    } else {
      console.error('❌ No authorization code or error found in callback URL');
      console.log('Full URL breakdown:', {
        href: window.location.href,
        search: window.location.search,
        hash: window.location.hash,
        pathname: window.location.pathname
      });
      
      if (window.opener) {
        console.log('Sending no-code error to parent window');
        window.opener.postMessage({
          type: 'ynab-auth-error',
          error: 'no_code',
          description: 'No authorization code received from YNAB'
        }, window.location.origin);
      }
      
      console.log('Closing callback window due to missing code');
      window.close();
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Connecting to YNAB...
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Please wait while we complete the authorization.
        </p>
      </div>
    </div>
  );
}
