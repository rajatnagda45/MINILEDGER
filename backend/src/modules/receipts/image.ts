/**
 * Receipts are untrusted uploads. We never trust the declared MIME type or the
 * original filename — we sniff the actual bytes and only accept formats whose
 * magic number we recognise. This blocks disguised files (e.g. an HTML or SVG
 * payload renamed to .jpg) from being stored and later served.
 */
export type ReceiptMimeType = 'image/jpeg' | 'image/png';

export const ALLOWED_RECEIPT_TYPES: readonly ReceiptMimeType[] = ['image/jpeg', 'image/png'];

const SIGNATURES: Record<ReceiptMimeType, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

function startsWith(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, index) => buffer[index] === byte);
}

/** Returns the detected image type from the file's magic number, or null. */
export function detectImageType(buffer: Buffer): ReceiptMimeType | null {
  for (const type of ALLOWED_RECEIPT_TYPES) {
    if (startsWith(buffer, SIGNATURES[type])) return type;
  }
  return null;
}
