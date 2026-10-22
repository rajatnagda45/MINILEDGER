import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, type } from '@/constants/theme';
import type { ReceiptAsset } from '@/lib/api';

function toAsset(result: ImagePicker.ImagePickerResult): ReceiptAsset | null {
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0]!;
  const mimeType = asset.mimeType ?? (asset.uri.endsWith('.png') ? 'image/png' : 'image/jpeg');
  const name = asset.fileName ?? `receipt.${mimeType === 'image/png' ? 'png' : 'jpg'}`;
  return { uri: asset.uri, name, mimeType };
}

function sizeLabel(bytes?: number): string | null {
  if (!bytes) return null;
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReceiptPicker({ value, onChange, disabled }: { value: ReceiptAsset | null; onChange: (asset: ReceiptAsset | null) => void; disabled?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [byteSize, setByteSize] = useState<number | undefined>();

  const pickFromLibrary = async () => {
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setError('Allow photo access to attach a receipt.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      const asset = toAsset(result);
      if (asset) { setByteSize(result.assets?.[0]?.fileSize); onChange(asset); }
    } catch { setError('Could not open your photos. Please try again.'); }
  };

  const takePhoto = async () => {
    setError(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) { setError('Allow camera access to photograph a receipt.'); return; }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      const asset = toAsset(result);
      if (asset) { setByteSize(result.assets?.[0]?.fileSize); onChange(asset); }
    } catch { setError('Could not open the camera. Please try again.'); }
  };

  const remove = () => { setByteSize(undefined); setError(null); onChange(null); };

  return (
    <View style={styles.group}>
      <Text style={styles.label}>RECEIPT (OPTIONAL)</Text>
      {value ? (
        <View style={styles.preview}>
          <Image source={{ uri: value.uri }} style={styles.thumb} accessibilityLabel="Selected receipt preview" />
          <View style={styles.previewBody}>
            <Text style={styles.filename} numberOfLines={1}>{value.name}</Text>
            <Text style={styles.meta}>{[value.mimeType.replace('image/', '').toUpperCase(), sizeLabel(byteSize)].filter(Boolean).join(' · ')}</Text>
            <View style={styles.previewActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Replace receipt" disabled={disabled} onPress={pickFromLibrary} style={styles.textAction}><Text style={styles.textActionLabel}>Replace</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Remove receipt" disabled={disabled} onPress={remove} style={styles.textAction}><Text style={[styles.textActionLabel, styles.removeLabel]}>Remove</Text></Pressable>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.dropzone}>
          <View style={styles.dropIcon}><Ionicons name="receipt-outline" size={22} color={colors.primary} /></View>
          <Text style={styles.dropCopy}>Attach a photo of the receipt so you have a record of this loan.</Text>
          <View style={styles.dropActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Choose a photo" disabled={disabled} onPress={pickFromLibrary} style={styles.chip}>
              <Ionicons name="image-outline" size={17} color={colors.primary} /><Text style={styles.chipLabel}>Choose photo</Text>
            </Pressable>
            {Platform.OS !== 'web' && (
              <Pressable accessibilityRole="button" accessibilityLabel="Take a photo" disabled={disabled} onPress={takePhoto} style={styles.chip}>
                <Ionicons name="camera-outline" size={17} color={colors.primary} /><Text style={styles.chipLabel}>Take photo</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : <Text style={styles.hint}>JPEG or PNG · up to 5 MB</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  label: { ...type.caption, color: colors.ink, textTransform: 'uppercase' },
  dropzone: { borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed', borderRadius: radii.md, backgroundColor: colors.canvas, padding: spacing.md, gap: spacing.sm, alignItems: 'flex-start' },
  dropIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  dropCopy: { ...type.caption, color: colors.muted },
  dropActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minHeight: 40, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm },
  chipLabel: { ...type.caption, color: colors.primaryDark },
  preview: { flexDirection: 'row', gap: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surface, padding: spacing.sm },
  thumb: { width: 60, height: 60, borderRadius: radii.sm, backgroundColor: colors.canvas },
  previewBody: { flex: 1, gap: 3, justifyContent: 'center' },
  filename: { ...type.bodyStrong, color: colors.ink },
  meta: { ...type.caption, color: colors.muted },
  previewActions: { flexDirection: 'row', gap: spacing.md, marginTop: 2 },
  textAction: { minHeight: 36, justifyContent: 'center' },
  textActionLabel: { ...type.caption, color: colors.primaryDark },
  removeLabel: { color: colors.danger },
  error: { ...type.caption, color: colors.danger },
  hint: { ...type.caption, color: colors.muted },
});
