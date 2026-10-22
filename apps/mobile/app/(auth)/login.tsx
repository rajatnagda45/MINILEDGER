import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/button';
import { FormField } from '@/components/form-field';
import { colors, radii, shadow, spacing, type } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';
import { formatPhoneInput } from '@/lib/format';

const schema = z.object({ phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number.') });
type Values = z.infer<typeof schema>;

export default function LoginScreen() {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { phone: '' } });
  const sendOtp = useMutation({
    mutationFn: (phone: string) => api.sendOtp(`+91${phone}`),
    onSuccess: (data) => router.push({ pathname: '/(auth)/verify', params: { phone: data.phoneNumber, resend: String(data.resendInSeconds) } }),
  });
  const serverError = sendOtp.error instanceof ApiError ? sendOtp.error.message : null;
  const submit = form.handleSubmit((values) => sendOtp.mutate(values.phone));

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

        <View style={styles.card}>
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
            <Text style={styles.lock}>●</Text>
            <Text style={styles.securityText}>No password needed · your data stays private</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: spacing.xl, paddingTop: 72, paddingBottom: spacing.xxl, gap: spacing.xxl, overflow: 'hidden' },
  glow: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: '#E5ECFF', top: -130, right: -120 },
  hero: { gap: spacing.md },
  eyebrow: { alignSelf: 'flex-start', backgroundColor: colors.primarySoft, borderRadius: radii.pill, paddingHorizontal: 11, paddingVertical: 6 },
  eyebrowText: { ...type.micro, color: colors.primaryDark },
  title: { ...type.display, color: colors.ink },
  subtitle: { ...type.body, fontSize: 16, lineHeight: 24, color: colors.inkSoft, maxWidth: 355 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.lg, ...shadow },
  cardHeader: { gap: 6 },
  cardTitle: { ...type.h2, color: colors.ink },
  cardCopy: { ...type.body, color: colors.muted },
  serverError: { ...type.caption, color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: radii.sm, padding: spacing.sm },
  securityRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  lock: { fontSize: 7, color: colors.success },
  securityText: { ...type.caption, color: colors.muted },
});

