import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/button';
import { noWebOutline } from '@/components/form-field';
import { colors, radii, shadow, spacing, type } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';
import { maskPhone } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';

export default function VerifyScreen() {
  const params = useLocalSearchParams<{ phone: string; resend?: string }>();
  const phone = params.phone ?? '';
  const [otp, setOtp] = useState('');
  const [seconds, setSeconds] = useState(Number(params.resend ?? 30));
  const inputRef = useRef<TextInput>(null);
  const verificationInFlight = useRef(false);
  const { signIn } = useAuth();

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [seconds]);

  const verify = useMutation({ mutationFn: () => signIn(phone, otp) });
  const submitOtp = () => {
    if (otp.length !== 6 || verificationInFlight.current) return;
    verificationInFlight.current = true;
    verify.mutate(undefined, { onSettled: () => { verificationInFlight.current = false; } });
  };
  const resend = useMutation({ mutationFn: () => api.sendOtp(phone), onSuccess: (data) => { setSeconds(data.resendInSeconds); setOtp(''); } });
  const error = verify.error instanceof ApiError ? verify.error.message : resend.error instanceof ApiError ? resend.error.message : null;

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={10} style={styles.back}><Ionicons name="arrow-back" size={22} color={colors.ink} /></Pressable>
          <BrandMark compact />
        </View>
        <View style={styles.hero}>
          <View style={styles.codeIcon}><Ionicons name="keypad-outline" size={28} color={colors.primary} /></View>
          <Text style={styles.title}>Enter your code</Text>
          <Text style={styles.subtitle}>Use the six-digit mock OTP shown in the backend terminal for <Text style={styles.phone}>{maskPhone(phone)}</Text>.</Text>
        </View>

        <View style={styles.otpWrap}>
          {Array.from({ length: 6 }).map((_, index) => (
            <View key={index} style={[styles.digit, otp.length === index && styles.activeDigit, index < otp.length && styles.filledDigit]}>
              {otp.length === index ? <View style={styles.caret} /> : <Text style={styles.digitText}>{otp[index] ?? ''}</Text>}
            </View>
          ))}
          <TextInput
            ref={inputRef}
            value={otp}
            onChangeText={(text) => { setOtp(text.replace(/\D/g, '').slice(0, 6)); verify.reset(); }}
            keyboardType="number-pad"
            inputMode="numeric"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            caretHidden
            returnKeyType="done"
            onSubmitEditing={submitOtp}
            accessibilityLabel="Six-digit verification code"
            accessibilityHint="Enter or paste the code shown in the backend terminal"
            style={[styles.otpInput, noWebOutline]}
          />
        </View>

        {!!error && <View style={styles.error}><Ionicons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={styles.errorText}>{error}</Text></View>}
        <Button label="Verify & open ledger" loading={verify.isPending} disabled={otp.length !== 6} onPress={submitOtp} />

        <View style={styles.resendRow}>
          <Text style={styles.resendCopy}>{seconds > 0 ? `You can request another code in 0:${String(seconds).padStart(2, '0')}` : 'Didn’t get the code?'}</Text>
          {seconds === 0 && <Pressable accessibilityRole="button" accessibilityState={{ disabled: resend.isPending, busy: resend.isPending }} disabled={resend.isPending} onPress={() => resend.mutate()}><Text style={styles.resendLink}>{resend.isPending ? 'Sending…' : 'Resend code'}</Text></Pressable>}
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/(auth)/login')} style={styles.edit}><Ionicons name="pencil-outline" size={15} color={colors.primary} /><Text style={styles.editText}>Use a different number</Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  content: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: 62, gap: spacing.xl },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  codeIcon: { width: 60, height: 60, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  title: { ...type.h1, color: colors.ink },
  subtitle: { ...type.body, color: colors.muted, textAlign: 'center', maxWidth: 345 },
  phone: { color: colors.ink, fontWeight: '700' },
  otpWrap: { flexDirection: 'row', gap: 6, justifyContent: 'center', position: 'relative', width: '100%' },
  digit: { flex: 1, maxWidth: 48, minWidth: 0, height: 58, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow },
  activeDigit: { borderColor: colors.primary },
  filledDigit: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  digitText: { fontSize: 23, lineHeight: 28, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  caret: { width: 2, height: 26, borderRadius: 1, backgroundColor: colors.primary },
  // Full-size transparent input over the boxes: reliable focus/typing/paste on
  // web and native, with the native caret hidden (no stray cursor block).
  otpInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', color: 'transparent', textAlign: 'center' },
  error: { backgroundColor: colors.dangerSoft, borderRadius: radii.sm, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  errorText: { ...type.caption, color: colors.danger, flex: 1 },
  resendRow: { alignItems: 'center', gap: 5 },
  resendCopy: { ...type.caption, color: colors.muted },
  resendLink: { ...type.bodyStrong, color: colors.primary, minHeight: 40, textAlignVertical: 'center' },
  edit: { alignSelf: 'center', flexDirection: 'row', gap: 6, alignItems: 'center', minHeight: 44 },
  editText: { ...type.caption, color: colors.primary },
});

