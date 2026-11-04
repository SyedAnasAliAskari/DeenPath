import { describe, it, expect } from 'vitest';
import { reconcileEconomy, rewardSources } from '../src/economy';
const now = new Date('2026-11-03T12:00:00Z');
const prayer: any = {
  id: '2026-11-03:Fajr',
  entity: 'prayer_records',
  data: {
    day: '2026-11-03',
    prayer: 'Fajr',
    windowStart: '2026-11-03T00:00:00Z',
    windowEnd: '2026-11-03T01:00:00Z',
    completedAt: '2026-11-03T00:15:00Z',
  },
};
describe('Gems completion ledger', () => {
  it('earns once and survives serialization or retry', () => {
    const a = reconcileEconomy([prayer], undefined, now);
    expect(a.balance).toBe(10);
    expect(reconcileEconomy([prayer], JSON.parse(JSON.stringify(a)), now)).toEqual(a);
  });
  it('undo and re-completion cannot farm points or changed rates', () => {
    const a = reconcileEconomy([prayer], undefined, now),
      b = reconcileEconomy([{ ...prayer, deleted: true }], a, now);
    expect(b.balance).toBe(0);
    const c = reconcileEconomy([prayer], b, now, {
      prayer: 100,
      qaza: 8,
      tasbih: 5,
      dua: 5,
      custom: 5,
    });
    expect(c.balance).toBe(10);
    expect(Object.values(c.transactions).map((x) => x.delta)).toEqual([10, -10, 10]);
  });
  it('reclassifying on-time as Qaza adjusts the same prayer, without double rewards', () => {
    const a = reconcileEconomy([prayer], undefined, now);
    const q = {
      ...prayer,
      data: { ...prayer.data, completedAt: undefined, qazaAt: '2026-11-03T11:00:00Z' },
    };
    expect(reconcileEconomy([q], a, now).balance).toBe(8);
  });
  it('misses and exempt or future completions earn zero', () => {
    for (const data of [
      { ...prayer.data, completedAt: undefined },
      { ...prayer.data, status: 'na' },
      { ...prayer.data, completedAt: '2027-01-01T00:00:00Z' },
    ])
      expect(reconcileEconomy([{ ...prayer, data }], undefined, now).balance).toBe(0);
  });
  it('counts supported routines once and keeps completed worship when a definition is deleted', () => {
    const r: any = { id: 'r', entity: 'routines', deleted: true, data: { kind: 'dua' } };
    const c: any = {
      id: 'r:2026-11-03',
      entity: 'routine_completions',
      data: { routineId: 'r', period: '2026-11-03', completedAt: now.toISOString() },
    };
    expect(reconcileEconomy([r, c], undefined, now).balance).toBe(5);
    expect(rewardSources([r, { ...c, id: 'fake' }], now.getTime()).size).toBe(0);
  });
  it('deduplicates historical Qaza completion identities and caps the original debt', () => {
    const r: any = {
      id: 'q',
      entity: 'qaza_history',
      data: {
        quantity: 2,
        completed: [
          { id: 'a', at: now.toISOString() },
          { id: 'a', at: now.toISOString() },
          { id: 'b', at: now.toISOString() },
        ],
      },
    };
    expect(reconcileEconomy([r], undefined, now).balance).toBe(16);
  });
});
