import React from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../../firebase';
import Button from '../ui/Button';

export default function LoginCard({ onSuccess, onError }) {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setIsLoading(true);
    try {
      await signInWithPopup(auth, provider);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Login error:", err);
      const errorMessage = err.message || 'Failed to authenticate with Google';
      if (onError) {
        onError(errorMessage);
      } else {
        alert(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2" id="google-auth-title">
          Sign In with Google
        </h2>
        <p className="text-gray-600 dark:text-gray-400" id="google-auth-description">
          Get started with your Google account
        </p>
      </div>

      <Button
        onClick={handleGoogleLogin}
        loading={isLoading}
        className="w-full"
        variant="outline"
        aria-describedby="google-auth-title google-auth-description google-auth-security"
        aria-label={isLoading ? "Signing in with Google, please wait" : "Sign in with Google authentication"}
        disabled={isLoading}
      >
        <svg 
          className="w-5 h-5 mr-3" 
          viewBox="0 0 24 24"
          aria-hidden="true"
          role="img"
          aria-label="Google logo"
        >
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {isLoading ? 'Signing in...' : 'Continue with Google'}
      </Button>

      <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
        <p id="google-auth-security">Secure authentication powered by Google</p>
      </div>
    </>
  );
}