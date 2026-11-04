import { describe, it, expect } from 'vitest';
import { defaults, prayers, prayerStartTimes, periodKey, type RecordData } from '../src/domain';
import { replayProgress } from '../src/progress';
import fixtures from './fixtures/prayer-starts.json';
const routine = {
  frequency: 'after_prayer',
  resetPrayers: ['Fajr', 'Isha'],
  startDate: '2026-10-29',
  timezone: 'Asia/Karachi',
  kind: 'tasbih',
  createdAt: '2026-10-29T00:00:00Z',
  resetSettings: { ...defaults, timezone: 'Asia/Karachi' },
};
const prayer = (name: string, at: string, extra: Record<string, unknown> = {}): RecordData => ({
  id: `2026-10-29:${name}`,
  entity: 'prayer_records',
  version: 0,
  data: { day: '2026-10-29', prayer: name, completedAt: at, ...extra },
});
describe('prayer-start reset periods', () => {
  it('resets at the selected time boundary with no prayer record', () => {
    const fajr = prayers('2026-10-29', routine.resetSettings)[0].start;
    expect(periodKey(routine, new Date(fajr.getTime() - 1))).toBe('2026-10-29:start');
    expect(periodKey(routine, fajr)).toBe('2026-10-29:Fajr');
    expect(periodKey(routine, new Date('2026-10-29T08:00Z'))).toBe('2026-10-29:Fajr');
    expect(periodKey(routine, new Date('2026-10-29T20:00Z'))).toBe('2026-10-29:Isha');
  });
  it('recording prayers or Qaza cannot trigger another reset', () => {
    const rows = [
      prayer('Fajr', '2026-10-29T00:05Z'),
      prayer('Isha', '', { qazaAt: '2026-10-29T00:06Z' }),
    ];
    expect(periodKey(routine, new Date('2026-10-29T00:10Z'), rows)).toBe('2026-10-29:start');
    expect(periodKey(routine, new Date('2026-10-29T02:00Z'), rows)).toBe(
      periodKey(routine, new Date('2026-10-29T02:00Z')),
    );
  });
  it('preserves earlier completions and replays closed periods without daily Freeze Points', () => {
    const records: RecordData[] = [
      { id: 'r', entity: 'routines', version: 0, data: routine },
      {
        id: 'r:2026-10-29:Fajr',
        entity: 'routine_completions',
        version: 0,
        data: { routineId: 'r', period: '2026-10-29:Fajr', completedAt: '2026-10-29T01:00Z' },
      },
    ];
    const result = replayProgress(records, new Date('2026-10-29T15:00Z'));
    expect(result.streaks[0].current_streak).toBe(1);
    expect(result.wallet).toBe(0);
    expect(records[1].data.period).toBe('2026-10-29:Fajr');
  });
  it('matches all 384 frozen cross-language prayer-start cases at whole-second precision', () => {
    for (const fixture of fixtures) {
      const windows = prayerStartTimes(fixture.day, {
        ...defaults,
        ...fixture.settings,
        timezone: 'UTC',
        ishaEnd: 'fajr',
      });
      for (const w of windows)
        expect(
          Math.floor(w.start.getTime() / 1000),
          fixture.day + fixture.settings.method + w.name,
        ).toBe(fixture.expected[w.name]);
    }
  });
});
