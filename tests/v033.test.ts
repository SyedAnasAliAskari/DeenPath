import { describe, it, expect } from 'vitest';
import { defaults, prayers, prayerState, type RecordData } from '../src/domain';
import { prayerMutation, remainingSeconds } from '../src/prayer-actions';
import { prayerReport, prayerSlots, qiblaBearing, formatHijriDay } from '../src/deen';
import { signedAngle, smoothHeading } from '../src/compass';

describe('explicit prayer actions', () => {
  for (const w of prayers('2026-10-30', defaults)) {
    it(w.name + ' becomes due and expires without a saved completion', () => {
      expect(prayerState(w, undefined, w.start)).toBe('pending');
      expect(prayerState(w, undefined, w.end)).toBe('unknown');
      expect(remainingSeconds(w.end, w.end)).toBe(0);
      expect(remainingSeconds(w.end, new Date(w.end.getTime() + 1000))).toBe(0);
      for (const action of ['snooze', 'close'] as const)
        expect(prayerMutation(action, w, undefined, w.start)).toBeNull();
    });
  }
  it('rejects early completion and early Qaza, and refuses duplicate completion', () => {
    const w = prayers('2026-10-30', defaults)[0];
    expect(() => prayerMutation('prayed', w, undefined, new Date(w.start.getTime() - 1))).toThrow();
    expect(() => prayerMutation('qaza', w, undefined, w.start)).toThrow();
    expect(() => prayerMutation('prayed', w, undefined, w.end)).toThrow();
    const data = prayerMutation('prayed', w, undefined, w.start)!;
    const old: RecordData = { id: w.key, entity: 'prayer_records', data, version: 0 };
    expect(prayerMutation('prayed', w, old, w.start)).toBeNull();
    expect(prayerMutation('qaza', w, old, w.end)).toBeNull();
  });
  it('specific Qaza preserves other obligations and cannot restore an on-time streak', () => {
    const w = prayers('2026-10-30', defaults)[1];
    const data = prayerMutation('qaza', w, undefined, w.end)!;
    const old: RecordData = { id: w.key, entity: 'prayer_records', data, version: 0 };
    expect(prayerMutation('qaza', w, old, w.end)).toBeNull();
    const slots = prayerSlots([old], defaults, '2026-10-30', '2026-10-30', w.end);
    expect(slots).toHaveLength(5);
    expect(slots.filter((x) => x.status === 'qaza')).toHaveLength(1);
    expect(slots.filter((x) => x.displayPrayer === 'Jummah')).toHaveLength(1);
    expect(prayerReport(slots).find((x) => x.name === 'Jummah')).toMatchObject({
      qaza: 1,
      current: 0,
      ontime: 0,
    });
  });
  it('snooze leaves existing records, reports and streaks byte-identical', () => {
    const w = prayers('2026-10-30', defaults)[0];
    const old: RecordData = {
      id: w.key,
      entity: 'prayer_records',
      version: 0,
      data: { status: 'missed' },
    };
    const before = JSON.stringify(old);
    expect(prayerMutation('snooze', w, old, w.end)).toBeNull();
    expect(JSON.stringify(old)).toBe(before);
  });
});
it('handles Isha across midnight, timezones, methods and DST with no completion', () => {
  for (const settings of [
    defaults,
    { ...defaults, ishaEnd: 'fajr' as const },
    {
      ...defaults,
      timezone: 'Europe/London',
      lat: 51.5074,
      lng: -0.1278,
      method: 'MuslimWorldLeague',
    },
  ]) {
    for (const day of ['2026-03-29', '2026-10-25', '2026-10-30']) {
      for (const w of prayers(day, settings)) {
        expect(w.end.getTime()).toBeGreaterThan(w.start.getTime());
        expect(prayerState(w, undefined, w.end)).toBe('unknown');
      }
    }
  }
});
it('matches geographic Qibla bearings and continuous sensor rotation', () => {
  for (const [lat, lng, expected] of [
    [24.8607, 67.0011, 267.7],
    [51.5074, -0.1278, 119.0],
    [40.7128, -74.006, 58.5],
    [-33.8688, 151.2093, 277.5],
  ])
    expect(qiblaBearing(lat, lng)).toBeCloseTo(expected, 0);
  expect(smoothHeading(359, 1)).toBeGreaterThan(359);
  expect(smoothHeading(1, 359)).toBeLessThan(1);
  expect(signedAngle(721)).toBe(1);
});

it('ignores deleted missed/not-applicable statuses and preserves explicit not-applicable records', () => {
  const w = prayers('2026-10-30', defaults)[0];
  for (const status of ['missed', 'na']) {
    const old: RecordData = {
      id: w.key,
      entity: 'prayer_records',
      version: 0,
      deleted: true,
      data: { status },
    };
    expect(prayerState(w, old, w.start)).toBe('pending');
    expect(prayerState(w, old, w.end)).toBe('unknown');
  }
  const na: RecordData = {
    id: w.key,
    entity: 'prayer_records',
    version: 0,
    data: { status: 'na', completedAt: w.start.toISOString() },
  };
  expect(prayerState(w, na, w.start)).toBe('na');
  expect(prayerMutation('prayed', w, na, w.start)).toBeNull();
});
it('completes against the saved obligation window after calculation settings change', () => {
  const w = prayers('2026-10-30', defaults)[0];
  const end = new Date(w.end.getTime() + 3600000);
  const old: RecordData = {
    id: w.key,
    entity: 'prayer_records',
    version: 0,
    data: { windowStart: w.start.toISOString(), windowEnd: end.toISOString() },
  };
  const at = new Date(w.end.getTime() + 60000);
  expect(prayerState(w, old, at)).toBe('pending');
  expect(() => prayerMutation('qaza', w, old, at)).toThrow();
  expect(prayerMutation('prayed', w, old, at)).toMatchObject({
    windowEnd: end.toISOString(),
    completedAt: at.toISOString(),
  });
});

it('formats calculated Hijri dates with Islamic month names and AH in every UI locale', () => {
  expect(formatHijriDay('2026-10-29', 'en')).toBe('17 Jumada al-Awwal 1448 AH');
  expect(formatHijriDay('2026-10-29', 'en', 1)).toBe('18 Jumada al-Awwal 1448 AH');
  expect(formatHijriDay('2026-10-29', 'ur')).toContain('جمادی الاول');
  expect(formatHijriDay('2026-10-29', 'ar')).toContain('جمادى الأولى');
  expect(formatHijriDay('2026-10-29', 'en', 0, false)).not.toContain('1448');
});

it('matches the supplied local Hijri date with the local adjustment', () => {
  expect(formatHijriDay('2026-10-31', 'en', 1)).toBe('20 Jumada al-Awwal 1448 AH');
});
