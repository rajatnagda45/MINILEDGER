import { forwardRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps, type ViewStyle } from 'react-native';
import { colors, controls, focusRing, radii, type } from '@/constants/theme';

interface ButtonProps extends PressableProps {
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: ViewStyle;
}

export const Button = forwardRef<View, ButtonProps>(function Button({ label, loading = false, loadingLabel, disabled, variant = 'primary', style, accessibilityLabel, onHoverIn, onHoverOut, onFocus, onBlur, ...props }, ref) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
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
      onHoverIn={(event) => { setHovered(true); onHoverIn?.(event); }}
      onHoverOut={(event) => { setHovered(false); onHoverOut?.(event); }}
      onFocus={(event) => { setFocused(true); onFocus?.(event); }}
      onBlur={(event) => { setFocused(false); onBlur?.(event); }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        hovered && !isDisabled && variant === 'primary' && styles.primaryHovered,
        hovered && !isDisabled && variant === 'secondary' && styles.secondaryHovered,
        hovered && !isDisabled && variant === 'danger' && styles.dangerHovered,
        pressed && styles.pressed,
        pressed && variant === 'primary' && styles.primaryPressed,
        focused && styles.focused,
        isDisabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      <View style={styles.content}>
        {loading && <ActivityIndicator size="small" color={variant === 'primary' ? colors.white : colors.primaryDark} />}
        {showLabel && <Text style={[styles.label, variant !== 'primary' && styles.altLabel, variant === 'danger' && styles.dangerLabel]}>{visibleLabel}</Text>}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: { height: controls.default, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderWidth: 1 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderColor: colors.line },
  danger: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  primaryHovered: { backgroundColor: colors.primaryHover, borderColor: colors.primaryHover },
  secondaryHovered: { backgroundColor: colors.surfaceHover, borderColor: colors.primaryDark },
  dangerHovered: { backgroundColor: colors.dangerLine },
  label: { ...type.bodyStrong, color: colors.white },
  altLabel: { color: colors.primaryDark },
  dangerLabel: { color: colors.danger },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  primaryPressed: { backgroundColor: colors.primaryPressed, borderColor: colors.primaryPressed },
  focused: { ...focusRing },
  disabled: { opacity: 0.52 },
});

