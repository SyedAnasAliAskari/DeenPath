import { describe, it, expect } from 'vitest';
import {
  defaults,
  prayers,
  prayerState,
  dayKey,
  zonedDate,
  periodKey,
  routineDue,
  backoff,
} from '../src/domain';
describe('prayer boundaries', () => {
  const windows = prayers('2026-10-26', defaults);
  it('calculates five ordered Karachi prayer times offline', () => {
    expect(windows).toHaveLength(5);
    expect(dayKey(windows[0].start, defaults.timezone)).toBe('2026-10-26');
    for (let i = 0; i < 5; i++)
      expect(windows[i].end.getTime()).toBeGreaterThan(windows[i].start.getTime());
  });
  it('ends Fajr at sunrise, before Dhuhr', () => {
    expect(windows[0].end.getTime()).toBeLessThan(windows[1].start.getTime() - 3600000);
    expect(prayerState(windows[0], undefined, windows[0].end)).toBe('unknown');
  });
  it('does not turn Qaza into an on-time completion', () => {
    const w = windows[0];
    expect(
      prayerState(
        w,
        { entity: 'prayer_records', id: w.key, version: 0, data: { qazaAt: w.end.toISOString() } },
        new Date(),
      ),
    ).toBe('qaza');
  });
  it('recognizes an out-of-window correction as missed', () => {
    const w = windows[0];
    expect(
      prayerState(
        w,
        {
          entity: 'prayer_records',
          id: w.key,
          version: 0,
          data: { completedAt: w.end.toISOString() },
        },
        w.end,
      ),
    ).toBe('missed');
  });
  it('supports Hanafi and Standard Asr', () => {
    expect(prayers('2026-10-26', { ...defaults, hanafi: false })[2].start.getTime()).toBeLessThan(
      windows[2].start.getTime(),
    );
  });
  it('defaults Isha to the midpoint of the night and supports next Fajr', () => {
    expect(
      prayers('2026-10-26', { ...defaults, ishaEnd: 'fajr' })[4].end.getTime(),
    ).toBeGreaterThan(windows[4].end.getTime());
  });
});
describe('civil schedules', () => {
  it('uses the selected timezone rather than the host date', () =>
    expect(dayKey(new Date('2026-10-25T20:30:00Z'), 'Asia/Karachi')).toBe('2026-10-26'));
  it('converts a Karachi wall time to the correct instant', () =>
    expect(zonedDate('2026-10-26', '23:00', 'Asia/Karachi').toISOString()).toBe(
      '2026-10-26T18:00:00.000Z',
    ));
  it('handles DST offsets on both sides of a transition', () => {
    expect(zonedDate('2026-03-28', '12:00', 'Europe/London').toISOString()).toBe(
      '2026-03-28T12:00:00.000Z',
    );
    expect(zonedDate('2026-03-29', '12:00', 'Europe/London').toISOString()).toBe(
      '2026-03-29T11:00:00.000Z',
    );
  });
  it('starts weekly periods on Monday', () =>
    expect(periodKey({ timezone: 'UTC', frequency: 'weekly' }, new Date('2026-10-25T12:00Z'))).toBe(
      '2026-10-19',
    ));
  it('clamps monthly reminder day to the last day of short months', () =>
    expect(
      routineDue(
        { timezone: 'UTC', frequency: 'monthly', monthday: 31 },
        new Date('2026-02-28T12:00Z'),
      ),
    ).toBe(true));
  it('uses anchored custom intervals', () => {
    const r = { timezone: 'UTC', frequency: 'interval', interval: 3, startDate: '2026-10-01' };
    expect(periodKey(r, new Date('2026-10-05T12:00Z'))).toBe('2026-10-01:1');
    expect(routineDue(r, new Date('2026-10-04T12:00Z'))).toBe(true);
  });
  it('caps retry backoff at an hour', () => expect(backoff(100)).toBe(3600000));
  it('assigns an early morning completion to the previous daily deadline period', () => {
    const r = { frequency: 'daily', timezone: 'Asia/Karachi', deadline: '04:00' };
    expect(periodKey(r, new Date('2026-10-26T22:00:00Z'))).toBe('2026-10-26');
    expect(periodKey(r, new Date('2026-10-26T23:00:00Z'))).toBe('2026-10-27');
  });
  it('never schedules an unscheduled counter', () => {
    const r = { frequency: 'unscheduled', timezone: 'UTC' };
    expect(periodKey(r, new Date())).toBe('lifetime');
    expect(routineDue(r, new Date())).toBe(false);
  });
});
