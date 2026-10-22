import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirmation. React Native's `Alert.alert` is a no-op on
 * React Native Web (the buttons never fire), which silently broke logout,
 * repayment, and the discard prompt in the browser. On web we fall back to the
 * native `window.confirm`; on iOS/Android we use the real Alert dialog.
 */
export function confirmAction(
  opts: { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean },
  onConfirm: () => void,
): void {
  const { title, message = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive = false } = opts;
  if (Platform.OS === 'web') {
    const webConfirm = (globalThis as { confirm?: (m?: string) => boolean }).confirm;
    if (!webConfirm || webConfirm(message ? `${title}\n\n${message}` : title)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

/** Cross-platform notice. Uses `window.alert` on web, `Alert.alert` on native. */
export function notify(title: string, message = '', onDismiss?: () => void): void {
  if (Platform.OS === 'web') {
    const webAlert = (globalThis as { alert?: (m?: string) => void }).alert;
    webAlert?.(message ? `${title}\n\n${message}` : title);
    onDismiss?.();
    return;
  }
  Alert.alert(title, message, onDismiss ? [{ text: 'OK', onPress: onDismiss }] : undefined);
}
