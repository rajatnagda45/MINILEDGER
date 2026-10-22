import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Loan } from '@miniledger/shared';
import { BrandMark } from '@/components/brand-mark';
import { ErrorState, LoadingState } from '@/components/state-view';
import { LoanCard } from '@/components/loan-card';
import { colors, radii, shadow, spacing, type } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';

type Filter = 'ALL' | 'OUTSTANDING' | 'REPAID';

export default function DashboardScreen() {
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [notice, setNotice] = useState<string | null>(null);
  const loansQuery = useQuery({ queryKey: ['loans'], queryFn: api.loans });
  const summaryQuery = useQuery({ queryKey: ['summary'], queryFn: api.summary });
  const repay = useMutation({
    mutationFn: api.repayLoan,
    onSuccess: async (result) => {
      setNotice(`${result.loan.friendName}’s loan is settled.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['loans'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
        queryClient.invalidateQueries({ queryKey: ['loan', result.loan.id] }),
      ]);
      setTimeout(() => setNotice(null), 3000);
    },
    onError: (error) => Alert.alert('Couldn’t update loan', error instanceof ApiError ? error.message : 'Please try again.'),
  });

  const filtered = useMemo(() => {
    const loans = loansQuery.data?.loans ?? [];
    return filter === 'ALL' ? loans : loans.filter((loan) => loan.status === filter);
  }, [loansQuery.data, filter]);

  const refresh = async () => Promise.all([loansQuery.refetch(), summaryQuery.refetch()]);
  const confirmRepay = (loan: Loan) => Alert.alert(
    'Mark as repaid?',
    `Confirm that ${loan.friendName} returned ${formatCurrency(loan.amount)}. This will update your totals immediately.`,
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Mark repaid', onPress: () => repay.mutate(loan.id) }],
  );

  const isInitialLoading = loansQuery.isLoading || summaryQuery.isLoading;
  const error = loansQuery.error ?? summaryQuery.error;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <LoanCard
            loan={item}
            onPress={() => router.push({ pathname: '/(app)/loan/[id]', params: { id: item.id } })}
            onRepay={() => confirmRepay(item)}
            repaying={repay.isPending && repay.variables === item.id}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loansQuery.isRefetching || summaryQuery.isRefetching} onRefresh={() => void refresh()} tintColor={colors.primary} />}
        ListHeaderComponent={(
          <View style={styles.headerWrap}>
            <View style={styles.topBar}>
              <BrandMark compact />
              <View style={styles.topActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="Add loan" onPress={() => router.push('/(app)/add-loan')} style={styles.addTop}>
                  <Ionicons name="add" size={20} color={colors.white} /><Text style={styles.addTopText}>Add loan</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={() => Alert.alert('Sign out?', 'Your private ledger will be removed from this device.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => void signOut() }])} style={styles.iconButton}>
                  <Ionicons name="log-out-outline" size={20} color={colors.inkSoft} />
                </Pressable>
              </View>
            </View>
            <View style={styles.heading}>
              <Text style={styles.eyebrow}>GOOD {new Date().getHours() < 12 ? 'MORNING' : new Date().getHours() < 17 ? 'AFTERNOON' : 'EVENING'}</Text>
              <Text style={styles.title}>Your lending</Text>
              <Text style={styles.subheading}>A clear view of every rupee you’re owed.</Text>
            </View>

            {summaryQuery.data ? <SummaryPanel summary={summaryQuery.data} /> : summaryQuery.isLoading ? <SummarySkeleton /> : null}
            {!!notice && <View style={styles.notice} accessibilityRole="alert" accessibilityLiveRegion="polite"><Ionicons name="checkmark-circle" size={19} color={colors.success} /><Text style={styles.noticeText}>{notice}</Text></View>}

            <View style={styles.sectionRow}>
              <View><Text style={styles.sectionTitle}>Loans</Text><Text style={styles.sectionMeta}>{loansQuery.data?.loans.length ?? 0} total entries</Text></View>
              <View style={styles.filters}>
                {(['ALL', 'OUTSTANDING', 'REPAID'] as const).map((value) => (
                  <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Show ${value === 'OUTSTANDING' ? 'active' : value.toLowerCase()} loans`} accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterActive]}>
                    <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{value === 'OUTSTANDING' ? 'Active' : value === 'ALL' ? 'All' : 'Repaid'}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {isInitialLoading && <LoadingState />}
            {!!error && !isInitialLoading && <ErrorState message={error instanceof ApiError ? error.message : 'Please check your connection.'} onRetry={() => void refresh()} />}
          </View>
        )}
        ListEmptyComponent={!isInitialLoading && !error ? <EmptyState filtered={filter !== 'ALL'} onAdd={() => router.push('/(app)/add-loan')} /> : null}
        ListFooterComponent={<View style={styles.footerSpace} />}
      />
    </SafeAreaView>
  );
}

