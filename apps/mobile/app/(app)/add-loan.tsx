import DateTimePicker from '@react-native-community/datetimepicker';
import { zodResolver } from '@hookform/resolvers/zod';
import { usePreventRemove } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useNavigation } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { z } from 'zod';
import { Button } from '@/components/button';
import { FadeInView } from '@/components/fade-in-view';
import { FormField } from '@/components/form-field';
import { ReceiptPicker } from '@/components/receipt-picker';
import { colors, layout, radii, shadow, spacing, type } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { api, ApiError, type ReceiptAsset } from '@/lib/api';
import { formatDate, isValidIsoDate, toIsoDate } from '@/lib/format';
import { useInteraction } from '@/providers/interaction-provider';

const schema = z.object({
  friendName: z.string().trim().min(2, 'Enter your friend’s name.').max(80, 'Keep the name under 80 characters.'),
  amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount with up to two decimals.').refine((value) => Number(value) > 0, 'Amount must be greater than zero.').refine((value) => Number(value) <= 10_000_000, 'Amount is above the ₹1 crore limit.'),
  dueDate: z.string().refine(isValidIsoDate, 'Choose a valid due date.'),
});
type Values = z.infer<typeof schema>;

function initialDueDate() { const date = new Date(); date.setDate(date.getDate() + 7); return date; }

