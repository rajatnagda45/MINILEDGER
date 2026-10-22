/**
 * Receipts are untrusted uploads. We never trust the declared MIME type or the
 * original filename — we parse the actual bytes. This is a *bounded* structural
 * inspection (headers only, no full decode): it verifies the magic number, that
 * the header/trailer are present (rejecting truncated or malformed files), reads
 * the real pixel dimensions, and bounds them to block absurd/decompression-bomb
 * images. It does not re-encode the image.
 */
export type ReceiptMimeType = 'image/jpeg' | 'image/png';

export const ALLOWED_RECEIPT_TYPES: readonly ReceiptMimeType[] = ['image/jpeg', 'image/png'];

// A receipt photo never needs to be enormous; these bound untrusted dimensions.
export const MAX_IMAGE_DIMENSION = 12_000;
export const MAX_IMAGE_PIXELS = 40_000_000; // ~40 megapixels

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_IEND = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]); // "IEND" + CRC

export type ImageInspection =
  | { ok: true; mimeType: ReceiptMimeType; width: number; height: number }
  | { ok: false; code: 'UNSUPPORTED' | 'MALFORMED' | 'DIMENSIONS' };

function startsWith(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, index) => buffer[index] === byte);
}

function boundDimensions(mimeType: ReceiptMimeType, width: number, height: number): ImageInspection {
  if (width <= 0 || height <= 0 || width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION || width * height > MAX_IMAGE_PIXELS) {
    return { ok: false, code: 'DIMENSIONS' };
  }
  return { ok: true, mimeType, width, height };
}

function inspectPng(buffer: Buffer): ImageInspection {
  // Signature (8) + first chunk length (4) + "IHDR" (4) + 13-byte IHDR body.
  if (buffer.length < 8 + 4 + 4 + 13) return { ok: false, code: 'MALFORMED' };
  const firstChunkLength = buffer.readUInt32BE(8);
  if (buffer.toString('ascii', 12, 16) !== 'IHDR' || firstChunkLength !== 13) return { ok: false, code: 'MALFORMED' };
  // Truncation: a complete PNG ends with the IEND chunk.
  if (!buffer.subarray(buffer.length - 8).equals(PNG_IEND)) return { ok: false, code: 'MALFORMED' };
  return boundDimensions('image/png', buffer.readUInt32BE(16), buffer.readUInt32BE(20));
}

function inspectJpeg(buffer: Buffer): ImageInspection {
  // A complete JPEG ends with the EOI marker FFD9.
  if (buffer.length < 4 || buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) {
    return { ok: false, code: 'MALFORMED' };
  }
  let offset = 2; // past SOI (FFD8)
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) return { ok: false, code: 'MALFORMED' };
    let marker = buffer[offset + 1]!;
    // Skip fill bytes (0xFF) between markers.
    while (marker === 0xff && offset + 2 < buffer.length) { offset += 1; marker = buffer[offset + 1]!; }
    offset += 2;
    // Standalone markers without a length payload.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) continue;
    if (offset + 2 > buffer.length) return { ok: false, code: 'MALFORMED' };
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return { ok: false, code: 'MALFORMED' };
    // Start Of Frame markers carry the real dimensions (exclude DHT/JPG/DAC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (offset + 7 > buffer.length) return { ok: false, code: 'MALFORMED' };
      return boundDimensions('image/jpeg', buffer.readUInt16BE(offset + 5), buffer.readUInt16BE(offset + 3));
    }
    if (marker === 0xda) return { ok: false, code: 'MALFORMED' }; // reached scan data without a frame header
    offset += segmentLength;
  }
  return { ok: false, code: 'MALFORMED' };
}

/** Structurally inspect an upload and classify it. */
export function inspectImage(buffer: Buffer): ImageInspection {
  if (startsWith(buffer, PNG_SIGNATURE)) return inspectPng(buffer);
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return inspectJpeg(buffer);
  return { ok: false, code: 'UNSUPPORTED' };
}