function SummaryPanel({ summary }: { summary: import('@miniledger/shared').Summary }) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.orbOne} /><View style={styles.orbTwo} />
      <View style={styles.summaryTop}>
        <View style={styles.summaryPrimary}><Text style={styles.summaryLabel}>STILL TO RECEIVE</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68} style={styles.summaryAmount}>{formatCurrency(summary.outstandingAmount)}</Text></View>
        <View style={styles.wallet}><Ionicons name="wallet-outline" size={23} color={colors.white} /></View>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryStats}>
        <SummaryStat label="Total lent" value={formatCurrency(summary.totalLent)} />
        <View style={styles.statDivider} />
        <SummaryStat label="Repaid" value={formatCurrency(summary.totalRepaid)} tone="success" />
        <View style={styles.statDivider} />
        <SummaryStat label="Overdue" value={formatCurrency(summary.overdueAmount)} tone={summary.overdueAmount > 0 ? 'danger' : undefined} />
      </View>
      {summary.overdueLoanCount > 0 && <View style={styles.overdueCallout}><View style={styles.alertDot} /><Text style={styles.overdueCalloutText}>{summary.overdueLoanCount} {summary.overdueLoanCount === 1 ? 'loan needs' : 'loans need'} your attention</Text><Ionicons name="arrow-forward" size={15} color="#FFB5BD" /></View>}
    </View>
  );
}

