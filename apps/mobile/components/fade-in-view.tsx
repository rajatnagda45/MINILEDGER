import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, View, type ViewStyle } from 'react-native';
import { motion } from '@/constants/theme';

/**
 * Subtle, purposeful entrance: a short fade with a small upward rise, used on
 * native (iOS/Android) only. Content is laid out immediately and is NEVER left
 * hidden — on web, or when the OS "reduce motion" setting is on, it renders
 * statically at full opacity. This keeps the native-driver animation reliable
 * and avoids any chance of motion concealing content on React Native Web.
 */
export function FadeInView({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: ViewStyle }) {
  const animated = Platform.OS !== 'web';
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduceMotion(value); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; sub.remove(); };
  }, [animated]);

  useEffect(() => {
    if (!animated || reduceMotion) { progress.setValue(1); return; }
    const animation = Animated.timing(progress, { toValue: 1, duration: motion.base, delay, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [animated, reduceMotion, progress, delay]);

  if (!animated || reduceMotion) return <View style={style}>{children}</View>;

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [motion.rise, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
