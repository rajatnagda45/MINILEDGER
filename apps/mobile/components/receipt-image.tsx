import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, type } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';

type Status = 'loading' | 'ready' | 'error' | 'missing';

/**
 * Renders a receipt from the authenticated endpoint. The image is private, so
 * we must send the JWT: on native, Image accepts request headers directly; on
 * web it cannot, so we fetch the bytes and render an object URL (revoked on
 * unmount). `token` is included in the key so the image reloads after re-auth.
 */
export function ReceiptImage({ loanId, token, style, resizeMode = 'cover' }: { loanId: string; token: number; style?: StyleProp<ViewStyle>; resizeMode?: 'cover' | 'contain' }) {
  const [uri, setUri] = useState<string | null>(Platform.OS === 'web' ? null : api.receiptEndpoint(loanId));
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    if (Platform.OS !== 'web') { setStatus('loading'); setUri(`${api.receiptEndpoint(loanId)}?v=${token}`); return; }
    let active = true;
    let objectUrl: string | null = null;
    setStatus('loading');
    (async () => {
      try {
        // Goes through the API client: a 401 triggers the app's sign-out flow
        // rather than silently showing a generic error.
        objectUrl = URL.createObjectURL(await api.fetchReceiptBlob(loanId));
        if (active) { setUri(objectUrl); setStatus('ready'); }
      } catch (error) {
        if (!active) return;
        setStatus(error instanceof ApiError && error.code === 'RECEIPT_NOT_FOUND' ? 'missing' : 'error');
      }
    })();
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [loanId, token]);

  if (status === 'error' || status === 'missing') {
    return (
      <View style={[styles.fallback, style]}>
        <Ionicons name={status === 'missing' ? 'image-outline' : 'cloud-offline-outline'} size={22} color={colors.muted} />
        <Text style={styles.fallbackText}>{status === 'missing' ? 'No receipt' : 'Couldn’t load preview'}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      {uri && (
        <Image
          source={Platform.OS === 'web' ? { uri } : { uri, headers: api.authHeaders() }}
          resizeMode={resizeMode}
          onLoad={() => setStatus('ready')}
          onError={() => setStatus('error')}
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Receipt image"
        />
      )}
      {status === 'loading' && <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.canvas, overflow: 'hidden' },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  fallback: { backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', gap: 6 },
  fallbackText: { ...type.caption, color: colors.muted },
});
