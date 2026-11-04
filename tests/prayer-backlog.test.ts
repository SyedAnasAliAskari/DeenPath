import { it, expect } from 'vitest';
import {
  pendingNaflEntries,
  pendingQazaSlots,
  historicalQazaRemaining,
} from '../src/prayer-backlog';
import { defaults, type RecordData } from '../src/domain';
import { prayerSlots } from '../src/deen';
const now = new Date('2026-10-30T15:00Z');
const routine = (data: any = {}): RecordData => ({
  id: 'n',
  entity: 'routines',
  version: 0,
  data: {
    kind: 'nafl',
    title: 'Daily Nafl',
    frequency: 'daily',
    timezone: 'Asia/Karachi',
    startDate: '2026-10-28',
    time: '08:00',
    target: 2,
    ...data,
  },
});
it('daily Nafl piles up across midnight and completing one preserves the other days', () => {
  const r = routine();
  expect(pendingNaflEntries([r], now).map((e) => e.period)).toEqual([
    '2026-10-28',
    '2026-10-29',
    '2026-10-30',
  ]);
  const done: RecordData = {
    id: 'n:2026-10-28',
    entity: 'routine_completions',
    version: 0,
    data: { routineId: 'n', period: '2026-10-28', completedAt: now.toISOString() },
  };
  expect(pendingNaflEntries([r, done], now).map((e) => e.period)).toEqual([
    '2026-10-29',
    '2026-10-30',
  ]);
  expect(pendingNaflEntries([r, done], new Date('2026-10-31T15:00Z'))).toHaveLength(3);
});
it('one-off Secrets penalties persist once rather than multiplying every day', () => {
  const r = routine({ frequency: 'unscheduled', generated: true, secretPenalty: true });
  expect(pendingNaflEntries([r], now)).toHaveLength(1);
  expect(pendingNaflEntries([r], new Date('2026-11-03T15:00Z'))[0].period).toBe('lifetime');
});
it('Nafl ignores future/deleted routines and only counts actual scheduled periods', () => {
  expect(pendingNaflEntries([routine({ startDate: '2026-11-01' })], now)).toHaveLength(0);
  expect(pendingNaflEntries([{ ...routine(), deleted: true }], now)).toHaveLength(0);
  expect(
    pendingNaflEntries([routine({ frequency: 'weekdays', weekdays: [3] })], now).map((e) => e.day),
  ).toEqual(['2026-10-28']);
});
it('all five yesterday prayers remain reviewable without fabricated missed or completion records', () => {
  const rows = prayerSlots([], defaults, '2026-10-29', '2026-10-29', now),
    pending = pendingQazaSlots(rows, now);
  expect(pending).toHaveLength(5);
  expect(pending.every((s) => s.status === 'unknown')).toBe(true);
  const record: RecordData = {
    id: pending[0].id,
    entity: 'prayer_records',
    version: 0,
    data: { day: pending[0].day, prayer: pending[0].prayer, qazaAt: now.toISOString() },
  };
  expect(
    pendingQazaSlots(prayerSlots([record], defaults, '2026-10-29', '2026-10-29', now), now),
  ).toHaveLength(4);
});
it('earlier Qaza quantities carry over and completed totals cannot make negative cards', () => {
  expect(
    historicalQazaRemaining({
      id: 'q',
      entity: 'qaza_history',
      version: 0,
      data: { quantity: 5, completed: [{ quantity: 2 }] },
    }),
  ).toBe(3);
});
it('after-prayer Nafl accumulates each selected start without needing a prayer completion', () => {
  const r = routine({
    frequency: 'after_prayer',
    resetPrayers: ['Fajr', 'Dhuhr'],
    resetSettings: defaults,
  });
  expect(pendingNaflEntries([r], now)).toHaveLength(6);
});
