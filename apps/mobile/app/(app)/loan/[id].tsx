import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/button';
import { ReceiptSection } from '@/components/receipt-section';
import { ErrorState, LoadingState } from '@/components/state-view';
import { colors, radii, shadow, spacing, type } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';
import { formatCurrency, formatDate, initials } from '@/lib/format';
import { useInteraction } from '@/providers/interaction-provider';

export default function LoanDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { confirm, notify } = useInteraction();
  const repaymentInFlight = useRef(false);
  const query = useQuery({ queryKey: ['loan', id], queryFn: ({ signal }) => api.loan(id, signal), enabled: Boolean(id) });
  const repay = useMutation({
    mutationFn: () => api.repayLoan(id),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['loan', id] }), queryClient.invalidateQueries({ queryKey: ['loans'] }), queryClient.invalidateQueries({ queryKey: ['summary'] })]);
      notify({ tone: 'success', title: 'Repayment recorded', message: query.data?.loan.friendName ? `${query.data.loan.friendName}’s loan is settled.` : 'This loan is now settled.' });
    },
    onError: (error) => notify({ tone: 'error', title: 'Couldn’t update loan', message: error instanceof ApiError ? error.message : 'Please try again.' }),
    onSettled: () => { repaymentInFlight.current = false; },
  });
  const loan = query.data?.loan;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.nav}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={colors.ink} /></Pressable>
          <Text style={styles.navTitle}>Loan details</Text><View style={styles.navSpacer} />
        </View>
        {query.isLoading && <LoadingState label="Opening loan…" />}
        {!!query.error && <ErrorState message={query.error instanceof ApiError ? query.error.message : 'Please check your connection.'} onRetry={() => void query.refetch()} />}
        {loan && (
          <>
            <View style={[styles.hero, loan.isOverdue && styles.heroOverdue]}>
              <View style={[styles.avatar, loan.isOverdue && styles.avatarOverdue, loan.status === 'REPAID' && styles.avatarRepaid]}><Text style={styles.avatarText}>{initials(loan.friendName)}</Text></View>
              <Text style={styles.name}>{loan.friendName}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={styles.amount}>{formatCurrency(loan.amount)}</Text>
              <View style={[styles.status, loan.isOverdue ? styles.statusOverdue : loan.status === 'REPAID' ? styles.statusRepaid : styles.statusActive]}>
                <Ionicons name={loan.isOverdue ? 'alert-circle' : loan.status === 'REPAID' ? 'checkmark-circle' : 'time'} size={15} color={loan.isOverdue ? colors.danger : loan.status === 'REPAID' ? colors.success : colors.primary} />
                <Text style={[styles.statusText, loan.isOverdue ? styles.textOverdue : loan.status === 'REPAID' ? styles.textRepaid : styles.textActive]}>{loan.isOverdue ? 'Payment overdue' : loan.status === 'REPAID' ? 'Fully repaid' : 'Payment outstanding'}</Text>
              </View>
            </View>
            <View style={styles.details}>
              <DetailRow icon="calendar-outline" label="Due date" value={formatDate(loan.dueDate)} warning={loan.isOverdue} />
              <DetailRow icon="add-circle-outline" label="Added on" value={new Date(loan.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
              {loan.repaidAt && <DetailRow icon="checkmark-circle-outline" label="Repaid on" value={new Date(loan.repaidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />}
            </View>
            <ReceiptSection loanId={loan.id} receipt={loan.receipt} />
            {loan.status === 'OUTSTANDING' && <Button label="Mark as repaid" loadingLabel="Marking as repaid…" loading={repay.isPending} onPress={() => confirm({ title: 'Confirm repayment', message: `Did ${loan.friendName} return ${formatCurrency(loan.amount)}?`, confirmLabel: 'Yes, mark repaid', pendingLabel: 'Marking as repaid…' }, async () => {
              if (repaymentInFlight.current) return;
              repaymentInFlight.current = true;
              await repay.mutateAsync();
            })} />}
            {loan.status === 'REPAID' && <View style={styles.settled}><Ionicons name="shield-checkmark-outline" size={22} color={colors.success} /><View style={styles.settledBody}><Text style={styles.settledTitle}>This loan is settled</Text><Text style={styles.settledCopy}>It no longer contributes to outstanding or overdue totals.</Text></View></View>}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value, warning = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; warning?: boolean }) {
  return <View style={styles.row}><View style={styles.rowIcon}><Ionicons name={icon} size={20} color={warning ? colors.danger : colors.inkSoft} /></View><Text style={styles.rowLabel}>{label}</Text><Text style={[styles.rowValue, warning && styles.textOverdue]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas }, content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.xl },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, back: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, navTitle: { ...type.h3, color: colors.ink }, navSpacer: { width: 44 },
  hero: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.line, padding: spacing.xl, alignItems: 'center', gap: spacing.sm, ...shadow }, heroOverdue: { borderColor: colors.dangerLine },
  avatar: { width: 68, height: 68, borderRadius: 25, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs }, avatarOverdue: { backgroundColor: colors.dangerSoft }, avatarRepaid: { backgroundColor: colors.successSoft }, avatarText: { fontSize: 18, fontWeight: '800', color: colors.ink },
  name: { ...type.h2, color: colors.ink }, amount: { ...type.display, color: colors.ink, fontVariant: ['tabular-nums'] },
  status: { borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 5 }, statusOverdue: { backgroundColor: colors.dangerSoft }, statusRepaid: { backgroundColor: colors.successSoft }, statusActive: { backgroundColor: colors.primarySoft }, statusText: { ...type.caption }, textOverdue: { color: colors.danger }, textRepaid: { color: colors.success }, textActive: { color: colors.primaryDark },
  details: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }, row: { minHeight: 64, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, gap: spacing.sm }, rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' }, rowLabel: { ...type.body, color: colors.muted, flex: 1 }, rowValue: { ...type.bodyStrong, color: colors.ink },
  settled: { backgroundColor: colors.successSoft, borderRadius: radii.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, settledBody: { flex: 1 }, settledTitle: { ...type.bodyStrong, color: colors.success }, settledCopy: { ...type.caption, color: colors.success },
});

