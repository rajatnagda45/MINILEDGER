import { StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '@/constants/theme';

export function BrandMark({ compact = false, tone = 'dark' }: { compact?: boolean; tone?: 'dark' | 'light' }) {
  return (
    <View style={styles.row} accessibilityLabel="MiniLedger">
      <View style={[styles.mark, compact && styles.compactMark]}>
        <View style={styles.barShort} />
        <View style={styles.barTall} />
        <View style={styles.dot} />
      </View>
      {!compact && <Text style={[styles.name, tone === 'light' && styles.nameLight]}>MiniLedger</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 42, height: 42, borderRadius: radii.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3 },
  compactMark: { width: 38, height: 38, borderRadius: 13 },
  barShort: { width: 5, height: 12, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.72)', alignSelf: 'flex-end', marginBottom: 11 },
  barTall: { width: 5, height: 20, borderRadius: 3, backgroundColor: colors.white, alignSelf: 'flex-end', marginBottom: 11 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#AFC3FF', alignSelf: 'flex-start', marginTop: 10 },
  name: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5, color: colors.ink },
  nameLight: { color: colors.white },
});

