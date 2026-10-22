import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, configureApi } from '@/lib/api';
import { tokenStorage } from '@/lib/storage';

interface AuthContextValue {
  token: string | null;
  isRestoring: boolean;
  signIn(phoneNumber: string, otp: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [isRestoring, setRestoring] = useState(true);
  const queryClient = useQueryClient();

  const signOut = useCallback(async () => {
    configureApi(null);
    setToken(null);
    queryClient.clear();
    await tokenStorage.clear();
  }, [queryClient]);

  useEffect(() => {
    tokenStorage.get().then((saved) => {
      configureApi(saved, () => void signOut());
      setToken(saved);
    }).finally(() => setRestoring(false));
  }, [signOut]);

  const signIn = useCallback(async (phoneNumber: string, otp: string) => {
    const session = await api.verifyOtp(phoneNumber, otp);
    await tokenStorage.set(session.token);
    configureApi(session.token, () => void signOut());
    setToken(session.token);
  }, [signOut]);

  const value = useMemo(() => ({ token, isRestoring, signIn, signOut }), [token, isRestoring, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

