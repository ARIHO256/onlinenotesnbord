import React, { createContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAuthToken, setUnauthorizedHandler } from '../api/client';

type AuthContextType = {
  token: string | null;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  ready: boolean;
};

export const AuthContext = createContext<AuthContextType>({
  token: null,
  signIn: async () => {},
  signOut: async () => {},
  ready: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('authToken');
      if (stored) {
        setToken(stored);
        setAuthToken(stored);
      }
      setReady(true);
    })();
  }, []);

  const handleSignIn = useCallback(async (t: string) => {
    setToken(t);
    setAuthToken(t);
    await AsyncStorage.setItem('authToken', t);
  }, []);

  const handleSignOut = useCallback(async () => {
    setToken(null);
    setAuthToken(undefined);
    await AsyncStorage.removeItem('authToken');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(handleSignOut);
    return () => setUnauthorizedHandler(null);
  }, [handleSignOut]);

  const value = useMemo(
    () => ({
      token,
      ready,
      signIn: handleSignIn,
      signOut: handleSignOut,
    }),
    [token, ready, handleSignIn, handleSignOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

