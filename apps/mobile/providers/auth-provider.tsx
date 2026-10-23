import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError, configureApi } from '@/lib/api';
import { tokenStorage } from '@/lib/storage';

interface AuthContextValue {
  token: string | null;
  isRestoring: boolean;
  restoreError: string | null;
  retryRestore(): void;
  signIn(phoneNumber: string, otp: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [isRestoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const lifecycle = useRef(0);

  const signOut = useCallback(async () => {
    lifecycle.current += 1;
    configureApi(null);
    setToken(null);
    setRestoreError(null);
    setRestoring(false);
    queryClient.clear();
    await tokenStorage.clear();
  }, [queryClient]);

  const restoreSession = useCallback(async () => {
    const attempt = ++lifecycle.current;
    setRestoring(true);
    setRestoreError(null);

    let saved: string | null;
    try {
      saved = await tokenStorage.get();
    } catch (error) {
      if (attempt !== lifecycle.current) return;
      configureApi(null);
      setToken(null);
      setRestoreError(error instanceof Error ? error.message : 'Couldn’t access the saved session.');
      setRestoring(false);
      return;
    }

    if (attempt !== lifecycle.current) return;
    if (!saved) {
      configureApi(null);
      setToken(null);
      setRestoring(false);
      return;
    }

    // Configure the token before validation, but do not install the global 401
    // handler until the one-time restoration request has completed. This keeps
    // invalid-session cleanup deterministic and prevents competing sign-outs.
    configureApi(saved);
    try {
      await api.validateSession();
      if (attempt !== lifecycle.current) return;
      configureApi(saved, () => void signOut());
      setToken(saved);
      setRestoring(false);
    } catch (error) {
      if (attempt !== lifecycle.current) return;
      if (error instanceof ApiError && error.status === 401) {
        await signOut();
        return;
      }

      // Transport failures do not prove that a signed token is invalid. Keep
      // it persisted and configured, but hold protected routes behind a retry.
      configureApi(saved, () => void signOut());
      setToken(saved);
      setRestoreError(error instanceof ApiError ? error.message : 'Couldn’t verify your saved session.');
      setRestoring(false);
    }
  }, [signOut]);

  useEffect(() => {
    void restoreSession();
    return () => { lifecycle.current += 1; };
  }, [restoreSession]);

  const signIn = useCallback(async (phoneNumber: string, otp: string) => {
    const session = await api.verifyOtp(phoneNumber, otp);
    await tokenStorage.set(session.token);
    configureApi(session.token, () => void signOut());
    setRestoreError(null);
    setToken(session.token);
  }, [signOut]);

  const value = useMemo(() => ({ token, isRestoring, restoreError, retryRestore: () => { void restoreSession(); }, signIn, signOut }), [token, isRestoring, restoreError, restoreSession, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

