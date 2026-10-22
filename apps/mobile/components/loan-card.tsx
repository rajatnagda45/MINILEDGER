import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Loan } from '@miniledger/shared';
import { colors, radii, shadow, spacing, type } from '@/constants/theme';
import { formatCurrency, formatDate, initials } from '@/lib/format';

export function LoanCard({ loan, onPress, onRepay, repaying = false }: { loan: Loan; onPress: () => void; onRepay: () => void; repaying?: boolean }) {
  const repaid = loan.status === 'REPAID';
  return (
    <View style={[styles.card, loan.isOverdue && styles.overdueCard]}>
      {loan.isOverdue && <View style={styles.overdueRail} />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${loan.friendName}, ${formatCurrency(loan.amount)}, ${loan.isOverdue ? 'overdue' : repaid ? 'repaid' : `due ${formatDate(loan.dueDate)}`}`}
        accessibilityHint="Opens loan details"
        onPress={onPress}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <View style={styles.topRow}>
          <View style={[styles.avatar, loan.isOverdue && styles.overdueAvatar, repaid && styles.repaidAvatar]}>
            <Text style={[styles.avatarText, loan.isOverdue && styles.overdueAvatarText, repaid && styles.repaidAvatarText]}>{initials(loan.friendName)}</Text>
          </View>
          <View style={styles.identity}>
            <Text style={styles.name} numberOfLines={1}>{loan.friendName}</Text>
            <View style={styles.metaRow}>
              <Ionicons name={repaid ? 'checkmark-circle-outline' : 'calendar-outline'} size={14} color={loan.isOverdue ? colors.danger : repaid ? colors.success : colors.muted} />
              <Text numberOfLines={1} style={[styles.meta, loan.isOverdue && styles.overdueText, repaid && styles.repaidText]}>
                {repaid ? `Repaid ${loan.repaidAt ? new Date(loan.repaidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}` : `Due ${formatDate(loan.dueDate)}`}
              </Text>
            </View>
          </View>
          <View style={styles.amountBlock}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={[styles.amount, repaid && styles.amountRepaid]}>{formatCurrency(loan.amount)}</Text>
            <View style={[styles.badge, loan.isOverdue ? styles.badgeOverdue : repaid ? styles.badgeRepaid : styles.badgeActive]}>
              <Text style={[styles.badgeText, loan.isOverdue ? styles.badgeTextOverdue : repaid ? styles.badgeTextRepaid : styles.badgeTextActive]}>
                {loan.isOverdue ? 'OVERDUE' : repaid ? 'REPAID' : 'ACTIVE'}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>

      {!repaid && (
        <View style={styles.footer}>
          {loan.receiptAvailable && <View style={styles.receiptLabel}>
            <Ionicons name="receipt" size={15} color={colors.muted} />
            <Text style={styles.receiptText}>Receipt attached</Text>
          </View>}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Mark ${loan.friendName}'s loan as repaid`}
            accessibilityState={{ disabled: repaying, busy: repaying }}
            disabled={repaying}
            onPress={onRepay}
            hitSlop={8}
            style={({ pressed }) => [styles.repay, pressed && styles.repayPressed, repaying && styles.disabled]}
          >
            <Ionicons name="checkmark" size={16} color={colors.primary} />
            <Text style={styles.repayText}>{repaying ? 'Updating…' : 'Mark repaid'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', ...shadow },
  // Overdue uses a single dominant cue — the coral rail — supported sparingly by
  // the badge and due-date text. No full-surface tint, so the row stays calm.
  overdueCard: { borderColor: colors.dangerLine },
  overdueRail: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 4, backgroundColor: colors.danger },
  main: { padding: spacing.md },
  pressed: { opacity: 0.75, backgroundColor: colors.canvas },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  overdueAvatar: { backgroundColor: colors.dangerSoft },
  repaidAvatar: { backgroundColor: colors.successSoft },
  avatarText: { ...type.caption, fontSize: 13, color: colors.primaryDark },
  overdueAvatarText: { color: colors.danger },
  repaidAvatarText: { color: colors.success },
  identity: { flex: 1, gap: 5 },
  name: { ...type.h3, color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { ...type.caption, color: colors.muted, flexShrink: 1 },
  overdueText: { color: colors.danger },
  repaidText: { color: colors.success },
  amountBlock: { alignItems: 'flex-end', gap: 7, maxWidth: '38%' },
  amount: { ...type.h3, color: colors.ink, fontVariant: ['tabular-nums'], maxWidth: 120 },
  amountRepaid: { color: colors.inkSoft, textDecorationLine: 'line-through' },
  badge: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 4 },
  badgeActive: { backgroundColor: colors.primarySoft },
  badgeOverdue: { backgroundColor: colors.dangerSoft },
  badgeRepaid: { backgroundColor: colors.successSoft },
  badgeText: { ...type.micro },
  badgeTextActive: { color: colors.primaryDark },
  badgeTextOverdue: { color: colors.danger },
  badgeTextRepaid: { color: colors.success },
  footer: { minHeight: 54, paddingHorizontal: spacing.md, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  receiptLabel: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  receiptText: { ...type.caption, color: colors.muted },
  repay: { minHeight: 40, borderRadius: radii.sm, backgroundColor: colors.primarySoft, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  repayPressed: { opacity: 0.7 },
  repayText: { ...type.caption, color: colors.primaryDark },
  disabled: { opacity: 0.5 },
});

