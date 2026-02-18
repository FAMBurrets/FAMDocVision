import React, { useState } from 'react';
import { Shield, X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Admin credentials - in production, use environment variables
const ADMIN_USERNAME = import.meta.env.VITE_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'DocVision2024!';

export default function LoginScreen() {
  const { signInWithAzure, signInAsAdmin, authError } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Show domain restriction error from auth context
  const displayError = authError || error;

  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithAzure();
    } catch (err) {
      setError('Failed to sign in. Please try again.');
      setIsLoading(false);
    }
  };

  const handleAdminSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);

    if (adminUsername === ADMIN_USERNAME && adminPassword === ADMIN_PASSWORD) {
      signInAsAdmin();
    } else {
      setAdminError('Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen bg-brand-navy flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-10 max-w-md w-full text-center">
        <img
          src="/fam-brands-logo.webp"
          alt="Fam Brands"
          className="h-12 w-auto mx-auto mb-6"
        />

        <h1 className="text-3xl font-bold text-brand-navy mb-1">DocVision</h1>
        <p className="text-sm text-slate-500 mb-4">Media Management Platform</p>
        <p className="text-slate-500 mb-8">
          Sign in to manage your media presentations
        </p>

        {displayError && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-6 text-sm">
            {displayError}
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={isLoading}
          className="w-full bg-brand-navy hover:bg-brand-navy-light disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 shadow-lg"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Signing in...
            </span>
          ) : (
            <>
              <svg width="21" height="21" viewBox="0 0 21 21" fill="none">
                <rect width="10" height="10" fill="#F25022"/>
                <rect x="11" width="10" height="10" fill="#7FBA00"/>
                <rect y="11" width="10" height="10" fill="#00A4EF"/>
                <rect x="11" y="11" width="10" height="10" fill="#FFB900"/>
              </svg>
              Sign in with Microsoft
            </>
          )}
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-white text-slate-400">or</span>
          </div>
        </div>

        {!showAdminLogin ? (
          <button
            onClick={() => setShowAdminLogin(true)}
            className="w-full bg-brand-red/10 hover:bg-brand-red/20 text-brand-red px-6 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 border border-brand-red/20"
          >
            <Shield size={18} />
            Admin Login (Dev)
          </button>
        ) : (
          <form onSubmit={handleAdminSignIn} className="text-left">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Shield size={16} /> Admin Login
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowAdminLogin(false);
                  setAdminError(null);
                  setAdminUsername('');
                  setAdminPassword('');
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {adminError && (
              <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg mb-3 text-sm">
                {adminError}
              </div>
            )}

            <input
              type="text"
              placeholder="Username"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 mb-3 focus:outline-none focus:ring-2 focus:ring-brand-red focus:bg-white"
              autoComplete="username"
            />

            <div className="relative mb-4">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-brand-red focus:bg-white"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button
              type="submit"
              className="w-full bg-brand-red hover:bg-brand-red-dark text-white px-4 py-2.5 rounded-lg font-semibold transition-all"
            >
              Sign In
            </button>
          </form>
        )}

        <p className="text-xs text-slate-400 mt-6">
          Protected by Microsoft Azure AD
        </p>
      </div>
    </div>
  );
}
