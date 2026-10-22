import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Loan, Summary } from '@miniledger/shared';
import { BrandMark } from '@/components/brand-mark';
import { FadeInView } from '@/components/fade-in-view';
import { ErrorState, LoadingState } from '@/components/state-view';
import { LoanCard } from '@/components/loan-card';
import { colors, layout, radii, shadow, spacing, type } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { api, ApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';
import { useInteraction } from '@/providers/interaction-provider';

type Filter = 'ALL' | 'OUTSTANDING' | 'REPAID';
const FILTERS: Filter[] = ['ALL', 'OUTSTANDING', 'REPAID'];
const filterLabel = (f: Filter) => (f === 'OUTSTANDING' ? 'Active' : f === 'ALL' ? 'All' : 'Repaid');

export default function DashboardScreen() {
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const { confirm, notify } = useInteraction();
  const { width, isDesktop } = useResponsive();
  const [filter, setFilter] = useState<Filter>('ALL');
  const repaymentsInFlight = useRef(new Set<string>());
  const loansQuery = useQuery({ queryKey: ['loans'], queryFn: ({ signal }) => api.loans(signal) });
  const summaryQuery = useQuery({ queryKey: ['summary'], queryFn: ({ signal }) => api.summary(signal) });
  const repay = useMutation({
    mutationFn: api.repayLoan,
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['loans'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
        queryClient.invalidateQueries({ queryKey: ['loan', result.loan.id] }),
      ]);
      notify({ tone: 'success', title: 'Repayment recorded', message: `${result.loan.friendName}’s loan is settled.` });
    },
    onError: (error) => notify({ tone: 'error', title: 'Couldn’t update loan', message: error instanceof ApiError ? error.message : 'Please try again.' }),
    onSettled: (_data, _error, loanId) => { repaymentsInFlight.current.delete(loanId); },
  });

  const filtered = useMemo(() => {
    const loans = loansQuery.data?.loans ?? [];
    return filter === 'ALL' ? loans : loans.filter((loan) => loan.status === filter);
  }, [loansQuery.data, filter]);

  const refresh = async () => Promise.all([loansQuery.refetch(), summaryQuery.refetch()]);
  const confirmRepay = (loan: Loan) => confirm(
    { title: 'Mark as repaid?', message: `Confirm that ${loan.friendName} returned ${formatCurrency(loan.amount)}. This will update your totals immediately.`, confirmLabel: 'Mark repaid', pendingLabel: 'Marking as repaid…' },
    async () => {
      if (repaymentsInFlight.current.has(loan.id)) return;
      repaymentsInFlight.current.add(loan.id);
      await repay.mutateAsync(loan.id);
    },
  );

  const isInitialLoading = loansQuery.isLoading || summaryQuery.isLoading;
  const error = loansQuery.error ?? summaryQuery.error;
  const totalCount = loansQuery.data?.loans.length ?? 0;

  const onAdd = () => router.push('/(app)/add-loan');
  const onSignOut = () => confirm({ title: 'Sign out?', message: 'Your private ledger will be removed from this device.', confirmLabel: 'Sign out', pendingLabel: 'Signing out…', destructive: true }, signOut);

  const overview = (
    <>
      {summaryQuery.data ? <FadeInView delay={60}><SummaryPanel summary={summaryQuery.data} compact={width < 360} /></FadeInView> : summaryQuery.isLoading ? <SummarySkeleton /> : null}
    </>
  );

  const sectionRow = (
    <View style={styles.sectionRow}>
      <View><Text style={styles.sectionTitle}>Loans</Text><Text style={styles.sectionMeta}>{totalCount} total {totalCount === 1 ? 'entry' : 'entries'}</Text></View>
      <View style={styles.filters}>
        {FILTERS.map((value) => (
          <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Show ${filterLabel(value).toLowerCase()} loans`} accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterActive]}>
            <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{filterLabel(value)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: Loan }) => (
    <LoanCard
      loan={item}
      onPress={() => router.push({ pathname: '/(app)/loan/[id]', params: { id: item.id } })}
      onRepay={() => confirmRepay(item)}
      repaying={repay.isPending && repay.variables === item.id}
      wide={isDesktop}
    />
  );
  const listStates = (
    <>
      {isInitialLoading && <LoadingState />}
      {!!error && !isInitialLoading && <ErrorState message={error instanceof ApiError ? error.message : 'Please check your connection.'} onRetry={() => void refresh()} />}
    </>
  );
  const emptyComponent = !isInitialLoading && !error ? <EmptyState filtered={filter !== 'ALL'} filterName={filterLabel(filter)} onAdd={onAdd} onShowAll={() => setFilter('ALL')} /> : null;
  const refreshControl = <RefreshControl refreshing={loansQuery.isRefetching || summaryQuery.isRefetching} onRefresh={() => void refresh()} tintColor={colors.primary} />;

  // ----- Desktop: one cohesive workspace with full-width records -----
  if (isDesktop) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          contentContainerStyle={styles.deskContent}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          ListHeaderComponent={(
            <View style={styles.deskHeader}>
              <TopBar onAdd={onAdd} onSignOut={onSignOut} wide />
              <View style={styles.deskTitleRow}>
                <View style={styles.heading}>
                  <Text style={styles.eyebrow}>YOUR LENDING</Text>
                  <Text style={styles.title}>A clear view of your ledger.</Text>
                  <Text style={styles.subheading}>Track every rupee, due date and repayment from one place.</Text>
                </View>
                <View style={styles.privacyPill}><Ionicons name="shield-checkmark-outline" size={16} color={colors.success} /><Text style={styles.privacyText}>Private to your account</Text></View>
              </View>
              <View style={styles.overviewGrid}>
                <View style={styles.summaryColumn}>{overview}</View>
                {summaryQuery.data && loansQuery.data && <LedgerPulse summary={summaryQuery.data} loans={loansQuery.data.loans} onAdd={onAdd} />}
              </View>
              {sectionRow}
              {listStates}
            </View>
          )}
          ListEmptyComponent={emptyComponent}
          ListFooterComponent={<View style={styles.footerSpace} />}
        />
      </SafeAreaView>
    );
  }

  // ----- Mobile / tablet: natural single column -----
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        ListHeaderComponent={(
          <View style={styles.headerWrap}>
            <TopBar onAdd={onAdd} onSignOut={onSignOut} />
            <View style={styles.heading}>
              <Text style={styles.eyebrow}>GOOD {new Date().getHours() < 12 ? 'MORNING' : new Date().getHours() < 17 ? 'AFTERNOON' : 'EVENING'}</Text>
              <Text style={styles.title}>Your lending</Text>
              <Text style={styles.subheading}>A clear view of every rupee you’re owed.</Text>
            </View>
            {overview}
            {sectionRow}
            {listStates}
          </View>
        )}
        ListEmptyComponent={emptyComponent}
        ListFooterComponent={<View style={styles.footerSpace} />}
      />
    </SafeAreaView>
  );
}

function LedgerPulse({ summary, loans, onAdd }: { summary: Summary; loans: Loan[]; onAdd: () => void }) {
  const outstanding = loans.filter((loan) => loan.status === 'OUTSTANDING');
  const nextDue = [...outstanding].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const overdue = summary.overdueLoanCount > 0;
  const empty = loans.length === 0;
  const title = overdue ? 'Needs attention' : nextDue ? 'Everything is on track' : empty ? 'Ready for your first entry' : 'Everything is settled';
  const copy = overdue
    ? `${summary.overdueLoanCount} ${summary.overdueLoanCount === 1 ? 'loan is' : 'loans are'} past due. Review the highlighted records below.`
    : nextDue
      ? `${nextDue.friendName} is next, due ${formatDate(nextDue.dueDate)}.`
      : empty
        ? 'Add a loan to start tracking due dates and repayments.'
        : 'No money is currently outstanding in your ledger.';
  return (
    <View style={[styles.pulseCard, overdue && styles.pulseCardDanger]}>
      <View style={styles.pulseTop}>
        <View style={[styles.pulseIcon, overdue && styles.pulseIconDanger]}><Ionicons name={overdue ? 'alert-circle-outline' : empty ? 'add-circle-outline' : nextDue ? 'pulse-outline' : 'checkmark-circle-outline'} size={24} color={overdue ? colors.danger : empty || nextDue ? colors.primaryDark : colors.success} /></View>
        <View style={styles.pulseCopy}>
          <Text style={styles.pulseEyebrow}>LEDGER STATUS</Text>
          <Text style={styles.pulseTitle}>{title}</Text>
          <Text style={styles.pulseBody}>{copy}</Text>
        </View>
      </View>
      <View style={styles.pulseStats}>
        <View><Text style={styles.pulseNumber}>{summary.activeLoanCount}</Text><Text style={styles.pulseLabel}>Active</Text></View>
        <View style={styles.pulseDivider} />
        <View><Text style={styles.pulseNumber}>{summary.repaidLoanCount}</Text><Text style={styles.pulseLabel}>Repaid</Text></View>
      </View>
      {empty && <Pressable accessibilityRole="button" onPress={onAdd} style={styles.pulseAction}><Text style={styles.pulseActionText}>Add first loan</Text><Ionicons name="arrow-forward" size={16} color={colors.primaryDark} /></Pressable>}
    </View>
  );
}

function TopBar({ onAdd, onSignOut, wide = false }: { onAdd: () => void; onSignOut: () => void; wide?: boolean }) {
  return (
    <View style={styles.topBar}>
      <BrandMark compact={!wide} />
      <View style={styles.topActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Add loan" onPress={onAdd} style={styles.addTop}>
          <Ionicons name="add" size={20} color={colors.white} /><Text style={styles.addTopText}>Add loan</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={onSignOut} style={styles.iconButton}>
          <Ionicons name="log-out-outline" size={20} color={colors.inkSoft} />
        </Pressable>
      </View>
    </View>
  );
}

function SummaryPanel({ summary, compact = false }: { summary: Summary; compact?: boolean }) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.orbOne} /><View style={styles.orbTwo} />
      <View style={styles.summaryTop}>
        <View style={styles.summaryPrimary}><Text style={styles.summaryLabel}>STILL TO RECEIVE</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68} style={styles.summaryAmount}>{formatCurrency(summary.outstandingAmount)}</Text></View>
        <View style={styles.wallet}><Ionicons name="wallet-outline" size={23} color={colors.white} /></View>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryStats}>
        <SummaryStat label="Total lent" value={formatCurrency(summary.totalLent)} compact={compact} />
        <View style={styles.statDivider} />
        <SummaryStat label="Repaid" value={formatCurrency(summary.totalRepaid)} tone="success" compact={compact} />
        <View style={styles.statDivider} />
        <SummaryStat label="Overdue" value={formatCurrency(summary.overdueAmount)} tone={summary.overdueAmount > 0 ? 'danger' : undefined} compact={compact} />
      </View>
      {summary.overdueLoanCount > 0 && <View style={styles.overdueCallout}><View style={styles.alertDot} /><Text style={styles.overdueCalloutText}>{summary.overdueLoanCount} {summary.overdueLoanCount === 1 ? 'loan needs' : 'loans need'} your attention</Text><Ionicons name="arrow-forward" size={15} color={colors.danger} /></View>}
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

function SummaryStat({ label, value, tone, compact = false }: { label: string; value: string; tone?: 'success' | 'danger' | undefined; compact?: boolean }) {
  return <View style={styles.summaryStat}><Text style={styles.statLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62} style={[styles.statValue, compact && styles.statValueCompact, tone === 'success' && styles.statSuccess, tone === 'danger' && styles.statDanger]}>{value}</Text></View>;
}

function EmptyState({ filtered, filterName, onAdd, onShowAll }: { filtered: boolean; filterName: string; onAdd: () => void; onShowAll: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons name={filtered ? 'funnel-outline' : 'sparkles-outline'} size={22} color={colors.primary} /></View>
      <View style={styles.emptyBody}>
        <Text style={styles.emptyTitle}>{filtered ? `No ${filterName.toLowerCase()} loans` : 'Your ledger is ready'}</Text>
        <Text style={styles.emptyCopy}>{filtered ? 'Nothing matches this filter right now.' : 'Add your first friendly loan — we’ll keep the amount and due date easy to follow.'}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={filtered ? onShowAll : onAdd} style={styles.emptyAction}>
        <Ionicons name={filtered ? 'list-outline' : 'add'} size={18} color={colors.white} />
        <Text style={styles.emptyActionText}>{filtered ? 'Show all loans' : 'Add first loan'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  headerWrap: { gap: spacing.xl, marginBottom: spacing.md },
  // Desktop workspace
  deskContent: { width: '100%', maxWidth: layout.pageMax, alignSelf: 'center', paddingHorizontal: spacing.xxl, paddingTop: spacing.xl },
  deskHeader: { gap: spacing.xl, marginBottom: spacing.lg },
  deskTitleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.xl },
  overviewGrid: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.lg },
  summaryColumn: { flex: 1.55 },
  privacyPill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.successSoft, borderWidth: 1, borderColor: colors.successLine, borderRadius: radii.pill, paddingHorizontal: spacing.sm, minHeight: 36 },
  privacyText: { ...type.caption, color: colors.success },
  pulseCard: { flex: 1, minWidth: 300, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.md },
  pulseCardDanger: { borderColor: colors.dangerLine },
  pulseTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  pulseIcon: { width: 46, height: 46, flexShrink: 0, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  pulseIconDanger: { backgroundColor: colors.dangerSoft },
  pulseCopy: { gap: 5, flex: 1 },
  pulseEyebrow: { ...type.micro, color: colors.muted },
  pulseTitle: { ...type.h2, color: colors.ink },
  pulseBody: { ...type.body, color: colors.inkSoft },
  pulseStats: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.line },
  pulseNumber: { ...type.h2, color: colors.ink, fontVariant: ['tabular-nums'] },
  pulseLabel: { ...type.caption, color: colors.muted },
  pulseDivider: { width: 1, height: 32, backgroundColor: colors.line },
  pulseAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 42, borderRadius: radii.sm, paddingHorizontal: spacing.sm, backgroundColor: colors.primarySoft },
  pulseActionText: { ...type.caption, color: colors.primaryDark },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topActions: { flexDirection: 'row', gap: spacing.xs },
  addTop: { height: 42, borderRadius: 14, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, gap: 4 },
  addTopText: { ...type.caption, color: colors.white },
  iconButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  heading: { gap: 4 },
  eyebrow: { ...type.micro, color: colors.primary, letterSpacing: 1.1 },
  title: { ...type.h1, color: colors.ink },
  subheading: { ...type.body, color: colors.muted },
  summaryCard: { backgroundColor: colors.elevated, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.line, padding: spacing.xl, overflow: 'hidden', ...shadow },
  summarySkeleton: { height: 190, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.sm, overflow: 'hidden' },
  skeletonLabel: { width: 104, height: 10, borderRadius: 5, backgroundColor: colors.line },
  skeletonAmount: { width: '58%', height: 36, borderRadius: 10, backgroundColor: colors.line },
  skeletonDivider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.sm },
  skeletonStats: { flexDirection: 'row', gap: spacing.sm },
  skeletonStat: { flex: 1, height: 42, borderRadius: radii.sm, backgroundColor: colors.line },
  orbOne: { position: 'absolute', width: 170, height: 170, borderRadius: 85, right: -60, top: -85, backgroundColor: 'rgba(72, 116, 255, 0.22)' },
  orbTwo: { position: 'absolute', width: 100, height: 100, borderRadius: 50, left: -45, bottom: -60, backgroundColor: 'rgba(72, 116, 255, 0.12)' },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryPrimary: { flex: 1, paddingRight: spacing.sm },
  summaryLabel: { ...type.micro, color: colors.primaryDark, marginBottom: 8 },
  summaryAmount: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1, color: colors.white, fontVariant: ['tabular-nums'] },
  wallet: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(82,119,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  summaryDivider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.lg },
  summaryStats: { flexDirection: 'row', alignItems: 'stretch' },
  summaryStat: { flex: 1, gap: 5 },
  statDivider: { width: 1, backgroundColor: colors.line, marginHorizontal: spacing.sm },
  statLabel: { ...type.caption, color: colors.muted },
  statValue: { ...type.h3, color: colors.ink, fontVariant: ['tabular-nums'] },
  statValueCompact: { fontSize: 14, lineHeight: 19, letterSpacing: -0.2 },
  statSuccess: { color: colors.success },
  statDanger: { color: colors.danger },
  overdueCallout: { marginTop: spacing.lg, backgroundColor: colors.dangerSoft, borderRadius: radii.sm, paddingHorizontal: spacing.sm, minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7 },
  alertDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger },
  overdueCalloutText: { ...type.caption, color: '#FFB4B4', flex: 1 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.sm },
  sectionTitle: { ...type.h2, color: colors.ink },
  sectionMeta: { ...type.caption, color: colors.muted },
  filters: { flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, padding: 3 },
  filter: { paddingHorizontal: 9, minHeight: 34, justifyContent: 'center', borderRadius: 8 },
  filterActive: { backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.line },
  filterText: { ...type.caption, color: colors.muted },
  filterTextActive: { color: colors.ink },
  footerSpace: { height: 42 },
  empty: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emptyIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  emptyBody: { flex: 1, gap: 2 },
  emptyTitle: { ...type.h3, color: colors.ink },
  emptyCopy: { ...type.caption, color: colors.muted },
  emptyAction: { minHeight: 44, borderRadius: 13, paddingHorizontal: spacing.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', gap: 5 },
  emptyActionText: { ...type.bodyStrong, color: colors.white },
});
