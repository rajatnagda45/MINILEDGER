import { describe, expect, it } from 'vitest';
import { inspectImage } from '../src/modules/receipts/image.js';
import { NOT_AN_IMAGE, TRUNCATED_JPEG, TRUNCATED_PNG, VALID_JPEG, VALID_PNG, makePng, oversizedPng } from './fixtures.js';

describe('inspectImage', () => {
  it('accepts a valid PNG and reports its type and dimensions', () => {
    expect(inspectImage(VALID_PNG)).toEqual({ ok: true, mimeType: 'image/png', width: 4, height: 4 });
  });

  it('accepts a valid JPEG', () => {
    const result = inspectImage(VALID_JPEG);
    expect(result).toMatchObject({ ok: true, mimeType: 'image/jpeg' });
  });

  it('rejects an unsupported format', () => {
    expect(inspectImage(NOT_AN_IMAGE)).toEqual({ ok: false, code: 'UNSUPPORTED' });
    expect(inspectImage(Buffer.from('GIF89a....'))).toEqual({ ok: false, code: 'UNSUPPORTED' });
  });

  it('rejects content that only has a valid signature prefix', () => {
    const fakePng = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 7)]);
    const fakeJpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 7)]);
    expect(inspectImage(fakePng).ok).toBe(false);
    expect(inspectImage(fakeJpeg).ok).toBe(false);
  });

  it('rejects truncated PNG and JPEG payloads', () => {
    expect(inspectImage(TRUNCATED_PNG)).toEqual({ ok: false, code: 'MALFORMED' });
    expect(inspectImage(TRUNCATED_JPEG)).toEqual({ ok: false, code: 'MALFORMED' });
  });

  it('rejects images whose declared dimensions are excessive', () => {
    expect(inspectImage(oversizedPng())).toEqual({ ok: false, code: 'DIMENSIONS' });
  });

  it('accepts a larger valid PNG within bounds', () => {
    expect(inspectImage(makePng(64, 48))).toMatchObject({ ok: true, width: 64, height: 48 });
  });
});
