import { forwardRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps, type TextStyle } from 'react-native';
import { colors, radii, spacing, type } from '@/constants/theme';

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string | undefined;
  prefix?: string | undefined;
  hint?: string | undefined;
  /** Use evenly-spaced tabular figures for numeric entry (phone, amount). */
  numeric?: boolean | undefined;
}

// Remove the browser's default focus ring on web; focus is shown by the shell border instead.
export const noWebOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as unknown as TextStyle) : null;

export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField({ label, error, prefix, hint, numeric, style, onFocus, onBlur, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  const handleFocus: NonNullable<TextInputProps['onFocus']> = (e) => { setFocused(true); onFocus?.(e); };
  const handleBlur: NonNullable<TextInputProps['onBlur']> = (e) => { setFocused(false); onBlur?.(e); };
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputShell, focused && styles.inputShellFocused, error && styles.inputError]}>
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          selectionColor={colors.primary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[styles.input, numeric && styles.numericInput, noWebOutline, style]}
          {...props}
        />
      </View>
      {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
      {!error && !!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  label: { ...type.caption, color: colors.ink, textTransform: 'uppercase' },
  inputShell: { minHeight: 56, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  inputShellFocused: { borderColor: colors.primary },
  inputError: { borderColor: colors.danger, backgroundColor: '#FFFBFB' },
  prefix: { fontSize: 16, fontWeight: '600', color: colors.ink, paddingRight: spacing.sm, borderRightWidth: 1, borderRightColor: colors.line, marginRight: spacing.sm },
  // No lineHeight here: on a single-line web <input> a tall line-height pushes
  // the text off-centre and looks jittery while typing. A fixed height keeps it
  // vertically centred and crisp on every platform.
  input: { flex: 1, height: 52, fontSize: 16, fontWeight: '500', color: colors.ink, paddingVertical: 0 },
  numericInput: { fontVariant: ['tabular-nums'], letterSpacing: 0.6 },
  error: { ...type.caption, color: colors.danger },
  hint: { ...type.caption, color: colors.muted },
});

