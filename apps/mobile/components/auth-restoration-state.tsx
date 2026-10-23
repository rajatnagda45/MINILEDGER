import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/button';
import { LoadingState } from '@/components/state-view';
import { colors, radii, spacing, type } from '@/constants/theme';

export function AuthRestorationState({ error, onRetry }: { error?: string | null; onRetry: () => void }) {
  if (!error) {
    return (
      <View style={styles.page} accessibilityLiveRegion="polite">
        <LoadingState label="Restoring your secure session…" />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.card} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <View style={styles.icon}><Ionicons name="cloud-offline-outline" size={26} color={colors.warning} /></View>
        <Text style={styles.title}>Couldn’t verify your session</Text>
        <Text style={styles.message}>{error}</Text>
        <Text style={styles.note}>Stored credentials are cleared only when the server rejects the session.</Text>
        <Button label="Try again" onPress={onRetry} style={styles.action} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, minHeight: 320, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.xl, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  icon: { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  title: { ...type.h2, color: colors.ink, textAlign: 'center' },
  message: { ...type.body, color: colors.inkSoft, textAlign: 'center' },
  note: { ...type.caption, color: colors.muted, textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: spacing.sm },
});
