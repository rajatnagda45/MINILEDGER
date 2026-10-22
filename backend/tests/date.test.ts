import { describe, expect, it } from 'vitest';
import { isOverdue, isValidIsoDate, todayInTimeZone } from '../src/utils/date.js';

describe('calendar date rules', () => {
  it('rejects impossible ISO dates', () => {
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2026-02-28')).toBe(true);
  });

  it('uses the configured local calendar day', () => {
    const instant = new Date('2026-10-21T20:00:00.000Z');
    expect(todayInTimeZone('Asia/Kolkata', instant)).toBe('2026-10-22');
  });

  it('only treats outstanding dates before today as overdue', () => {
    expect(isOverdue('2026-10-21', 'OUTSTANDING', '2026-10-22')).toBe(true);
    expect(isOverdue('2026-10-22', 'OUTSTANDING', '2026-10-22')).toBe(false);
    expect(isOverdue('2026-10-21', 'REPAID', '2026-10-22')).toBe(false);
  });
});

