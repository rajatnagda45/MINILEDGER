import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { z } from 'zod';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/button';
import { FadeInView } from '@/components/fade-in-view';
import { FormField } from '@/components/form-field';
import { colors, radii, shadow, spacing, type } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { api, ApiError } from '@/lib/api';
import { formatPhoneInput } from '@/lib/format';

const schema = z.object({ phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number.') });
type Values = z.infer<typeof schema>;

export default function LoginScreen() {
  const { isWide } = useResponsive();
  const submissionInFlight = useRef(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { phone: '' } });
  const sendOtp = useMutation({
    mutationFn: (phone: string) => api.sendOtp(`+91${phone}`),
    onSuccess: (data) => router.push({ pathname: '/(auth)/verify', params: { phone: data.phoneNumber, resend: String(data.resendInSeconds) } }),
  });
  const serverError = sendOtp.error instanceof ApiError
    ? sendOtp.error.message
    : sendOtp.error
      ? 'We couldn’t send a code. Check your connection and try again.'
      : null;
  const submit = form.handleSubmit((values) => {
    if (submissionInFlight.current) return;
    submissionInFlight.current = true;
    sendOtp.mutate(values.phone, { onSettled: () => { submissionInFlight.current = false; } });
  });

  const panel = (
    <FadeInView delay={80} style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Welcome back</Text>
        <Text style={styles.cardCopy}>Enter your mobile number to receive a mock verification code.</Text>
      </View>
      <Controller
        control={form.control}
        name="phone"
        render={({ field: { onChange, onBlur, value }, fieldState }) => (
          <FormField
            label="Mobile number"
            prefix="+91"
            placeholder="98765 43210"
            numeric
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            maxLength={11}
            returnKeyType="go"
            value={formatPhoneInput(value)}
            onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 10))}
            onBlur={onBlur}
            onSubmitEditing={submit}
            error={fieldState.error?.message}
          />
        )}
      />
      {!!serverError && <Text style={styles.serverError} accessibilityLiveRegion="polite">{serverError}</Text>}
      <Button label="Continue securely" loadingLabel="Sending code…" loading={sendOtp.isPending} onPress={submit} />
      <View style={styles.securityRow}>
        <Ionicons name="lock-closed" size={13} color={colors.success} />
        <Text style={styles.securityText}>No password needed · your data stays private</Text>
      </View>
    </FadeInView>
  );

  if (isWide) {
    return (
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.split}>
          <ProductPanel />
          <View style={styles.authColumn}>
            <View style={styles.authInner}>{panel}</View>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.glow} />
        <BrandMark />
        <View style={styles.hero}>
          <View style={styles.eyebrow}><Text style={styles.eyebrowText}>YOUR PERSONAL LENDING BOOK</Text></View>
          <Text style={styles.title}>Know exactly what{`\n`}you’re owed.</Text>
          <Text style={styles.subtitle}>Keep every friendly loan organised, due dates visible, and repayments stress-free.</Text>
        </View>
        {panel}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Desktop-only product context using real app capabilities, never fake data. */
function ProductPanel() {
  return (
    <View style={styles.product}>
      <View style={styles.productGlow} />
      <BrandMark tone="light" />
      <View style={styles.productHero}>
        <View style={styles.productEyebrow}><Text style={styles.productEyebrowText}>YOUR PERSONAL LENDING BOOK</Text></View>
        <Text style={styles.productTitle}>Know exactly what you’re owed.</Text>
        <Text style={styles.productSubtitle}>Keep every friendly loan organised, due dates visible, and repayments stress-free.</Text>
      </View>

      <View style={styles.principles}>
        <Text style={styles.principlesLabel}>BUILT FOR CLEAR RECORDS</Text>
        {[
          { icon: 'calculator-outline' as const, title: 'Precise amounts', copy: 'Values are stored to the paise and formatted in Indian currency.' },
          { icon: 'calendar-outline' as const, title: 'Visible due dates', copy: 'Active and overdue records stay easy to distinguish.' },
          { icon: 'receipt-outline' as const, title: 'Receipts with context', copy: 'Keep an optional image attached to the right loan.' },
        ].map((item) => (
          <View key={item.title} style={styles.principleRow}>
            <View style={styles.principleIcon}><Ionicons name={item.icon} size={20} color={colors.primaryDark} /></View>
            <View style={styles.principleCopy}>
              <Text style={styles.principleTitle}>{item.title}</Text>
              <Text style={styles.principleBody}>{item.copy}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  // Mobile single column
  content: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: spacing.xl, paddingTop: 72, paddingBottom: spacing.xxl, gap: spacing.xxl, overflow: 'hidden' },
  glow: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(82,119,255,0.12)', top: -130, right: -120 },
  hero: { gap: spacing.md },
  eyebrow: { alignSelf: 'flex-start', backgroundColor: colors.primarySoft, borderRadius: radii.pill, paddingHorizontal: 11, paddingVertical: 6 },
  eyebrowText: { ...type.micro, color: colors.primaryDark },
  title: { ...type.display, color: colors.ink },
  subtitle: { ...type.body, fontSize: 16, lineHeight: 24, color: colors.inkSoft, maxWidth: 355 },
  // Desktop split
  split: { flex: 1, flexDirection: 'row', width: '100%', maxWidth: 1240, alignSelf: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xl, gap: spacing.xl },
  authColumn: { flex: 1, minWidth: 420, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl, paddingVertical: spacing.xxl },
  authInner: { width: '100%', maxWidth: 420 },
  product: { flex: 1.05, backgroundColor: colors.navy, borderWidth: 1, borderColor: colors.line, borderRadius: radii.xl, padding: 56, justifyContent: 'center', gap: 40, overflow: 'hidden' },
  productGlow: { position: 'absolute', width: 420, height: 420, borderRadius: 210, backgroundColor: 'rgba(72,116,255,0.16)', top: -140, right: -120 },
  productHero: { gap: spacing.md, maxWidth: 440 },
  productEyebrow: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 7 },
  productEyebrowText: { ...type.micro, color: '#AFC3FF' },
  productTitle: { fontSize: 40, lineHeight: 46, fontWeight: '800', letterSpacing: -1.2, color: colors.white },
  productSubtitle: { ...type.body, fontSize: 17, lineHeight: 26, color: '#AEBBD4' },
  principles: { backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: radii.lg, padding: spacing.lg, gap: spacing.lg, maxWidth: 440 },
  principlesLabel: { ...type.micro, color: '#8F9DBC' },
  principleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  principleIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(72,116,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  principleCopy: { flex: 1, gap: 2 }, principleTitle: { ...type.bodyStrong, color: colors.white }, principleBody: { ...type.caption, color: '#AEBBD4' },
  // Shared auth panel
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.lg, ...shadow },
  cardHeader: { gap: 6 },
  cardTitle: { ...type.h2, color: colors.ink },
  cardCopy: { ...type.body, color: colors.muted },
  serverError: { ...type.caption, color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: radii.sm, padding: spacing.sm },
  securityRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  securityText: { ...type.caption, color: colors.muted },
});
