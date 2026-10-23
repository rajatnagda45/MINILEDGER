import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/button';
import { ReceiptSection } from '@/components/receipt-section';
import { ErrorState, LoadingState } from '@/components/state-view';
import { colors, layout, radii, shadow, spacing, type } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { api, ApiError } from '@/lib/api';
import { formatCurrency, formatDate, initials } from '@/lib/format';
import { useInteraction } from '@/providers/interaction-provider';

export default function LoanDetailScreen() {
  const { isDesktop } = useResponsive();
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
      <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}>
        <View style={styles.nav}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)')} style={styles.back}><Ionicons name="arrow-back" size={22} color={colors.ink} /></Pressable>
          <Text style={styles.navTitle}>Loan details</Text><View style={styles.navSpacer} />
        </View>
        {query.isLoading && <LoadingState label="Opening loan…" />}
        {!!query.error && <ErrorState message={query.error instanceof ApiError ? query.error.message : 'Please check your connection.'} onRetry={() => void query.refetch()} />}
        {loan && (
          <View style={[styles.workspace, isDesktop && styles.workspaceDesktop]}>
            <View style={[styles.recordColumn, isDesktop && styles.recordColumnDesktop]}>
              <View style={[styles.hero, isDesktop && styles.heroDesktop, loan.isOverdue && styles.heroOverdue]}>
                <View style={styles.heroLead}>
                  <View style={[styles.avatar, loan.isOverdue && styles.avatarOverdue, loan.status === 'REPAID' && styles.avatarRepaid]}><Text style={styles.avatarText}>{initials(loan.friendName)}</Text></View>
                  <View style={styles.heroIdentity}><Text style={styles.heroEyebrow}>LOAN RECORD</Text><Text numberOfLines={2} style={styles.name}>{loan.friendName}</Text></View>
                </View>
                <View style={styles.heroFinancial}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={styles.amount}>{formatCurrency(loan.amount)}</Text>
                  <View accessible accessibilityRole="text" accessibilityLabel={loan.isOverdue ? 'Payment overdue' : loan.status === 'REPAID' ? 'Fully repaid' : 'Payment outstanding'} style={[styles.status, loan.isOverdue ? styles.statusOverdue : loan.status === 'REPAID' ? styles.statusRepaid : styles.statusActive]}>
                    <Ionicons name={loan.isOverdue ? 'alert-circle' : loan.status === 'REPAID' ? 'checkmark-circle' : 'time'} size={15} color={loan.isOverdue ? colors.danger : loan.status === 'REPAID' ? colors.success : colors.primaryDark} />
                    <Text style={[styles.statusText, loan.isOverdue ? styles.textOverdue : loan.status === 'REPAID' ? styles.textRepaid : styles.textActive]}>{loan.isOverdue ? 'Payment overdue' : loan.status === 'REPAID' ? 'Fully repaid' : 'Payment outstanding'}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.details}>
                <DetailRow icon="calendar-outline" label="Due date" value={formatDate(loan.dueDate)} warning={loan.isOverdue} />
                <DetailRow icon="add-circle-outline" label="Added on" value={new Date(loan.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
                {loan.repaidAt && <DetailRow icon="checkmark-circle-outline" label="Repaid on" value={new Date(loan.repaidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />}
              </View>
            </View>
            <View style={[styles.actionColumn, isDesktop && styles.actionColumnDesktop]}>
              <View style={styles.receiptPanel}><ReceiptSection loanId={loan.id} receipt={loan.receipt} /></View>
              {loan.status === 'OUTSTANDING' && <View style={styles.repaymentPanel}><View style={styles.repaymentCopy}><Text style={styles.repaymentTitle}>Repayment status</Text><Text style={styles.repaymentBody}>Only mark this loan repaid after the money has been returned.</Text></View><Button label="Mark as repaid" loadingLabel="Marking as repaid…" loading={repay.isPending} onPress={() => confirm({ title: 'Confirm repayment', message: `Did ${loan.friendName} return ${formatCurrency(loan.amount)}?`, confirmLabel: 'Yes, mark repaid', pendingLabel: 'Marking as repaid…' }, async () => {
                if (repaymentInFlight.current) return;
                repaymentInFlight.current = true;
                await repay.mutateAsync();
              })} /></View>}
              {loan.status === 'REPAID' && <View style={styles.settled}><Ionicons name="shield-checkmark-outline" size={22} color={colors.success} /><View style={styles.settledBody}><Text style={styles.settledTitle}>This loan is settled</Text><Text style={styles.settledCopy}>It no longer contributes to outstanding or overdue totals.</Text></View></View>}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value, warning = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; warning?: boolean }) {
  return <View style={styles.row}><View style={styles.rowIcon}><Ionicons name={icon} size={20} color={warning ? colors.danger : colors.inkSoft} /></View><Text style={styles.rowLabel}>{label}</Text><Text style={[styles.rowValue, warning && styles.textOverdue]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas }, content: { width: '100%', maxWidth: layout.readingMax, alignSelf: 'center', padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.xl },
  contentDesktop: { maxWidth: layout.pageMax, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, back: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, navTitle: { ...type.h3, color: colors.ink }, navSpacer: { width: 44 },
  workspace: { gap: spacing.xl }, workspaceDesktop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl }, recordColumn: { gap: spacing.lg }, recordColumnDesktop: { flex: 1.12 }, actionColumn: { gap: spacing.lg }, actionColumnDesktop: { flex: 0.88 },
  hero: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.line, padding: spacing.xl, alignItems: 'flex-start', gap: spacing.xl, ...shadow }, heroDesktop: { minHeight: 232, justifyContent: 'space-between' }, heroOverdue: { borderColor: colors.dangerLine },
  heroLead: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.md }, heroIdentity: { flex: 1, minWidth: 0, gap: 3 }, heroEyebrow: { ...type.micro, color: colors.muted },
  heroFinancial: { gap: spacing.sm, alignItems: 'flex-start', maxWidth: '100%' },
  avatar: { width: 58, height: 58, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, avatarOverdue: { backgroundColor: colors.dangerSoft }, avatarRepaid: { backgroundColor: colors.successSoft }, avatarText: { fontSize: 18, fontWeight: '800', color: colors.ink },
  name: { ...type.h2, color: colors.ink }, amount: { ...type.display, color: colors.ink, fontVariant: ['tabular-nums'], maxWidth: '100%' },
  status: { borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 5 }, statusOverdue: { backgroundColor: colors.dangerSoft }, statusRepaid: { backgroundColor: colors.successSoft }, statusActive: { backgroundColor: colors.primarySoft }, statusText: { ...type.caption }, textOverdue: { color: colors.danger }, textRepaid: { color: colors.success }, textActive: { color: colors.primaryDark },
  details: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }, row: { minHeight: 64, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, gap: spacing.sm }, rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' }, rowLabel: { ...type.body, color: colors.muted, flex: 1 }, rowValue: { ...type.bodyStrong, color: colors.ink },
  receiptPanel: { backgroundColor: colors.canvasLift, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.line, padding: spacing.lg },
  repaymentPanel: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, gap: spacing.md }, repaymentCopy: { gap: 4 }, repaymentTitle: { ...type.h3, color: colors.ink }, repaymentBody: { ...type.caption, color: colors.inkSoft },
  settled: { backgroundColor: colors.successSoft, borderWidth: 1, borderColor: colors.successLine, borderRadius: radii.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, settledBody: { flex: 1 }, settledTitle: { ...type.bodyStrong, color: colors.success }, settledCopy: { ...type.caption, color: colors.inkSoft },
});

