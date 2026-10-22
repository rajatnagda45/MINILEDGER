import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radii, spacing, type } from '@/constants/theme';

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string | undefined;
  prefix?: string | undefined;
  hint?: string | undefined;
}

export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField({ label, error, prefix, hint, style, ...props }, ref) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputShell, error && styles.inputError]}>
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          selectionColor={colors.primary}
          style={[styles.input, style]}
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
  inputError: { borderColor: colors.danger, backgroundColor: '#FFFBFB' },
  prefix: { ...type.bodyStrong, color: colors.ink, paddingRight: spacing.sm, borderRightWidth: 1, borderRightColor: colors.line, marginRight: spacing.sm },
  input: { flex: 1, ...type.body, color: colors.ink, paddingVertical: 0 },
  error: { ...type.caption, color: colors.danger },
  hint: { ...type.caption, color: colors.muted },
});

