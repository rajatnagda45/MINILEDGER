import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, type } from '@/constants/theme';

export function LoadingState({ label = 'Loading your ledger…' }: { label?: string }) {
  return (
    <View style={styles.loading} accessibilityLiveRegion="polite">
      <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.stateCard}>
      <View style={[styles.icon, styles.errorIcon]}><Ionicons name="cloud-offline-outline" size={25} color={colors.danger} /></View>
      <Text style={styles.title}>We couldn’t load this</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 52, alignItems: 'center', gap: spacing.md },
  loader: { width: 50, height: 50, backgroundColor: colors.primarySoft, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  loadingText: { ...type.body, color: colors.muted },
  stateCard: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  icon: { width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  errorIcon: { backgroundColor: colors.dangerSoft },
  title: { ...type.h3, color: colors.ink },
  message: { ...type.body, color: colors.muted, textAlign: 'center' },
  retry: { marginTop: spacing.xs, minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg },
  retryText: { ...type.bodyStrong, color: colors.primary },
});

