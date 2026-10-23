import { Redirect, Stack } from 'expo-router';
import { AuthRestorationState } from '@/components/auth-restoration-state';
import { useAuth } from '@/providers/auth-provider';
import { colors } from '@/constants/theme';

export default function AppLayout() {
  const { token, isRestoring, restoreError, retryRestore } = useAuth();
  if (isRestoring || restoreError) return <AuthRestorationState error={restoreError} onRetry={retryRestore} />;
  if (!token) return <Redirect href="/(auth)/login" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />;
}