function SummarySkeleton() {
  return (
    <View style={styles.summarySkeleton} accessibilityLabel="Loading financial summary">
      <View style={styles.skeletonLabel} />
      <View style={styles.skeletonAmount} />
      <View style={styles.skeletonDivider} />
      <View style={styles.skeletonStats}>
        <View style={styles.skeletonStat} /><View style={styles.skeletonStat} /><View style={styles.skeletonStat} />
      </View>
    </View>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' | undefined }) {
  return <View style={styles.summaryStat}><Text style={styles.statLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62} style={[styles.statValue, tone === 'success' && styles.statSuccess, tone === 'danger' && styles.statDanger]}>{value}</Text></View>;
}

function EmptyState({ filtered, onAdd }: { filtered: boolean; onAdd: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons name={filtered ? 'filter-outline' : 'people-outline'} size={29} color={colors.primary} /></View>
      <Text style={styles.emptyTitle}>{filtered ? 'No loans in this view' : 'Your ledger is ready'}</Text>
      <Text style={styles.emptyCopy}>{filtered ? 'Try another filter to see your entries.' : 'Add your first friendly loan. We’ll keep the amount and due date easy to follow.'}</Text>
      {!filtered && <Pressable onPress={onAdd} style={styles.emptyAction}><Ionicons name="add" size={18} color={colors.white} /><Text style={styles.emptyActionText}>Add first loan</Text></Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  headerWrap: { gap: spacing.xl, marginBottom: spacing.md },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topActions: { flexDirection: 'row', gap: spacing.xs },
  addTop: { height: 42, borderRadius: 14, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, gap: 4 },
  addTopText: { ...type.caption, color: colors.white },
  iconButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  heading: { gap: 4 },
  eyebrow: { ...type.micro, color: colors.primary, letterSpacing: 1.1 },
  title: { ...type.h1, color: colors.ink },
  subheading: { ...type.body, color: colors.muted },
  summaryCard: { backgroundColor: colors.navy, borderRadius: radii.xl, padding: spacing.xl, overflow: 'hidden', ...shadow },
  summarySkeleton: { height: 190, backgroundColor: '#E8ECF3', borderRadius: radii.xl, padding: spacing.xl, gap: spacing.sm, overflow: 'hidden' },
  skeletonLabel: { width: 104, height: 10, borderRadius: 5, backgroundColor: '#D2D8E3' },
  skeletonAmount: { width: '58%', height: 36, borderRadius: 10, backgroundColor: '#D9DEE8' },
  skeletonDivider: { height: 1, backgroundColor: '#D2D8E3', marginVertical: spacing.sm },
  skeletonStats: { flexDirection: 'row', gap: spacing.sm },
  skeletonStat: { flex: 1, height: 42, borderRadius: radii.sm, backgroundColor: '#D9DEE8' },
  orbOne: { position: 'absolute', width: 170, height: 170, borderRadius: 85, right: -60, top: -85, backgroundColor: 'rgba(72, 116, 255, 0.22)' },
  orbTwo: { position: 'absolute', width: 100, height: 100, borderRadius: 50, left: -45, bottom: -60, backgroundColor: 'rgba(72, 116, 255, 0.12)' },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryPrimary: { flex: 1, paddingRight: spacing.sm },
  summaryLabel: { ...type.micro, color: '#AEBBD4', marginBottom: 8 },
  summaryAmount: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1, color: colors.white, fontVariant: ['tabular-nums'] },
  wallet: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  summaryDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: spacing.lg },
  summaryStats: { flexDirection: 'row', alignItems: 'stretch' },
  summaryStat: { flex: 1, gap: 5 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: spacing.sm },
  statLabel: { ...type.caption, color: '#94A3BD' },
  statValue: { ...type.h3, color: colors.white, fontVariant: ['tabular-nums'] },
  statSuccess: { color: '#6DE0B3' },
  statDanger: { color: '#FF9BA5' },
  overdueCallout: { marginTop: spacing.lg, backgroundColor: 'rgba(216,59,75,0.17)', borderRadius: radii.sm, paddingHorizontal: spacing.sm, minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7 },
  alertDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF7D89' },
  overdueCalloutText: { ...type.caption, color: '#FFD4D8', flex: 1 },
  notice: { backgroundColor: colors.successSoft, borderWidth: 1, borderColor: '#C7EDDC', borderRadius: radii.md, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  noticeText: { ...type.caption, color: colors.success },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.sm },
  sectionTitle: { ...type.h2, color: colors.ink },
  sectionMeta: { ...type.caption, color: colors.muted },
  filters: { flexDirection: 'row', backgroundColor: '#E9EDF4', borderRadius: radii.sm, padding: 3 },
  filter: { paddingHorizontal: 9, minHeight: 34, justifyContent: 'center', borderRadius: 8 },
  filterActive: { backgroundColor: colors.surface, ...shadow },
  filterText: { ...type.caption, color: colors.muted },
  filterTextActive: { color: colors.ink },
  footerSpace: { height: 42 },
  empty: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.lg, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  emptyIcon: { width: 60, height: 60, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  emptyTitle: { ...type.h3, color: colors.ink },
  emptyCopy: { ...type.body, color: colors.muted, textAlign: 'center' },
  emptyAction: { marginTop: spacing.sm, minHeight: 46, borderRadius: 14, paddingHorizontal: spacing.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', gap: 5 },
  emptyActionText: { ...type.bodyStrong, color: colors.white },
});

