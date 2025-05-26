import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function YNABCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Get the authorization code from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
      // Handle error
      console.error('YNAB authorization error:', error);
      window.close();
      return;
    }

    if (code) {
      // Send the code back to the parent window
      if (window.opener) {
        window.opener.postMessage({
          type: 'ynab-auth-success',
          code: code
        }, window.location.origin);
        window.close();
      } else {
        // If no opener, redirect to dashboard
        navigate('/');
      }
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
