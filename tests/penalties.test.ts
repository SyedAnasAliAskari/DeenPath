import { describe, it, expect } from 'vitest';
import {
  moneyMinor,
  penaltyReminderTimes,
  penaltySchedules,
  penaltyPerformed,
} from '../src/penalties';
import { planSecretAnswer } from '../src/secrets-model';
const now = '2026-11-03T10:00:00.000Z',
  day = '2026-11-03';
const h: any = {
  id: 'h',
  type: 'habit',
  name: 'Private',
  start: day,
  recovery: { kind: 'charity', amountMinor: 12550, currency: 'PKR' },
};
const plan = (items: any[], state: 'slipped' | 'avoided' = 'slipped') =>
  planSecretAnswer(items, [], 'h', day, state, day, 'public', 'Asia/Karachi', now);
describe('24 hour penalties', () => {
  it('stores exact cents and rejects fractional, negative, zero or overflow inputs', () => {
    expect(moneyMinor('125.50')).toBe(12550);
    expect(moneyMinor('0.01')).toBe(1);
    for (const value of ['0', '-1', '1.001', '1e3', 'Infinity', '1000000000'])
      expect(() => moneyMinor(value)).toThrow();
  });
  it('keeps charity private and replay-safe with a stable original deadline', () => {
    const p = plan([h]);
    expect(p.publicRecords).toEqual([]);
    const t = p.privateItems[1];
    expect(t.routineId).toBeUndefined();
    expect(t).toMatchObject({
      createdAt: now,
      dueAt: '2026-11-04T10:00:00.000Z',
      amountMinor: 12550,
    });
    expect(plan([h, ...p.privateItems]).changed).toBe(false);
    const corrected = plan([h, ...p.privateItems], 'avoided');
    const merged = [
      h,
      ...p.privateItems.filter((x) => !corrected.privateItems.some((y) => x.id === y.id)),
      ...corrected.privateItems,
    ];
    expect(penaltySchedules(merged, [])).toEqual([]);
    expect(plan(merged).privateItems[1].dueAt).toBe(t.dueAt);
  });
  it('never reopens a charity that was given when an answer is corrected twice', () => {
    const first = plan([h]),
      task = { ...first.privateItems[1], state: 'done', completedAt: now };
    const avoided = plan([h, first.privateItems[0], task], 'avoided');
    const merged = [h, task, ...avoided.privateItems].filter(
      (item, index, array) => array.map((other) => other.id).lastIndexOf(item.id) === index,
    );
    const slipped = plan(merged);
    const final = [...merged, ...slipped.privateItems].filter(
      (item, index, array) => array.map((other) => other.id).lastIndexOf(item.id) === index,
    );
    expect(penaltySchedules(final, [])).toEqual([]);
    expect(final.find((item) => item.type === 'recovery').completedAt).toBe(now);
  });
  it('schedules exactly five alerts strictly before the deadline without money or names', () => {
    const t = plan([h]).privateItems[1],
      schedule = penaltySchedules([t], []);
    expect(Object.keys(schedule[0]).sort()).toEqual(['createdAt', 'dueAt', 'id']);
    expect(
      penaltyReminderTimes(t.createdAt, t.dueAt).map((x) => (x - Date.parse(now)) / 3600000),
    ).toEqual([4, 8, 12, 16, 20]);
    expect(penaltyReminderTimes(now, 'bad')).toEqual([]);
  });
  it('completion and routine deletion suppress alerts; completed worship counts', () => {
    const t = plan([h]).privateItems[1];
    expect(penaltySchedules([{ ...t, state: 'done' }], [])).toEqual([]);
    expect(penaltySchedules([{ ...t, routineId: 'r' }], [])).toEqual([]);
    const records: any[] = [
      { entity: 'routines', id: 'r', data: {} },
      { entity: 'routine_completions', data: { routineId: 'r' } },
    ];
    expect(penaltyPerformed({ ...t, routineId: 'r' }, records)).toBe(true);
    expect(penaltySchedules([{ ...t, routineId: 'r' }], records)).toEqual([]);
  });
  it('rejects invalid charity configurations and gives new worship penalties the same deadline', () => {
    for (const amountMinor of [0, -1, 1.25, NaN])
      expect(() => plan([{ ...h, recovery: { ...h.recovery, amountMinor } }])).toThrow();
    for (const kind of ['tasbih', 'nafl'])
      expect(plan([{ ...h, recovery: { kind, target: 2 } }]).privateItems[1].dueAt).toBe(
        '2026-11-04T10:00:00.000Z',
      );
  });
});
