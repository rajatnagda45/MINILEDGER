import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { colors } from '@/constants/theme';

export default function AuthLayout() {
  const { token, isRestoring } = useAuth();
  if (!isRestoring && token) return <Redirect href="/(app)" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />;
}

