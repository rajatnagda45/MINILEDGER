import { Redirect } from 'expo-router';
import { AuthRestorationState } from '@/components/auth-restoration-state';
import { useAuth } from '@/providers/auth-provider';

export default function IndexScreen() {
  const { token, isRestoring, restoreError, retryRestore } = useAuth();
  if (isRestoring || restoreError) return <AuthRestorationState error={restoreError} onRetry={retryRestore} />;
  return <Redirect href={token ? '/(app)' : '/(auth)/login'} />;
}

