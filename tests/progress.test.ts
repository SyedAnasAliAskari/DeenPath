import { it, expect } from 'vitest';
import { replayProgress as replayCurrentProgress } from '../src/progress';
// Retain coverage of archived Freeze Point calculations; the current app uses no freezes.
const replayProgress = (...args: Parameters<typeof replayCurrentProgress>) =>
  replayCurrentProgress(args[0], args[1], true);
import type { RecordData } from '../src/domain';
it('does not finalize a shifted daily deadline before its actual close', () => {
  const records: RecordData[] = [
    {
      id: 'r',
      entity: 'routines',
      version: 0,
      data: {
        kind: 'quran',
        frequency: 'daily',
        startDate: '2026-10-01',
        timezone: 'UTC',
        deadline: '16:00',
      },
    },
  ];
  for (let d = 1; d <= 7; d++)
    records.push({ id: `r:2026-10-0${d}`, entity: 'routine_completions', version: 0, data: {} });
  expect(replayProgress(records, new Date('2026-10-08T12:00Z')).wallet).toBe(0);
  expect(replayProgress(records, new Date('2026-10-08T16:00Z')).wallet).toBe(1);
});
it('replays offline rewards and repairs spending after a late completion', () => {
  const records: RecordData[] = [
    {
      id: 'r',
      entity: 'routines',
      version: 0,
      data: { kind: 'quran', frequency: 'daily', startDate: '2026-10-01', timezone: 'UTC' },
    },
  ];
  for (let day = 1; day <= 7; day++)
    records.push({ id: `r:2026-10-0${day}`, entity: 'routine_completions', version: 0, data: {} });
  const at = new Date('2026-10-09T12:00Z');
  const r = replayProgress(records, at);
  expect(r.wallet).toBe(0);
  expect(r.ledger.map((x) => x.kind)).toEqual(['award', 'spend']);
  expect(r.streaks[0].current_streak).toBe(7);
  records.push({ id: 'r:2026-10-08', entity: 'routine_completions', version: 0, data: {} });
  expect(replayProgress(records, at).wallet).toBe(1);
});

it('current routine streaks reset on a miss without creating or spending Freeze Points', () => {
  const records: RecordData[] = [
    {
      id: 'r',
      entity: 'routines',
      version: 0,
      data: {
        kind: 'dua',
        frequency: 'daily',
        startDate: '2026-11-01',
        timezone: 'UTC',
        deadline: '00:00',
      },
    },
  ];
  for (let day = 1; day <= 7; day++)
    records.push({
      id: 'r:2026-11-0' + day,
      entity: 'routine_completions',
      version: 0,
      data: { routineId: 'r' },
    });
  const now = new Date('2026-11-09T01:00:00Z'),
    current = replayCurrentProgress(records, now);
  expect(current.wallet).toBe(0);
  expect(current.ledger).toEqual([]);
  expect(current.streaks[0].current_streak).toBe(0);
  expect(current.streaks[0].best_streak).toBe(7);
  expect(replayProgress(records, now).streaks[0].current_streak).toBe(7);
});
