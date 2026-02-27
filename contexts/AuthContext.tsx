import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authError: string | null;
  signInWithAzure: () => Promise<void>;
  signInAsAdmin: () => void;
  signOut: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ALLOWED_DOMAIN = '@fambrands.com';

function isAllowedEmail(email: string | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(ALLOWED_DOMAIN);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !isAllowedEmail(session.user.email)) {
        // User email not from allowed domain - sign them out
        supabase.auth.signOut();
        setAuthError('Access restricted to @fambrands.com email addresses.');
        setSession(null);
        setUser(null);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user && !isAllowedEmail(session.user.email)) {
          // User email not from allowed domain - sign them out
          supabase.auth.signOut();
          setAuthError('Access restricted to @fambrands.com email addresses.');
          setSession(null);
          setUser(null);
        } else {
          setAuthError(null);
          setSession(session);
          setUser(session?.user ?? null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signInWithAzure = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email profile openid',
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      console.error('Error signing in with Azure:', error.message);
      throw error;
    }
  };

  const signInAsAdmin = () => {
    // Create a mock admin user for local development
    const mockAdminUser = {
      id: 'admin-dev-user',
      email: 'admin@fambrands.com',
      user_metadata: {
        full_name: 'Admin (Dev)',
      },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as User;

    setUser(mockAdminUser);
    setSession({ user: mockAdminUser } as Session);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error.message);
      throw error;
    }
  };

  const updateProfile = async (displayName: string) => {
    // For mock admin user, just update local state
    if (user?.id === 'admin-dev-user') {
      setUser({
        ...user,
        user_metadata: { ...user.user_metadata, full_name: displayName },
      } as User);
      return;
    }

    // For real Supabase users
    const { data, error } = await supabase.auth.updateUser({
      data: { full_name: displayName },
    });
    if (error) {
      console.error('Error updating profile:', error.message);
      throw error;
    }
    if (data.user) {
      setUser(data.user);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, authError, signInWithAzure, signInAsAdmin, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
