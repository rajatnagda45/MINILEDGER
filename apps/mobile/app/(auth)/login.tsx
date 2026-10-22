import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
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
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { phone: '' } });
  const sendOtp = useMutation({
    mutationFn: (phone: string) => api.sendOtp(`+91${phone}`),
    onSuccess: (data) => router.push({ pathname: '/(auth)/verify', params: { phone: data.phoneNumber, resend: String(data.resendInSeconds) } }),
  });
  const serverError = sendOtp.error instanceof ApiError ? sendOtp.error.message : null;
  const submit = form.handleSubmit((values) => sendOtp.mutate(values.phone));

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
      <Button label="Continue securely" loading={sendOtp.isPending} onPress={submit} />
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

/**
 * Desktop-only brand showcase. Uses an illustrative ledger motif — clearly
 * labelled as a sample — to balance the split layout without inventing any
 * real account figures, testimonials, or user counts.
 */
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

      <View style={styles.sample}>
        <Text style={styles.sampleLabel}>A PREVIEW OF YOUR LEDGER</Text>
        {[
          { name: 'Aarav Sharma', amount: '₹2,500', tone: 'active' as const, meta: 'Due 29 Oct' },
          { name: 'Priya Nair', amount: '₹1,200', tone: 'overdue' as const, meta: 'Overdue' },
          { name: 'Karan Mehta', amount: '₹5,000', tone: 'repaid' as const, meta: 'Repaid' },
        ].map((row) => (
          <View key={row.name} style={styles.sampleRow}>
            <View style={styles.sampleAvatar}><Text style={styles.sampleAvatarText}>{row.name.split(' ').map((p) => p[0]).join('')}</Text></View>
            <View style={styles.sampleInfo}>
              <Text style={styles.sampleName}>{row.name}</Text>
              <Text style={styles.sampleMeta}>{row.meta}</Text>
            </View>
            <Text style={styles.sampleAmount}>{row.amount}</Text>
            <View style={[styles.sampleTag, styles[`tag_${row.tone}`]]} />
          </View>
        ))}
        <Text style={styles.sampleNote}>Illustration only — your real ledger loads after you sign in.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  // Mobile single column
  content: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: spacing.xl, paddingTop: 72, paddingBottom: spacing.xxl, gap: spacing.xxl, overflow: 'hidden' },
  glow: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: '#E5ECFF', top: -130, right: -120 },
  hero: { gap: spacing.md },
  eyebrow: { alignSelf: 'flex-start', backgroundColor: colors.primarySoft, borderRadius: radii.pill, paddingHorizontal: 11, paddingVertical: 6 },
  eyebrowText: { ...type.micro, color: colors.primaryDark },
  title: { ...type.display, color: colors.ink },
  subtitle: { ...type.body, fontSize: 16, lineHeight: 24, color: colors.inkSoft, maxWidth: 355 },
  // Desktop split
  split: { flex: 1, flexDirection: 'row', width: '100%', maxWidth: 1180, alignSelf: 'center' },
  authColumn: { flex: 1, minWidth: 420, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl, paddingVertical: spacing.xxl },
  authInner: { width: '100%', maxWidth: 420 },
  product: { flex: 1.05, backgroundColor: colors.navy, padding: 56, justifyContent: 'center', gap: 40, overflow: 'hidden' },
  productGlow: { position: 'absolute', width: 420, height: 420, borderRadius: 210, backgroundColor: 'rgba(72,116,255,0.16)', top: -140, right: -120 },
  productHero: { gap: spacing.md, maxWidth: 440 },
  productEyebrow: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 7 },
  productEyebrowText: { ...type.micro, color: '#AFC3FF' },
  productTitle: { fontSize: 40, lineHeight: 46, fontWeight: '800', letterSpacing: -1.2, color: colors.white },
  productSubtitle: { ...type.body, fontSize: 17, lineHeight: 26, color: '#AEBBD4' },
  sample: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm, maxWidth: 440 },
  sampleLabel: { ...type.micro, color: '#8595B5', marginBottom: 2 },
  sampleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radii.md, padding: spacing.sm },
  sampleAvatar: { width: 38, height: 38, borderRadius: 13, backgroundColor: 'rgba(72,116,255,0.28)', alignItems: 'center', justifyContent: 'center' },
  sampleAvatarText: { ...type.caption, color: colors.white },
  sampleInfo: { flex: 1 },
  sampleName: { ...type.bodyStrong, color: colors.white },
  sampleMeta: { ...type.caption, color: '#8595B5' },
  sampleAmount: { ...type.bodyStrong, color: colors.white, fontVariant: ['tabular-nums'] },
  sampleTag: { width: 6, height: 28, borderRadius: 3 },
  tag_active: { backgroundColor: '#6B8CFF' },
  tag_overdue: { backgroundColor: '#FF7D89' },
  tag_repaid: { backgroundColor: '#6DE0B3' },
  sampleNote: { ...type.caption, color: '#6E7D9C', marginTop: 2 },
  // Shared auth panel
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.lg, ...shadow },
  cardHeader: { gap: 6 },
  cardTitle: { ...type.h2, color: colors.ink },
  cardCopy: { ...type.body, color: colors.muted },
  serverError: { ...type.caption, color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: radii.sm, padding: spacing.sm },
  securityRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  securityText: { ...type.caption, color: colors.muted },
});
