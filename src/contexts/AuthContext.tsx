import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isEditor: boolean;
  loading: boolean;
  adminLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminLoading, setAdminLoading] = useState(true);
  // Once initial auth check completes, never show loading again
  const initialAuthDone = useRef(false);

  const checkUserRoles = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error checking user roles:', error);
      return { isAdmin: false, isEditor: false };
    }
    
    const roles = data?.map(r => r.role) || [];
    return {
      isAdmin: roles.includes('admin'),
      isEditor: roles.includes('editor') || roles.includes('admin')
    };
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (isMounted) {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const { isAdmin: adminStatus, isEditor: editorStatus } = await checkUserRoles(session.user.id);
          if (isMounted) {
            setIsAdmin(adminStatus);
            setIsEditor(editorStatus);
          }
        }
        setAdminLoading(false);
        setLoading(false);
        initialAuthDone.current = true;
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // After initial auth, silently refresh roles in background - never set loading
          setTimeout(async () => {
            if (isMounted) {
              const { isAdmin: adminStatus, isEditor: editorStatus } = await checkUserRoles(session.user.id);
              if (isMounted) {
                setIsAdmin(adminStatus);
                setIsEditor(editorStatus);
                // Only clear loading for initial auth flow
                if (!initialAuthDone.current) {
                  setAdminLoading(false);
                  setLoading(false);
                  initialAuthDone.current = true;
                }
              }
            }
          }, 0);
        } else {
          setIsAdmin(false);
          setIsEditor(false);
          if (!initialAuthDone.current) {
            setAdminLoading(false);
            setLoading(false);
            initialAuthDone.current = true;
          }
        }
      }
    );

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    // Reset loading states for fresh sign-in
    initialAuthDone.current = false;
    setAdminLoading(true);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signOut = async () => {
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setIsEditor(false);
    initialAuthDone.current = false;
    
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.log('Sign out from server failed, but local session cleared');
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isEditor, loading, adminLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
