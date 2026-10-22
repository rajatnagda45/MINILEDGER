import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { colors } from '@/constants/theme';

export default function AppLayout() {
  const { token, isRestoring } = useAuth();
  if (!isRestoring && !token) return <Redirect href="/(auth)/login" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />;
}

