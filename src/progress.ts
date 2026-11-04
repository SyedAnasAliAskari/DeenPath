import {
  prayerResetEvents,
  dayKey,
  periodKey,
  zonedDate,
  routineDue,
  scheduleOn,
  type RecordData,
} from './domain';
export interface Progress {
  wallet: number;
  streaks: {
    routine_id: string;
    current_streak: number;
    best_streak: number;
    success_run: number;
  }[];
  ledger: {
    id: string;
    routine_id: string;
    day: string;
    kind: string;
    delta: number;
    balance_after: number;
  }[];
}
// Local projection follows the server's chronological replay. It remains available offline.
export function replayProgress(
  records: RecordData[],
  now = new Date(),
  legacyFreeze = false,
): Progress {
  const routines = records.filter(
    (r) =>
      r.entity === 'routines' &&
      !r.deleted &&
      ['quran', 'dua', 'tasbih'].includes(r.data.kind) &&
      !r.data.generated,
  );
  const completed = new Set(
    records.filter((r) => r.entity === 'routine_completions' && !r.deleted).map((r) => r.id),
  );
  const events: {
    rid: string;
    period: string;
    day: string;
    close: number;
    daily: boolean;
    done: boolean;
  }[] = [];
  const states = new Map<string, Progress['streaks'][number]>();
  for (const routine of routines) {
    const original = routine.data;
    let r = original;
    const zone = r.timezone;
    const end = dayKey(now, zone);
    const start = r.startDate;
    states.set(routine.id, {
      routine_id: routine.id,
      current_streak: 0,
      best_streak: 0,
      success_run: 0,
    });
    const seen = new Set<string>();
    if (r.frequency === 'unscheduled') continue;
    if (r.frequency === 'after_prayer') {
      let previous = `${r.startDate}:start`;
      let previousDay = r.startDate;
      for (const reset of prayerResetEvents(r, records, now)) {
        if (reset.at > Date.parse(r.createdAt || r.startDate + 'T00:00Z'))
          events.push({
            rid: routine.id,
            period: previous,
            day: previousDay,
            close: reset.at,
            daily: false,
            done: completed.has(`${routine.id}:${previous}`),
          });
        previous = reset.period;
        previousDay = reset.day;
      }
      continue;
    }
    for (
      let d = new Date(start + 'T12:00:00Z');
      d.toISOString().slice(0, 10) < end;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const day = d.toISOString().slice(0, 10);
      r = scheduleOn(original, day);
      const local = zonedDate(day, '23:59', zone);
      if (!routineDue(r, local)) continue;
      const key = periodKey(r, local);
      if (seen.has(key)) continue;
      seen.add(key);
      let closeDay = new Date(d);
      closeDay.setUTCDate(closeDay.getUTCDate() + 1);
      switch (r.frequency) {
        case 'weekly':
          closeDay = new Date(key + 'T12:00:00Z');
          closeDay.setUTCDate(closeDay.getUTCDate() + 7);
          break;
        case 'monthly':
          closeDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 12));
          break;
        case 'yearly':
          if (r.calendar === 'hijri') break;
          closeDay = new Date(Date.UTC(d.getUTCFullYear() + 1, 0, 1, 12));
          break;
        case 'interval':
          closeDay = new Date(start + 'T12:00:00Z');
          closeDay.setUTCDate(
            closeDay.getUTCDate() +
              (Number(key.split(':').at(-1)) + 1) * Math.max(1, Number(r.interval)),
          );
          break;
      }
      const close = zonedDate(
        closeDay.toISOString().slice(0, 10),
        r.frequency === 'daily' ? r.deadline || '00:00' : '00:00',
        zone,
      ).getTime();
      if (close > now.getTime()) continue;
      events.push({
        rid: routine.id,
        period: key,
        day,
        close,
        daily: r.frequency === 'daily',
        done: completed.has(`${routine.id}:${key}`),
      });
    }
  }
  events.sort((a, b) => a.close - b.close || (a.rid < b.rid ? -1 : a.rid > b.rid ? 1 : 0));
  let wallet = 0;
  const ledger: Progress['ledger'] = [];
  for (const e of events) {
    const s = states.get(e.rid)!;
    let kind = '',
      delta = 0;
    if (e.done) {
      s.current_streak++;
      s.success_run++;
      if (legacyFreeze && e.daily && s.success_run % 7 === 0 && wallet < 3) {
        kind = 'award';
        delta = 1;
      }
    } else {
      s.success_run = 0;
      if (legacyFreeze && e.daily && wallet > 0) {
        kind = 'spend';
        delta = -1;
      } else s.current_streak = 0;
    }
    if (kind) {
      wallet += delta;
      ledger.push({
        id: `${e.rid}:${e.period}:${kind}`,
        routine_id: e.rid,
        day: e.day,
        kind,
        delta,
        balance_after: wallet,
      });
    }
    s.best_streak = Math.max(s.best_streak, s.current_streak);
  }
  return { wallet, streaks: [...states.values()], ledger };
}
