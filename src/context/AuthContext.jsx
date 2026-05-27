import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { login as authLogin, logout as authLogout, observeAuthState } from '../services/authService.js';
import { getUserProfile } from '../services/userService.js';

const AuthContext = createContext(null);

function normalizeRole(profileData) {
  return String(profileData?.papel || '').normalize('NFC').trim().toLowerCase();
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = observeAuthState(async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const p = await getUserProfile(nextUser.uid);
        setProfile(p);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      role: normalizeRole(profile),
      loading,
      isAuthenticated: Boolean(user),
      login: authLogin,
      logout: authLogout,
    }),
    [user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
