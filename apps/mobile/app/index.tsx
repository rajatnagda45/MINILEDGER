import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { BrandMark } from '@/components/brand-mark';
import { colors, spacing, type } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

export default function IndexScreen() {
  const { token, isRestoring } = useAuth();
  if (!isRestoring) return <Redirect href={token ? '/(app)' : '/(auth)/login'} />;
  return (
    <View style={styles.container}>
      <View style={styles.brand}><BrandMark /><Text style={styles.tagline}>Money lent, clearly remembered.</Text></View>
      <View style={styles.loadingLine}><View style={styles.loadingFill} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  brand: { alignItems: 'center', gap: spacing.md },
  tagline: { ...type.body, color: colors.muted },
  loadingLine: { position: 'absolute', bottom: 72, width: 86, height: 3, backgroundColor: colors.line, borderRadius: 2, overflow: 'hidden' },
  loadingFill: { width: '62%', height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
});

