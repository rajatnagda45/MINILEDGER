import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button } from '@/components/button';
import { colors, radii, shadow, spacing, type } from '@/constants/theme';

export type NoticeTone = 'success' | 'error' | 'warning';

export interface NoticeOptions {
  title: string;
  message?: string;
  tone: NoticeTone;
  duration?: number;
}

export interface ConfirmationOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  pendingLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmationState extends ConfirmationOptions {
  id: number;
  pending: boolean;
  action: () => void | Promise<void>;
}

interface NoticeState extends NoticeOptions {
  id: number;
}

interface InteractionContextValue {
  notify(options: NoticeOptions): void;
  confirm(options: ConfirmationOptions, action: () => void | Promise<void>): void;
}

const InteractionContext = createContext<InteractionContextValue | null>(null);

export function InteractionProvider({ children }: PropsWithChildren) {
  const sequence = useRef(0);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [noticePaused, setNoticePaused] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const confirmationRef = useRef(confirmation);

  useEffect(() => { confirmationRef.current = confirmation; }, [confirmation]);

  const notify = useCallback((options: NoticeOptions) => {
    setNoticePaused(false);
    setNotice({ ...options, id: ++sequence.current });
  }, []);

  const confirm = useCallback((options: ConfirmationOptions, action: () => void | Promise<void>) => {
    setConfirmation({ ...options, action, id: ++sequence.current, pending: false });
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);
  const cancelConfirmation = useCallback(() => {
    if (confirmationRef.current?.pending) return;
    setConfirmation(null);
  }, []);

  const runConfirmation = useCallback(async () => {
    const current = confirmationRef.current;
    if (!current || current.pending) return;
    setConfirmation((value) => value?.id === current.id ? { ...value, pending: true } : value);
    try {
      await current.action();
      setConfirmation((value) => value?.id === current.id ? null : value);
    } catch {
      setConfirmation((value) => value?.id === current.id ? { ...value, pending: false } : value);
    }
  }, []);

  useEffect(() => {
    if (!notice || noticePaused) return;
    const timer = setTimeout(dismissNotice, notice.duration ?? 6000);
    return () => clearTimeout(timer);
  }, [dismissNotice, notice, noticePaused]);

  const value = useMemo(() => ({ notify, confirm }), [confirm, notify]);

  return (
    <InteractionContext.Provider value={value}>
      {children}
      <Notification notice={notice} onDismiss={dismissNotice} onPause={() => setNoticePaused(true)} onResume={() => setNoticePaused(false)} />
      <ConfirmationDialog confirmation={confirmation} onCancel={cancelConfirmation} onConfirm={() => void runConfirmation()} />
    </InteractionContext.Provider>
  );
}

export function useInteraction() {
  const value = useContext(InteractionContext);
  if (!value) throw new Error('useInteraction must be used inside InteractionProvider');
  return value;
}

function Notification({ notice, onDismiss, onPause, onResume }: {
  notice: NoticeState | null;
  onDismiss: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  if (!notice) return null;
  const icon = notice.tone === 'success' ? 'checkmark-circle' : notice.tone === 'warning' ? 'warning' : 'alert-circle';
  const color = notice.tone === 'success' ? colors.success : notice.tone === 'warning' ? colors.warning : colors.danger;
  return (
    <View pointerEvents="box-none" style={styles.notificationLayer}>
      <View
        key={notice.id}
        onPointerEnter={onPause}
        onPointerLeave={onResume}
        style={[styles.notification, styles[`notification_${notice.tone}`]]}
      >
        <View
          accessible
          role={notice.tone === 'error' ? 'alert' : 'status'}
          accessibilityLiveRegion={notice.tone === 'error' ? 'assertive' : 'polite'}
          accessibilityLabel={`${notice.title}${notice.message ? `. ${notice.message}` : ''}`}
          style={styles.notificationStatus}
        >
          <Ionicons name={icon} size={22} color={color} />
          <View style={styles.notificationCopy}>
            <Text style={styles.notificationTitle}>{notice.title}</Text>
            {!!notice.message && <Text style={styles.notificationMessage}>{notice.message}</Text>}
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss notification" hitSlop={8} onFocus={onPause} onBlur={onResume} onPress={onDismiss} style={styles.dismiss}>
          <Ionicons name="close" size={20} color={colors.inkSoft} />
        </Pressable>
      </View>
    </View>
  );
}

function ConfirmationDialog({ confirmation, onCancel, onConfirm }: {
  confirmation: ConfirmationState | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<View>(null);
  const cancelRef = useRef<View>(null);
  const pendingRef = useRef(false);
  const { width } = useWindowDimensions();
  const stackActions = width < 360;

  useEffect(() => { pendingRef.current = confirmation?.pending ?? false; }, [confirmation?.pending]);

  useEffect(() => {
    if (!confirmation || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = setTimeout(() => (cancelRef.current as unknown as HTMLElement | null)?.focus?.(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pendingRef.current) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;
      const node = dialogRef.current as unknown as HTMLElement | null;
      const focusable = node ? Array.from(node.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])')) : [];
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = priorOverflow;
      previousFocus?.focus?.();
    };
  }, [confirmation?.id, onCancel]);

  if (!confirmation) return null;
  const confirmLabel = confirmation.confirmLabel ?? 'Confirm';
  return (
    <Modal testID="confirmation-dialog-modal" visible transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.modalRoot}>
        <Pressable testID="confirmation-backdrop" accessibilityLabel="Close confirmation" disabled={confirmation.pending} onPress={onCancel} style={StyleSheet.absoluteFill} />
        <View
          ref={dialogRef}
          testID="confirmation-dialog-panel"
          role="dialog"
          aria-modal
          aria-labelledby="confirmation-dialog-title"
          aria-describedby="confirmation-dialog-message"
          accessibilityViewIsModal
          accessibilityLabel={`${confirmation.title}. ${confirmation.message}`}
          style={styles.dialog}
        >
          <View style={[styles.dialogIcon, confirmation.destructive && styles.dialogIconDanger]}>
            <Ionicons name={confirmation.destructive ? 'warning-outline' : 'checkmark-circle-outline'} size={24} color={confirmation.destructive ? colors.danger : colors.primaryDark} />
          </View>
          <View style={styles.dialogCopy}>
            <Text nativeID="confirmation-dialog-title" role="heading" aria-level={2} style={styles.dialogTitle}>{confirmation.title}</Text>
            <Text nativeID="confirmation-dialog-message" style={styles.dialogMessage}>{confirmation.message}</Text>
          </View>
          <View style={[styles.dialogActions, stackActions && styles.dialogActionsStacked]}>
            <Button ref={cancelRef} label={confirmation.cancelLabel ?? 'Cancel'} variant="secondary" disabled={confirmation.pending} onPress={onCancel} style={stackActions ? styles.dialogButtonStacked : styles.dialogButton} />
            <Button
              label={confirmLabel}
              loadingLabel={confirmation.pendingLabel ?? `${confirmLabel.replace(/[?.!]$/, '')}…`}
              loading={confirmation.pending}
              variant={confirmation.destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              style={stackActions ? styles.dialogButtonStacked : styles.dialogButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  notificationLayer: { position: 'absolute', zIndex: 1000, top: Platform.OS === 'ios' ? 56 : spacing.lg, left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  notification: { width: '100%', maxWidth: 440, minHeight: 68, borderRadius: radii.md, borderWidth: 1, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, ...shadow },
  notification_success: { backgroundColor: colors.successSoft, borderColor: colors.successLine },
  notification_error: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerLine },
  notification_warning: { backgroundColor: colors.warningSoft, borderColor: colors.warning },
  notificationStatus: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  notificationCopy: { flex: 1, gap: 2 },
  notificationTitle: { ...type.bodyStrong, color: colors.ink },
  notificationMessage: { ...type.caption, color: colors.inkSoft },
  dismiss: { width: 44, height: 44, margin: -spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radii.sm },
  modalRoot: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  dialog: { width: '100%', maxWidth: 440, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.line, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.lg, ...shadow },
  dialogIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  dialogIconDanger: { backgroundColor: colors.dangerSoft },
  dialogCopy: { gap: spacing.xs },
  dialogTitle: { ...type.h2, color: colors.ink },
  dialogMessage: { ...type.body, color: colors.inkSoft },
  dialogActions: { flexDirection: 'row', gap: spacing.sm },
  dialogActionsStacked: { flexDirection: 'column-reverse' },
  dialogButton: { flex: 1, minWidth: 0 },
  dialogButtonStacked: { width: '100%' },
});
