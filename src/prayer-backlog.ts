import {
  dayKey,
  periodKey,
  routineDue,
  scheduleOn,
  zonedDate,
  prayerResetEvents,
  type RecordData,
} from './domain';
import { shiftDay, type Slot, completedQaza } from './deen';
export interface NaflEntry {
  id: string;
  routineId: string;
  period: string;
  day: string;
  title: string;
  target: number;
}
export function pendingNaflEntries(records: RecordData[], now = new Date()): NaflEntry[] {
  const done = new Set(
      records.filter((r) => r.entity === 'routine_completions' && !r.deleted).map((r) => r.id),
    ),
    out: NaflEntry[] = [];
  for (const routine of records.filter(
    (r) => r.entity === 'routines' && !r.deleted && r.data.kind === 'nafl',
  )) {
    const r = routine.data,
      today = dayKey(now, r.timezone),
      start = r.startDate || today,
      seen = new Set<string>();
    const add = (period: string, day: string, spec = r) => {
      const id = routine.id + ':' + period;
      if (day > today || day < start || seen.has(id) || done.has(id)) return;
      seen.add(id);
      out.push({
        id,
        routineId: routine.id,
        period,
        day,
        title: spec.title,
        target: Number(spec.target) || 2,
      });
    };
    if (r.frequency === 'unscheduled') {
      if (start <= today) add('lifetime', start);
      continue;
    }
    for (let day = start; day <= today; day = shiftDay(day, 1)) {
      const spec = scheduleOn(r, day),
        date = zonedDate(day, spec.time || '00:00', spec.timezone || r.timezone);
      if (date > now) continue;
      if (spec.frequency === 'after_prayer') {
        for (const event of prayerResetEvents(
          spec,
          records,
          new Date(
            Math.min(zonedDate(shiftDay(day, 1), '00:00', r.timezone).getTime() - 1, now.getTime()),
          ),
          day,
        ))
          add(event.period, event.day, spec);
      } else if (routineDue(spec, date)) add(periodKey(spec, date, records), day, spec);
    }
  }
  return out.sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id));
}
export function pendingQazaSlots(slots: Slot[], now = new Date()) {
  return slots
    .filter((s) => ['missed', 'unknown'].includes(s.status) && Date.parse(s.end) <= now.getTime())
    .sort((a, b) => a.start.localeCompare(b.start));
}
export function historicalQazaRemaining(r: RecordData) {
  return Math.max(0, Number(r.data.quantity) - completedQaza(r.data));
}