export default function AddLoanScreen() {
  const { isDesktop } = useResponsive();
  const queryClient = useQueryClient();
  const { confirm, notify } = useInteraction();
  const navigation = useNavigation();
  const amountRef = useRef<TextInput>(null);
  const submissionInFlight = useRef(false);
  const [receipt, setReceipt] = useState<ReceiptAsset | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { friendName: '', amount: '', dueDate: toIsoDate(initialDueDate()) } });
  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      // Create the loan first, then attach the optional receipt to it. A failed
      // receipt upload does not undo the created loan — it can be added later.
      const { loan } = await api.createLoan({ friendName: values.friendName.trim(), amount: Number(values.amount), dueDate: values.dueDate });
      if (!receipt) return { loan, receiptError: null as string | null };
      try {
        await api.uploadReceipt(loan.id, receipt);
        return { loan, receiptError: null as string | null };
      } catch (uploadError) {
        return { loan, receiptError: uploadError instanceof ApiError ? uploadError.message : 'The receipt could not be uploaded.' };
      }
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['loans'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
        queryClient.invalidateQueries({ queryKey: ['loan', result.loan.id] }),
      ]);
      notify({
        tone: 'success',
        title: 'Loan added',
        message: `${result.loan.friendName} now appears in your ledger.`,
      });
    },
  });
  const dueDate = form.watch('dueDate');
  const selectedDate = new Date(`${dueDate}T12:00:00`);
  const error = mutation.error instanceof ApiError
    ? mutation.error.message
    : mutation.error
      ? 'We couldn’t save this loan. Please try again.'
      : null;
  const submit = form.handleSubmit((values) => {
    if (submissionInFlight.current) return;
    submissionInFlight.current = true;
    mutation.mutate(values, { onSettled: () => { submissionInFlight.current = false; } });
  });
  usePreventRemove((form.formState.isDirty || receipt !== null) && !mutation.isSuccess, ({ data }) => {
    confirm(
      { title: 'Discard this loan?', message: 'Your entered details have not been saved.', confirmLabel: 'Discard', pendingLabel: 'Discarding…', cancelLabel: 'Keep editing', destructive: true },
      () => navigation.dispatch(data.action),
    );
  });
  const saved = mutation.data;
  const viewSavedLoan = () => saved && router.replace({ pathname: '/(app)/loan/[id]', params: { id: saved.loan.id } });
  const returnToDashboard = () => router.replace('/(app)');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]} keyboardShouldPersistTaps="handled">
          <View style={styles.nav}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)')} style={styles.iconButton}><Ionicons name="close" size={23} color={colors.ink} /></Pressable>
            <View style={styles.navTitle}><Text style={styles.navEyebrow}>NEW ENTRY</Text><Text style={styles.navHeading}>Add a loan</Text></View>
            <View style={styles.navSpacer} />
          </View>

          <View style={styles.intro}>
            <Text style={styles.introTitle}>{saved ? 'Loan saved' : 'Who did you lend to?'}</Text>
            <Text style={styles.introCopy}>{saved ? 'Your ledger and dashboard totals are up to date.' : 'Add the essentials now. You can follow the repayment from your dashboard.'}</Text>
          </View>

          {saved ? (
            <FadeInView delay={40} style={StyleSheet.flatten([styles.successCard, isDesktop && styles.successCardDesktop])}>
              <View
                accessible
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                accessibilityLabel={`Loan added. ${saved.loan.friendName} now appears in your ledger.${saved.receiptError ? ` The receipt didn’t upload: ${saved.receiptError}` : ''}`}
              >
                <View style={styles.successHeading}>
                  <View style={styles.successIcon}><Ionicons name="checkmark" size={24} color={colors.success} /></View>
                  <View style={styles.successCopy}>
                    <Text style={styles.successTitle}>Loan added</Text>
                    <Text style={styles.successMessage}>{saved.loan.friendName} now appears in your ledger.</Text>
                  </View>
                </View>
                {!!saved.receiptError && (
                  <View style={styles.receiptWarning}>
                    <Ionicons name="alert-circle-outline" size={19} color={colors.warning} />
                    <Text style={styles.receiptWarningText}>The loan was saved, but the receipt didn’t upload: {saved.receiptError} You can attach it from the loan details.</Text>
                  </View>
                )}
              </View>
              <View style={styles.successActions}>
                <Button label="View loan" onPress={viewSavedLoan} />
                <Button label="Back to dashboard" variant="secondary" onPress={returnToDashboard} />
              </View>
            </FadeInView>
          ) : (
            <View style={[styles.workspace, isDesktop && styles.workspaceDesktop]}>
              <View style={styles.mainColumn}>
                <FadeInView delay={60} style={styles.formCard}>
                <Controller control={form.control} name="friendName" render={({ field: { onChange, onBlur, value }, fieldState }) => (
                  <FormField label="Friend’s name" placeholder="e.g. Aarav Sharma" autoCapitalize="words" autoCorrect={false} returnKeyType="next" blurOnSubmit={false} value={value} onChangeText={onChange} onBlur={onBlur} onSubmitEditing={() => amountRef.current?.focus()} error={fieldState.error?.message} />
                )} />
                <Controller control={form.control} name="amount" render={({ field: { onChange, onBlur, value }, fieldState }) => (
                  <FormField ref={amountRef} label="Amount lent" prefix="₹" placeholder="2,500" numeric keyboardType="decimal-pad" returnKeyType="done" value={value} onChangeText={(text) => onChange(text.replace(/,/g, '').replace(/[^\d.]/g, ''))} onBlur={onBlur} onSubmitEditing={submit} error={fieldState.error?.message} hint="Amounts are stored exactly to the paise." />
                )} />

                {Platform.OS === 'web' ? (
                  <Controller control={form.control} name="dueDate" render={({ field: { onChange, value }, fieldState }) => <FormField label="Due date" placeholder="YYYY-MM-DD" value={value} onChangeText={onChange} returnKeyType="done" onSubmitEditing={submit} error={fieldState.error?.message} hint="Use YYYY-MM-DD, for example 2026-10-29." />} />
                ) : (
                  <View style={styles.dateGroup}>
                    <Text style={styles.fieldLabel}>DUE DATE</Text>
                    <View style={styles.dateCard}>
                      <View style={styles.dateIcon}><Ionicons name="calendar-outline" size={21} color={colors.primary} /></View>
                      <View style={styles.dateCopy}><Text style={styles.dateValue}>{formatDate(dueDate)}</Text><Text style={styles.dateHint}>Due today is not considered overdue</Text></View>
                      <DateTimePicker value={selectedDate} mode="date" onChange={(_, date) => date && form.setValue('dueDate', toIsoDate(date), { shouldValidate: true })} accentColor={colors.primary} />
                    </View>
                  </View>
                )}

                <View style={styles.divider} />
                <ReceiptPicker value={receipt} onChange={setReceipt} disabled={mutation.isPending} />
                </FadeInView>
                {!!error && <View style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite"><Ionicons name="alert-circle-outline" size={19} color={colors.danger} /><Text style={styles.errorText}>{error}</Text></View>}
                <Button label="Add loan" loadingLabel="Saving loan…" loading={mutation.isPending} onPress={submit} />
              </View>
              <GuidancePanel wide={isDesktop} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function GuidancePanel({ wide }: { wide: boolean }) {
  return (
    <View style={[styles.guidance, wide && styles.guidanceDesktop]}>
      <View style={styles.guidanceHeading}>
        <View style={styles.guidanceIcon}><Ionicons name="shield-checkmark-outline" size={21} color={colors.primaryDark} /></View>
        <View style={styles.guidanceHeadingCopy}><Text style={styles.guidanceTitle}>A clean ledger entry</Text><Text style={styles.guidanceIntro}>Only the details needed to follow this loan.</Text></View>
      </View>
      <View style={styles.guidanceList}>
        <GuidanceRow icon="calendar-outline" title="Due dates stay visible" copy="Past dates are allowed and will be marked overdue immediately." />
        <GuidanceRow
          icon="receipt-outline"
          title="Receipts are optional"
          copy={Platform.OS === 'web' ? 'Attach an image up to 5 MB. Browser formats are converted to JPEG when needed.' : 'Attach a JPEG or PNG up to 5 MB now, or add one later.'}
        />
        <GuidanceRow icon="sync-outline" title="Totals update after save" copy="Your dashboard values come from the server, not this form." />
      </View>
    </View>
  );
}

function GuidanceRow({ icon, title, copy }: { icon: keyof typeof Ionicons.glyphMap; title: string; copy: string }) {
  return <View style={styles.guidanceRow}><View style={styles.guidanceRowIcon}><Ionicons name={icon} size={18} color={colors.inkSoft} /></View><View style={styles.guidanceRowCopy}><Text style={styles.guidanceRowTitle}>{title}</Text><Text style={styles.guidanceRowBody}>{copy}</Text></View></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas }, flex: { flex: 1 },
  content: { width: '100%', maxWidth: layout.readingMax, alignSelf: 'center', padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  contentDesktop: { maxWidth: layout.pageMax, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, gap: spacing.xl },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  navTitle: { alignItems: 'center' }, navEyebrow: { ...type.micro, color: colors.primaryDark }, navHeading: { ...type.h3, color: colors.ink }, navSpacer: { width: 44 },
  intro: { gap: spacing.xs, paddingTop: spacing.xs }, introTitle: { ...type.h1, color: colors.ink }, introCopy: { ...type.body, color: colors.inkSoft },
  workspace: { gap: spacing.lg },
  workspaceDesktop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl },
  mainColumn: { flex: 1, gap: spacing.lg },
  formCard: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, gap: spacing.lg, ...shadow },
  divider: { height: 1, backgroundColor: colors.line, marginHorizontal: -spacing.lg },
  dateGroup: { gap: spacing.xs }, fieldLabel: { ...type.caption, color: colors.ink, textTransform: 'uppercase' },
  dateCard: { minHeight: 66, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', padding: spacing.sm, gap: spacing.sm },
  dateIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  dateCopy: { flex: 1 }, dateValue: { ...type.bodyStrong, color: colors.ink }, dateHint: { ...type.caption, color: colors.inkSoft },
  error: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.dangerLine, borderRadius: radii.sm, padding: spacing.sm }, errorText: { ...type.caption, color: colors.danger, flex: 1 },
  guidance: { width: '100%', backgroundColor: colors.canvasLift, borderWidth: 1, borderColor: colors.line, borderRadius: radii.xl, padding: spacing.lg, gap: spacing.lg },
  guidanceDesktop: { maxWidth: layout.rail, flexShrink: 0 },
  guidanceHeading: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  guidanceIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  guidanceHeadingCopy: { flex: 1, gap: 2 }, guidanceTitle: { ...type.h3, color: colors.ink }, guidanceIntro: { ...type.caption, color: colors.inkSoft },
  guidanceList: { gap: spacing.lg },
  guidanceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, guidanceRowIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  guidanceRowCopy: { flex: 1, gap: 3 }, guidanceRowTitle: { ...type.bodyStrong, color: colors.ink }, guidanceRowBody: { ...type.caption, color: colors.inkSoft },
  successCard: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.successLine, padding: spacing.lg, ...shadow },
  successCardDesktop: { width: '100%', maxWidth: layout.readingMax, alignSelf: 'center', padding: spacing.xl },
  successHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  successIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.successSoft, borderWidth: 1, borderColor: colors.successLine, alignItems: 'center', justifyContent: 'center' },
  successCopy: { flex: 1, gap: 3 }, successTitle: { ...type.h2, color: colors.ink }, successMessage: { ...type.body, color: colors.inkSoft },
  receiptWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, marginTop: spacing.md, padding: spacing.sm, backgroundColor: colors.warningSoft, borderRadius: radii.sm },
  receiptWarningText: { ...type.caption, color: colors.warning, flex: 1 },
  successActions: { gap: spacing.sm, marginTop: spacing.lg },
});

