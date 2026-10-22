import zlib from 'node:zlib';

function crc32(buffer: Buffer): number {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (~crc) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crc]);
}

/** Build a genuinely valid RGB PNG of the given dimensions. */
export function makePng(width = 4, height = 4): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  const raw = Buffer.alloc((width * 3 + 1) * height); // per-row filter byte + RGB, all zero
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([signature, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

export const VALID_PNG = makePng(4, 4);

/**
 * A well-formed baseline JPEG stream: SOI, an SOF0 frame header carrying the
 * real dimensions, and EOI. Enough for the bounded structural validator (which
 * reads headers, not scan data) to accept it and read its size.
 */
export function makeJpeg(width = 1, height = 1): Buffer {
  const sof = Buffer.from([
    0xff, 0xc0, 0x00, 0x0b, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x01, 0x01, 0x11, 0x00,
  ]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof, Buffer.from([0xff, 0xd9])]);
}

export const VALID_JPEG = makeJpeg(1, 1);

export const NOT_AN_IMAGE = Buffer.from('<html>definitely not an image</html>');

/** A valid PNG with its trailing IEND chunk removed. */
export const TRUNCATED_PNG = VALID_PNG.subarray(0, VALID_PNG.length - 4);

/** A valid JPEG with its trailing EOI (FFD9) removed. */
export const TRUNCATED_JPEG = VALID_JPEG.subarray(0, VALID_JPEG.length - 2);

/** A structurally valid PNG whose IHDR declares absurd dimensions. */
export function oversizedPng(): Buffer {
  const buffer = Buffer.from(makePng(2, 2));
  buffer.writeUInt32BE(15_000, 16); // width field in IHDR
  buffer.writeUInt32BE(15_000, 20); // height field in IHDR
  return buffer;
}
