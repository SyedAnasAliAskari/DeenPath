import { describe, it, expect } from 'vitest';
import { planSecretAnswer, secretStats } from '../src/secrets-model';
import type { PrivateItem } from '../src/private-store';
const day = '2026-10-30';
const habit: PrivateItem = {
  id: 'h',
  type: 'habit',
  name: 'Private habit',
  description: 'Private description',
  start: '2026-10-28',
  recovery: { kind: 'tasbih', title: 'Astaghfar', target: 100 },
};
const plan = (
  items: PrivateItem[],
  records: any[] = [],
  state: 'avoided' | 'slipped' = 'slipped',
  date = day,
) => planSecretAnswer(items, records, 'h', date, state, day, 'public-id', 'Asia/Karachi');
describe('Secrets daily answers', () => {
  it('awards one point for each unique avoided day and retains yesterday’s streak', () => {
    const items = [
      habit,
      ...['28', '29'].map((d) => ({
        id: 'h:2026-10-' + d,
        type: 'checkin' as const,
        habitId: 'h',
        day: '2026-10-' + d,
        state: 'avoided',
      })),
    ];
    expect(secretStats(habit as any, items, day)).toMatchObject({ current: 2, points: 2 });
    const p = plan(items, [], 'avoided');
    expect(plan([...items, ...p.privateItems], [], 'avoided').changed).toBe(false);
    expect(secretStats(habit as any, [...items, ...p.privateItems], day)).toMatchObject({
      current: 3,
      points: 3,
    });
  });
  it('creates one anonymous Tasbih counter and retries do not duplicate it', () => {
    const p = plan([habit]);
    expect(p.publicRecords[0].data).toMatchObject({
      kind: 'tasbih',
      target: 100,
      generated: true,
      secretPenalty: true,
    });
    expect(JSON.stringify(p.publicRecords)).not.toContain('Private');
    expect(plan([habit, ...p.privateItems], p.publicRecords).changed).toBe(false);
  });
  it('creates Nafl separately from Fard or Qaza records', () => {
    const p = plan([{ ...habit, recovery: { kind: 'nafl', target: 4 } }]);
    expect(p.publicRecords.map((r) => r.entity)).toEqual(['routines']);
    expect(p.publicRecords[0].data).toMatchObject({ kind: 'nafl', target: 4 });
  });
  it('correction cancels untouched penalties but preserves partial or completed worship', () => {
    const p = plan([habit]);
    const items = [habit, ...p.privateItems];
    expect(plan(items, p.publicRecords, 'avoided').publicRecords[0].deleted).toBe(true);
    for (const r of [
      { entity: 'tasbih_progress', data: { routineId: 'public-id', count: 1 } },
      { entity: 'routine_completions', data: { routineId: 'public-id' } },
    ])
      expect(plan(items, [...p.publicRecords, r], 'avoided').publicRecords).toEqual([]);
  });
  it('projects old pending recovery once using its original penalty snapshot', () => {
    const legacy = {
      id: 'recovery:h:' + day + ':0',
      type: 'recovery' as const,
      kind: 'nafl',
      target: 2,
      title: 'old',
      state: 'pending',
    };
    const p = plan([
      habit,
      { id: 'h:' + day, type: 'checkin', habitId: 'h', day, state: 'slipped' },
      legacy,
    ]);
    expect(p.publicRecords[0].data).toMatchObject({ kind: 'nafl', target: 2 });
    expect(
      plan([
        habit,
        { ...legacy, state: 'done' },
        { id: 'h:' + day, type: 'checkin', habitId: 'h', day, state: 'slipped' },
      ]).changed,
    ).toBe(false);
  });
  it('rejects invalid dates, future days and archived secrets', () => {
    expect(() => plan([habit], [], 'slipped', '2026-02-30')).toThrow();
    expect(() => plan([habit], [], 'slipped', '2026-11-01')).toThrow();
    expect(() => plan([{ ...habit, archived: true }])).toThrow();
  });
});
