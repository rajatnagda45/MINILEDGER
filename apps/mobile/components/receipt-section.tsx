import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ReceiptMeta } from '@miniledger/shared';
import { colors, radii, spacing, type } from '@/constants/theme';
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
    onSuccess: async () => {
      const wasReplacement = Boolean(receipt);
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
          <Pressable accessibilityRole="imagebutton" accessibilityLabel="View receipt" onPress={() => setViewerOpen(true)} style={styles.thumbPress}>
            <ReceiptImage loanId={loanId} token={version} style={styles.thumb} />
          </Pressable>
          <View style={styles.cardBody}>
            <Text style={styles.cardMeta}>{receipt.mimeType.replace('image/', '').toUpperCase()} · {sizeLabel(receipt.byteSize)}</Text>
            <Text style={styles.cardSub}>Added {new Date(receipt.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" onPress={() => setViewerOpen(true)} style={styles.action}><Ionicons name="expand-outline" size={15} color={colors.primaryDark} /><Text style={styles.actionText}>View</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => { setDraft(null); setReplacing(true); }} style={styles.action}><Ionicons name="swap-horizontal-outline" size={15} color={colors.primaryDark} /><Text style={styles.actionText}>Replace</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={remove.isPending} onPress={confirmRemove} style={styles.action}><Ionicons name="trash-outline" size={15} color={colors.danger} /><Text style={[styles.actionText, styles.removeText]}>{remove.isPending ? 'Removing…' : 'Remove'}</Text></Pressable>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.pickerWrap}>
          <ReceiptPicker value={draft} onChange={onPick} disabled={upload.isPending} />
          {upload.isPending && <View style={styles.uploading} accessibilityLiveRegion="polite"><ActivityIndicator color={colors.primary} /><Text style={styles.uploadingText}>Uploading receipt…</Text></View>}
          {upload.isError && draft && <Button label="Retry upload" variant="secondary" onPress={() => uploadDraft(draft)} />}
          {replacing && !upload.isPending && (
            <Pressable accessibilityRole="button" onPress={() => { setReplacing(false); setDraft(null); }} style={styles.cancel}><Text style={styles.cancelText}>Keep current receipt</Text></Pressable>
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
  card: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.sm },
  thumbPress: { borderRadius: radii.md, overflow: 'hidden' },
  thumb: { width: 76, height: 76, borderRadius: radii.md },
  cardBody: { flex: 1, justifyContent: 'center', gap: 3 },
  cardMeta: { ...type.bodyStrong, color: colors.ink },
  cardSub: { ...type.caption, color: colors.muted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36 },
  actionText: { ...type.caption, color: colors.primaryDark },
  removeText: { color: colors.danger },
  pickerWrap: { gap: spacing.sm },
  uploading: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  uploadingText: { ...type.caption, color: colors.muted },
  cancel: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' },
  cancelText: { ...type.caption, color: colors.primaryDark },
  viewer: { flex: 1, backgroundColor: 'rgba(11,20,40,0.94)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  viewerClose: { position: 'absolute', top: spacing.xl, right: spacing.lg, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  viewerImage: { width: '100%', height: '82%', backgroundColor: 'transparent' },
});
