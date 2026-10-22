import { forwardRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps, type ViewStyle } from 'react-native';
import { colors, radii, type } from '@/constants/theme';

interface ButtonProps extends PressableProps {
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: ViewStyle;
}

export const Button = forwardRef<View, ButtonProps>(function Button({ label, loading = false, loadingLabel, disabled, variant = 'primary', style, accessibilityLabel, ...props }, ref) {
  const isDisabled = disabled || loading;
  const visibleLabel = loading && loadingLabel ? loadingLabel : label;
  const showLabel = !loading || Boolean(loadingLabel);
  return (
    <Pressable
      accessibilityRole="button"
      ref={ref}
      accessibilityLabel={accessibilityLabel ?? visibleLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [styles.base, styles[variant], pressed && styles.pressed, isDisabled && styles.disabled, style]}
      {...props}
    >
      <View style={styles.content}>
        {loading && <ActivityIndicator size="small" color={variant === 'primary' ? colors.white : colors.primary} />}
        {showLabel && <Text style={[styles.label, variant !== 'primary' && styles.altLabel, variant === 'danger' && styles.dangerLabel]}>{visibleLabel}</Text>}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: { height: 54, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderWidth: 1 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderColor: colors.line },
  danger: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  label: { ...type.bodyStrong, color: colors.white },
  altLabel: { color: colors.primary },
  dangerLabel: { color: colors.danger },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.52 },
});

