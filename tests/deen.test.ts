import { describe, it, expect } from 'vitest';
import { defaults, prayers, routineDue, periodKey, type RecordData } from '../src/domain';
import {
  prayerSlots,
  prayerReport,
  completedQaza,
  habitStats,
  recoveryTasks,
  qiblaBearing,
  hijriParts,
  dateRange,
  quietAt,
  type Habit,
  type Checkin,
} from '../src/deen';
import { replayProgress } from '../src/progress';
const s = { ...defaults, timezone: 'Asia/Karachi' },
  now = new Date('2026-10-05T20:00Z');
function record(day: string, name: string, status = 'ontime'): RecordData {
  const w = prayers(day, s).find((w) => w.name === name)!;
  return {
    id: w.key,
    entity: 'prayer_records',
    version: 0,
    data: {
      day,
      prayer: name,
      midday: name === 'Dhuhr' ? 'Dhuhr' : undefined,
      windowStart: w.start.toISOString(),
      windowEnd: w.end.toISOString(),
      ...(status === 'ontime'
        ? { completedAt: new Date(w.start.getTime() + 60000).toISOString() }
        : status === 'qaza'
          ? { qazaAt: now.toISOString() }
          : { status }),
    },
  };
}
describe('obligation integrity', () => {
  it('breaks the overall streak after a known miss without waiting for later prayer windows', () => {
    const data = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map((p) => record('2026-10-01', p));
    data.push(record('2026-10-02', 'Fajr'), record('2026-10-02', 'Dhuhr', 'missed'));
    expect(
      prayerReport(
        prayerSlots(data, s, '2026-10-01', '2026-10-02', new Date('2026-10-02T08:00Z')),
      ).at(-1),
    ).toMatchObject({ current: 0, best: 1 });
  });
  it('keeps a legacy Qaza correction out of on-time streaks even if an old completion field remains', () => {
    const r = record('2026-10-01', 'Fajr');
    r.data.qazaAt = now.toISOString();
    expect(prayerReport(prayerSlots([r], s, '2026-10-01', '2026-10-01', now))[0]).toMatchObject({
      ontime: 0,
      qaza: 1,
      current: 0,
    });
  });
  it('keeps unknown distinct from confirmed missed and excludes historical Qaza', () => {
    const data = [
      record('2026-10-01', 'Fajr'),
      record('2026-10-01', 'Dhuhr', 'missed'),
      { id: 'old', entity: 'qaza_history', version: 0, data: { prayer: 'Fajr', quantity: 500 } },
    ] as RecordData[];
    const rows = prayerReport(prayerSlots(data, s, '2026-10-01', '2026-10-01', now));
    expect(rows.at(-1)).toMatchObject({ total: 5, ontime: 1, missed: 1, unknown: 3 });
    expect(rows[0].total).toBe(1);
  });
  it('preserves best while breaking only the missed prayer streak', () => {
    const data = [
      record('2026-10-01', 'Fajr'),
      record('2026-10-02', 'Fajr'),
      record('2026-10-03', 'Fajr'),
      record('2026-10-04', 'Fajr', 'qaza'),
      record('2026-10-01', 'Dhuhr'),
      record('2026-10-02', 'Dhuhr', 'missed'),
      record('2026-10-03', 'Dhuhr'),
      record('2026-10-04', 'Dhuhr'),
    ];
    const rows = prayerReport(prayerSlots(data, s, '2026-10-01', '2026-10-04', now));
    expect(rows[0]).toMatchObject({ best: 3, current: 0, qaza: 1 });
    expect(rows[1]).toMatchObject({ best: 2, current: 2 });
  });
  it('counts one Friday midday slot with either Jumuah or Dhuhr', () => {
    const r = record('2026-10-02', 'Dhuhr');
    r.data.midday = 'Jumuah';
    const slots = prayerSlots([r], s, '2026-10-02', '2026-10-02', now);
    expect(slots).toHaveLength(5);
    expect(slots.find((x) => x.prayer === 'Dhuhr')).toMatchObject({
      friday: true,
      status: 'ontime',
    });
  });
  it('uses original recorded windows after a travel location change', () => {
    const r = record('2026-10-01', 'Fajr');
    const slots = prayerSlots(
      [r],
      { ...s, lat: 51.5, lng: -0.12, timezone: 'Europe/London' },
      '2026-10-01',
      '2026-10-01',
      now,
    );
    expect(slots[0].status).toBe('ontime');
    expect(slots[0].start).toBe(r.data.windowStart);
  });
  it('recalculates legitimate corrections and requires five on-time slots overall', () => {
    const data = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map((p) => record('2026-10-01', p));
    expect(
      prayerReport(prayerSlots(data, s, '2026-10-01', '2026-10-01', now)).at(-1)?.current,
    ).toBe(1);
    data[0] = record('2026-10-01', 'Fajr', 'qaza');
    expect(
      prayerReport(prayerSlots(data, s, '2026-10-01', '2026-10-01', now)).at(-1)?.current,
    ).toBe(0);
  });
  it('counts grouped and individual historical completions without inflating obligations', () =>
    expect(completedQaza({ completed: [{ quantity: 100 }, { id: 'one' }] })).toBe(101));
});
describe('private habits and voluntary activities', () => {
  const h: Habit = {
    id: 'h',
    name: 'Personal',
    start: '2026-10-01',
    recovery: { kind: 'tasbih', title: 'Chosen activity', target: 20, perOccurrence: false },
  };
  const check: Checkin = {
    id: 'h:2026-10-01',
    habitId: 'h',
    day: '2026-10-01',
    state: 'slipped',
    count: 10,
    note: '',
  };
  it('stores ten occurrences as one unsuccessful day; unanswered days are not successes', () => {
    expect(habitStats(h, [check], h.start, '2026-10-03')).toMatchObject({
      occurrences: 10,
      slipped: 1,
      success: 0,
      unanswered: 2,
      current: 0,
    });
  });
  it('deduplicates daily and per-occurrence recovery without resetting completed activities', () => {
    const tasks = recoveryTasks(h, check, []);
    expect(tasks).toHaveLength(1);
    tasks[0].state = 'done';
    expect(recoveryTasks(h, check, tasks)[0].state).toBe('done');
    expect(
      recoveryTasks({ ...h, recovery: { ...h.recovery!, perOccurrence: true } }, check, []),
    ).toHaveLength(10);
  });
  it('keeps separate habits independent', () => {
    const clean = { ...check, habitId: 'other', state: 'avoided' as const, count: 0 };
    expect(habitStats({ ...h, id: 'other' }, [check, clean], h.start, h.start)).toMatchObject({
      current: 1,
      occurrences: 0,
    });
  });
  it('does not award or spend freezes for Nafl, custom or generated activities', () => {
    for (const data of [
      { kind: 'nafl' },
      { kind: 'custom' },
      { kind: 'tasbih', generated: true },
    ]) {
      const records = [
        {
          id: 'r',
          entity: 'routines',
          version: 0,
          data: { ...data, frequency: 'daily', timezone: 'UTC', startDate: '2026-01-01' },
        },
      ] as RecordData[];
      expect(replayProgress(records, now)).toEqual({ wallet: 0, streaks: [], ledger: [] });
    }
  });
});
describe('shared calendar and geography', () => {
  it('finds Qibla east of north in London and west in Karachi', () => {
    expect(qiblaBearing(51.5, -0.12)).toBeCloseTo(119, 0);
    expect(qiblaBearing(24.8607, 67.0011)).toBeCloseTo(267.9, 0);
  });
  it('matches tabular Hijri with adjustment and chosen occasion scheduling', () => {
    expect(hijriParts('2026-02-19')).toMatchObject({ year: '1447', month: '9', day: '2' });
    const r = {
      startDate: '2026-01-01',
      timezone: 'UTC',
      frequency: 'yearly',
      calendar: 'hijri',
      hijriMonth: 9,
      hijriDay: 2,
    };
    expect(routineDue(r, new Date('2026-02-19T12:00Z'))).toBe(true);
    expect(periodKey(r, new Date('2026-02-19T12:00Z'))).toBe('2026-02-19');
  });
  it('observes weekday/end-date rules and cross-midnight quiet hours', () => {
    const r = {
      startDate: '2026-10-01',
      endDate: '2026-10-10',
      timezone: 'UTC',
      frequency: 'weekdays',
      weekdays: [1],
    };
    expect(routineDue(r, new Date('2026-10-05T12:00Z'))).toBe(true);
    expect(routineDue(r, new Date('2026-10-12T12:00Z'))).toBe(false);
    expect(
      quietAt(new Date('2026-10-01T23:00Z'), { ...s, timezone: 'UTC', quietEnabled: true }),
    ).toBe(true);
  });
  it('clamps shared report ranges to actual tracking and today', () =>
    expect(dateRange('30', '2026-10-27', '2026-10-12')).toEqual({
      from: '2026-10-12',
      to: '2026-10-27',
    }));
});
