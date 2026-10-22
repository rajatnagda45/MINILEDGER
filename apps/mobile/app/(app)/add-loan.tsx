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
import { colors, radii, shadow, spacing, type } from '@/constants/theme';
import { api, ApiError, type ReceiptAsset } from '@/lib/api';
import { confirmAction, notify } from '@/lib/confirm';
import { formatDate, isValidIsoDate, toIsoDate } from '@/lib/format';

const schema = z.object({
  friendName: z.string().trim().min(2, 'Enter your friend’s name.').max(80, 'Keep the name under 80 characters.'),
  amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount with up to two decimals.').refine((value) => Number(value) > 0, 'Amount must be greater than zero.').refine((value) => Number(value) <= 10_000_000, 'Amount is above the ₹1 crore limit.'),
  dueDate: z.string().refine(isValidIsoDate, 'Choose a valid due date.'),
});
type Values = z.infer<typeof schema>;

function initialDueDate() { const date = new Date(); date.setDate(date.getDate() + 7); return date; }

export default function AddLoanScreen() {
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const amountRef = useRef<TextInput>(null);
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
      const message = result.receiptError
        ? `${result.loan.friendName} was added, but the receipt didn’t upload: ${result.receiptError} You can attach it from the loan’s details.`
        : `${result.loan.friendName} now appears in your ledger.`;
      notify('Loan added', message, () => router.back());
    },
  });
  const dueDate = form.watch('dueDate');
  const selectedDate = new Date(`${dueDate}T12:00:00`);
  const error = mutation.error instanceof ApiError ? mutation.error.message : null;
  const submit = form.handleSubmit((values) => mutation.mutate(values));
  usePreventRemove((form.formState.isDirty || receipt !== null) && !mutation.isSuccess, ({ data }) => {
    confirmAction(
      { title: 'Discard this loan?', message: 'Your entered details have not been saved.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', destructive: true },
      () => navigation.dispatch(data.action),
    );
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.nav}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.iconButton}><Ionicons name="close" size={23} color={colors.ink} /></Pressable>
            <View style={styles.navTitle}><Text style={styles.navEyebrow}>NEW ENTRY</Text><Text style={styles.navHeading}>Add a loan</Text></View>
            <View style={styles.navSpacer} />
          </View>

          <View style={styles.intro}><Text style={styles.introTitle}>Who did you lend to?</Text><Text style={styles.introCopy}>Add the essentials now. You can follow the repayment from your dashboard.</Text></View>

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

          <View style={styles.note}><Ionicons name="information-circle-outline" size={20} color={colors.primary} /><Text style={styles.noteText}>Past due dates are allowed and will be clearly marked overdue as soon as the loan is added.</Text></View>
          {!!error && <View style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite"><Text style={styles.errorText}>{error}</Text></View>}
          <Button label="Add to my ledger" loading={mutation.isPending} onPress={submit} />
          <Text style={styles.footer}>Your financial totals come from the server and update after this loan is saved.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas }, flex: { flex: 1 },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.xl },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  navTitle: { alignItems: 'center' }, navEyebrow: { ...type.micro, color: colors.primary }, navHeading: { ...type.h3, color: colors.ink }, navSpacer: { width: 44 },
  intro: { gap: spacing.xs, paddingTop: spacing.sm }, introTitle: { ...type.h1, color: colors.ink }, introCopy: { ...type.body, color: colors.muted },
  formCard: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, gap: spacing.xl, ...shadow },
  divider: { height: 1, backgroundColor: colors.line, marginHorizontal: -spacing.lg },
  dateGroup: { gap: spacing.xs }, fieldLabel: { ...type.caption, color: colors.ink, textTransform: 'uppercase' },
  dateCard: { minHeight: 66, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', padding: spacing.sm, gap: spacing.sm },
  dateIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  dateCopy: { flex: 1 }, dateValue: { ...type.bodyStrong, color: colors.ink }, dateHint: { ...type.caption, color: colors.muted },
  note: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.primarySoft, borderRadius: radii.md, padding: spacing.md }, noteText: { ...type.caption, color: colors.primaryDark, flex: 1 },
  error: { backgroundColor: colors.dangerSoft, borderRadius: radii.sm, padding: spacing.sm }, errorText: { ...type.caption, color: colors.danger },
  footer: { ...type.caption, color: colors.muted, textAlign: 'center', paddingHorizontal: spacing.lg },
});

