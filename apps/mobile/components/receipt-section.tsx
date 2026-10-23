import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Loan, ReceiptMeta } from '@miniledger/shared';
import { colors, controls, radii, spacing, type } from '@/constants/theme';
import { api, ApiError, type ReceiptAsset } from '@/lib/api';
import { useInteraction } from '@/providers/interaction-provider';
import { Button } from './button';
import { ReceiptImage } from './receipt-image';
import { ReceiptPicker } from './receipt-picker';

function sizeLabel(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReceiptSection({ loanId, receipt }: { loanId: string; receipt: ReceiptMeta | null }) {
  const queryClient = useQueryClient();
  const { confirm, notify } = useInteraction();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [draft, setDraft] = useState<ReceiptAsset | null>(null);
  const [version, setVersion] = useState(0);
  const uploadInFlight = useRef(false);
  const removalInFlight = useRef(false);

  // Receipt changes never touch financial totals, so the summary is not refetched.
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['loan', loanId] }),
    queryClient.invalidateQueries({ queryKey: ['loans'] }),
  ]);

  const upload = useMutation({
    mutationFn: (asset: ReceiptAsset) => api.uploadReceipt(loanId, asset),
    onSuccess: async ({ loan }) => {
      const wasReplacement = Boolean(receipt);
      // Render the real server response immediately, then refresh in the
      // background so the detail view never falls back to the empty picker
      // between a successful upload and the parent query refetch.
      queryClient.setQueryData<{ loan: Loan }>(['loan', loanId], { loan });
      setDraft(null);
      setReplacing(false);
      setVersion((v) => v + 1);
      await refresh();
      notify({ tone: 'success', title: wasReplacement ? 'Receipt replaced' : 'Receipt uploaded', message: 'The receipt is now attached to this loan.' });
    },
    onError: (error) => notify({ tone: 'error', title: 'Upload failed', message: error instanceof ApiError ? error.message : 'The receipt could not be uploaded. Try again.' }),
  });
  const remove = useMutation({
    mutationFn: () => api.deleteReceipt(loanId),
    onSuccess: async () => {
      await refresh();
      notify({ tone: 'success', title: 'Receipt removed', message: 'The loan and financial totals are unchanged.' });
    },
    onError: (error) => notify({ tone: 'error', title: 'Couldn’t remove receipt', message: error instanceof ApiError ? error.message : 'Please try again.' }),
  });

  const uploadDraft = (asset: ReceiptAsset) => {
    if (uploadInFlight.current) return;
    uploadInFlight.current = true;
    upload.mutate(asset, { onSettled: () => { uploadInFlight.current = false; } });
  };
  const onPick = (asset: ReceiptAsset | null) => {
    setDraft(asset);
    if (!asset) return;
    uploadDraft(asset);
  };
  const confirmRemove = () => confirm(
    { title: 'Remove receipt?', message: 'This deletes the attached image. Your loan and totals are unchanged.', confirmLabel: 'Remove', pendingLabel: 'Removing receipt…', destructive: true },
    async () => {
      if (removalInFlight.current) return;
      removalInFlight.current = true;
      await remove.mutateAsync(undefined, { onSettled: () => { removalInFlight.current = false; } });
    },
  );

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Receipt</Text>

      {receipt && !replacing ? (
        <View style={styles.card}>
          <View style={styles.attachedHeader}>
            <View style={styles.attachedIcon}><Ionicons name="checkmark" size={20} color={colors.success} /></View>
            <View style={styles.attachedCopy}>
              <Text style={styles.attachedTitle}>Receipt attached</Text>
              <Text style={styles.attachedSub}>Stored privately with this loan</Text>
            </View>
            <View style={styles.privateBadge}><Ionicons name="lock-closed" size={12} color={colors.success} /><Text style={styles.privateText}>PRIVATE</Text></View>
          </View>
          <Pressable accessibilityRole="imagebutton" accessibilityLabel="View full receipt" accessibilityHint="Opens the receipt in a full-screen viewer" onPress={() => setViewerOpen(true)} style={({ pressed }) => [styles.previewPress, pressed && styles.previewPressed]}>
            <ReceiptImage loanId={loanId} token={version} resizeMode="contain" style={styles.preview} />
            <View style={styles.previewCta}><Ionicons name="expand-outline" size={16} color={colors.white} /><Text style={styles.previewCtaText}>Open full receipt</Text></View>
          </Pressable>
          <View style={styles.metadata}>
            <View style={styles.metaItem}><Ionicons name="image-outline" size={15} color={colors.inkSoft} /><Text style={styles.metaText}>{receipt.mimeType.replace('image/', '').toUpperCase()}</Text></View>
            <View style={styles.metaItem}><Ionicons name="cloud-done-outline" size={15} color={colors.inkSoft} /><Text style={styles.metaText}>{sizeLabel(receipt.byteSize)}</Text></View>
            <View style={styles.metaItem}><Ionicons name="calendar-outline" size={15} color={colors.inkSoft} /><Text style={styles.metaText}>{new Date(receipt.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text></View>
          </View>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel="View receipt" onPress={() => setViewerOpen(true)} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}><Ionicons name="eye-outline" size={17} color={colors.primaryDark} /><Text style={styles.actionText}>View</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Replace receipt" onPress={() => { setDraft(null); setReplacing(true); }} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}><Ionicons name="swap-horizontal-outline" size={17} color={colors.primaryDark} /><Text style={styles.actionText}>Replace</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Remove receipt" accessibilityState={{ disabled: remove.isPending, busy: remove.isPending }} disabled={remove.isPending} onPress={confirmRemove} style={({ pressed }) => [styles.action, styles.removeAction, pressed && styles.actionPressed, remove.isPending && styles.actionDisabled]}><Ionicons name="trash-outline" size={17} color={colors.danger} /><Text style={[styles.actionText, styles.removeText]}>{remove.isPending ? 'Removing…' : 'Remove'}</Text></Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.pickerWrap}>
          <ReceiptPicker value={draft} onChange={onPick} disabled={upload.isPending} />
          {upload.isPending && <View style={styles.uploading} accessibilityLiveRegion="polite"><ActivityIndicator color={colors.primary} /><Text style={styles.uploadingText}>Uploading receipt…</Text></View>}
          {upload.isError && draft && <Button label="Retry upload" variant="secondary" onPress={() => uploadDraft(draft)} />}
          {replacing && !upload.isPending && (
            <Pressable accessibilityRole="button" onPress={() => { setReplacing(false); setDraft(null); }} style={({ pressed }) => [styles.cancel, pressed && styles.actionPressed]}><Text style={styles.cancelText}>Keep current receipt</Text></Pressable>
          )}
        </View>
      )}

      <Modal visible={viewerOpen} transparent animationType="fade" onRequestClose={() => setViewerOpen(false)}>
        <SafeAreaView style={styles.viewer} edges={['top', 'bottom']}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close receipt" onPress={() => setViewerOpen(false)} style={styles.viewerClose}>
            <Ionicons name="close" size={24} color={colors.white} />
          </Pressable>
          <ReceiptImage loanId={loanId} token={version} resizeMode="contain" style={styles.viewerImage} />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  heading: { ...type.h3, color: colors.ink },
  card: { gap: spacing.md, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.successLine, padding: spacing.md },
  attachedHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  attachedIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.successSoft, borderWidth: 1, borderColor: colors.successLine, alignItems: 'center', justifyContent: 'center' },
  attachedCopy: { flex: 1, minWidth: 0 },
  attachedTitle: { ...type.bodyStrong, color: colors.ink },
  attachedSub: { ...type.caption, color: colors.inkSoft },
  privateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radii.pill, backgroundColor: colors.successSoft, paddingHorizontal: spacing.xs, paddingVertical: 6 },
  privateText: { ...type.micro, color: colors.success },
  previewPress: { position: 'relative', height: 220, borderRadius: radii.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas },
  previewPressed: { opacity: 0.86 },
  preview: { width: '100%', height: '100%' },
  previewCta: { position: 'absolute', right: spacing.sm, bottom: spacing.sm, minHeight: 36, borderRadius: radii.pill, backgroundColor: 'rgba(11,14,21,0.82)', paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewCtaText: { ...type.caption, color: colors.white },
  metadata: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  metaItem: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radii.pill, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.lineSoft, paddingHorizontal: spacing.sm },
  metaText: { ...type.caption, color: colors.inkSoft },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  action: { flex: 1, minWidth: 92, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: controls.touch, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas },
  removeAction: { borderColor: colors.dangerLine, backgroundColor: colors.dangerSoft },
  actionPressed: { opacity: 0.72 },
  actionDisabled: { opacity: 0.5 },
  actionText: { ...type.caption, color: colors.primaryDark },
  removeText: { color: colors.danger },
  pickerWrap: { gap: spacing.sm },
  uploading: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  uploadingText: { ...type.caption, color: colors.muted },
  cancel: { alignSelf: 'flex-start', minHeight: controls.touch, justifyContent: 'center' },
  cancelText: { ...type.caption, color: colors.primaryDark },
  viewer: { flex: 1, backgroundColor: 'rgba(11,20,40,0.94)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  viewerClose: { position: 'absolute', top: spacing.xl, right: spacing.lg, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  viewerImage: { width: '100%', height: '82%', backgroundColor: 'transparent' },
});
