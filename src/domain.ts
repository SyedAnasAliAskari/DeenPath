import deployment from './deployment.json';
import { Coordinates, CalculationMethod, Madhab, PrayerTimes } from 'adhan';
export type Lang = 'en' | 'ur' | 'ar';
export type Entity =
  | 'prayer_records'
  | 'qaza_records'
  | 'routines'
  | 'routine_completions'
  | 'tasbih_progress'
  | 'user_settings'
  | 'qaza_history'
  | 'milestone_events'
  | 'learning_progress'
  | 'private_records';
export interface RecordData {
  id: string;
  entity: Entity;
  version: number;
  data: Record<string, any>;
  deleted?: boolean;
}
export interface Operation {
  id: string;
  record: RecordData;
  attempts: number;
  nextTry: number;
  error?: string;
}
export interface Settings {
  lat: number;
  lng: number;
  city: string;
  timezone: string;
  method: string;
  hanafi: boolean;
  adjustments: number[];
  lang: Lang;
  dark: boolean;
  appearance?: 'system' | 'light' | 'dark';
  enforcer: boolean;
  warning: number;
  strict: number;
  silent: boolean;
  vibration: boolean;
  ishaEnd: 'midnight' | 'fajr';
  api: string;
  [key: string]: any;
}
export const defaults: Settings = {
  lat: 24.8607,
  lng: 67.0011,
  city: 'Karachi',
  timezone: 'Asia/Karachi',
  method: 'Karachi',
  hanafi: true,
  adjustments: [0, 0, 0, 0, 0],
  lang: 'en',
  dark: false,
  appearance: 'system',
  enforcer: false,
  reminderRepeat: { gentle: 15, warning: 10, strict: 1 },
  reminderMiddlePercent: 42,
  reminderFinalPercent: 75,
  reminderTheme: 'balanced',
  reliablePrayerAlarms: true,
  wakeEnforcer: false,
  warning: 50,
  strict: 85,
  silent: false,
  vibration: true,
  ishaEnd: 'midnight',
  api: deployment.api,
};
export function dayKey(
  date = new Date(),
  zone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
// Convert a civil time to an instant, including DST offsets. Missing DST times move forward.
export function zonedDate(day: string, time: string, zone: string): Date {
  const target = Date.parse(`${day}T${time}:00Z`);
  let t = target;
  for (let i = 0; i < 4; i++) {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(t));
    const v = Object.fromEntries(p.map((x) => [x.type, x.value]));
    const wall = Date.parse(`${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}:${v.second}Z`);
    const delta = target - wall;
    if (!delta) break;
    t += delta;
  }
  return new Date(t);
}
export const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
export interface PrayerWindow {
  name: string;
  start: Date;
  end: Date;
  key: string;
}
export function prayerStartTimes(day: string, s: Settings) {
  const factory =
    (
      CalculationMethod as unknown as Record<
        string,
        () => ReturnType<typeof CalculationMethod.Karachi>
      >
    )[s.method] || CalculationMethod.Karachi;
  const params = factory();
  params.madhab = s.hanafi ? Madhab.Hanafi : Madhab.Shafi;
  const [year, month, date] = day.split('-').map(Number);
  const times = new PrayerTimes(
    new Coordinates(s.lat, s.lng),
    new Date(year, month - 1, date, 12),
    params,
  );
  return prayerNames.map((name, i) => {
    const raw = times[name.toLowerCase() as 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'];
    const at = Math.floor((raw.getTime() + s.adjustments[i] * 60000) / 1000) * 1000;
    if (!Number.isFinite(at)) throw Error('Prayer start unavailable at these coordinates');
    return { name, key: `${day}:${name}`, start: new Date(at) };
  });
}
export function prayers(day: string, s: Settings): PrayerWindow[] {
  const f =
    (
      CalculationMethod as unknown as Record<
        string,
        () => ReturnType<typeof CalculationMethod.Karachi>
      >
    )[s.method] || CalculationMethod.Karachi;
  const params = f();
  params.madhab = s.hanafi ? Madhab.Hanafi : Madhab.Shafi;
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12);
  const tomorrow = new Date(y, m - 1, d + 1, 12);
  const c = new Coordinates(s.lat, s.lng);
  const p = new PrayerTimes(c, dt, params);
  const n = new PrayerTimes(c, tomorrow, params);
  const starts = [p.fajr, p.dhuhr, p.asr, p.maghrib, p.isha].map(
    (v, i) => new Date(v.getTime() + s.adjustments[i] * 60000),
  );
  const nightMid = new Date(p.maghrib.getTime() + (n.fajr.getTime() - p.maghrib.getTime()) / 2);
  const ends = [
    p.sunrise,
    starts[2],
    starts[3],
    starts[4],
    s.ishaEnd === 'fajr' ? n.fajr : nightMid,
  ];
  if (
    starts.some(
      (t, i) =>
        !Number.isFinite(t.getTime()) || !Number.isFinite(ends[i].getTime()) || ends[i] <= t,
    )
  )
    throw new Error(
      'Prayer times unavailable at these coordinates. Select a supported nearby location.',
    );
  return prayerNames.map((name, i) => ({
    name,
    start: starts[i],
    end: ends[i],
    key: `${day}:${name}`,
  }));
}
export function recordedPrayerWindow(w: PrayerWindow, record?: RecordData): PrayerWindow {
  if (!record || record.deleted) return w;
  const start = record.data.windowStart ? new Date(record.data.windowStart) : w.start;
  const end = record.data.windowEnd ? new Date(record.data.windowEnd) : w.end;
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start)
    throw Error('Saved prayer window is invalid. Open prayer details to correct it.');
  return { ...w, start, end };
}
export function prayerState(
  w: PrayerWindow,
  record: RecordData | undefined,
  now = new Date(),
): string {
  const saved = record && !record.deleted ? record : undefined;
  const window = recordedPrayerWindow(w, saved);
  if (saved?.data.status === 'na') return 'na';
  if (saved?.data.qazaAt) return 'qaza';
  if (saved?.data.completedAt) {
    const t = new Date(saved.data.completedAt);
    return t >= window.start && t < window.end ? 'ontime' : 'missed';
  }
  if (saved?.data.status === 'missed') return 'missed';
  return now < window.start ? 'upcoming' : now >= window.end ? 'unknown' : 'pending';
}
// Calculate reset boundaries from prayer starts; never write a worship completion.
const resetStartCache = new Map<string, { period: string; day: string; at: number }[]>();
export function prayerResetEvents(
  r: Record<string, any>,
  _records: RecordData[] = [],
  now = new Date(),
  from = r.startDate,
) {
  const settings = r.resetSettings as Settings;
  if (!settings) throw Error('Choose prayer settings for this routine');
  const lastDay = dayKey(now, r.timezone);
  const until = r.endDate && r.endDate < lastDay ? r.endDate : lastDay;
  const events: { period: string; day: string; at: number }[] = [];
  for (let day = from < r.startDate ? r.startDate : from; day <= until;) {
    const key = day + JSON.stringify(settings);
    let starts = resetStartCache.get(key);
    if (!starts) {
      try {
        starts = prayerStartTimes(day, settings).map((w) => ({
          period: w.key,
          day,
          at: w.start.getTime(),
        }));
      } catch {
        day = new Date(Date.parse(day + 'T12:00Z') + 86400000).toISOString().slice(0, 10);
        continue;
      }
      if (resetStartCache.size >= 2048) resetStartCache.clear();
      resetStartCache.set(key, starts);
    }
    events.push(
      ...starts.filter(
        (w) => (r.resetPrayers || []).includes(w.period.split(':')[1]) && w.at <= now.getTime(),
      ),
    );
    day = new Date(Date.parse(day + 'T12:00Z') + 86400000).toISOString().slice(0, 10);
  }
  return events.sort((a, b) => a.at - b.at || a.period.localeCompare(b.period));
}
export function periodKey(
  r: Record<string, any>,
  now = new Date(),
  records: RecordData[] = [],
): string {
  if (r.frequency === 'after_prayer') {
    const today = dayKey(now, r.timezone);
    const anchor = r.endDate && r.endDate < today ? r.endDate : today;
    if (anchor >= r.startDate) prayerStartTimes(anchor, r.resetSettings);
    const previous = new Date(Date.parse(anchor + 'T12:00Z') - 86400000).toISOString().slice(0, 10);
    return prayerResetEvents(r, records, now, previous).at(-1)?.period || `${r.startDate}:start`;
  }
  let day = dayKey(now, r.timezone);
  if (r.frequency === 'daily' && r.deadline && r.deadline !== '00:00') {
    const clock = new Intl.DateTimeFormat('en-GB', {
      timeZone: r.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(now);
    if (clock < r.deadline) {
      const d = new Date(day + 'T12:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      day = d.toISOString().slice(0, 10);
    }
  }
  if (r.calendar === 'hijri') return day;
  switch (r.frequency) {
    case 'unscheduled':
      return 'lifetime';
    case 'weekly': {
      const d = new Date(`${day}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      return d.toISOString().slice(0, 10);
    }
    case 'monthly':
      return day.slice(0, 7);
    case 'yearly':
      return day.slice(0, 4);
    case 'interval': {
      const elapsed = Math.floor((Date.parse(day) - Date.parse(r.startDate)) / 86400000);
      return `${r.startDate}:${Math.floor(elapsed / Math.max(1, Number(r.interval) || 1))}`;
    }
    default:
      return day;
  }
}
export function routineDue(r: Record<string, any>, date: Date): boolean {
  const day = dayKey(date, r.timezone);
  if (r.startDate && day < r.startDate) return false;
  if (r.endDate && day > r.endDate) return false;
  if (r.frequency === 'unscheduled') return false;
  if (r.calendar === 'hijri') {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-u-ca-islamic-civil', {
        timeZone: r.timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      })
        .formatToParts(new Date(date.getTime() + Number(r.hijriAdjustment || 0) * 86400000))
        .map((p) => [p.type, p.value]),
    );
    return Number(parts.month) === Number(r.hijriMonth) && Number(parts.day) === Number(r.hijriDay);
  }
  const d = new Date(day + 'T12:00:00Z');
  switch (r.frequency) {
    case 'unscheduled':
      return false;
    case 'once':
      return day === r.startDate;
    case 'weekdays':
      return (r.weekdays || []).includes(d.getUTCDay());
    case 'weekly':
      return d.getUTCDay() === Number(r.weekday ?? 1);
    case 'monthly':
      return (
        d.getUTCDate() ===
        Math.min(
          Number(r.monthday ?? 1),
          new Date(d.getUTCFullYear(), d.getUTCMonth() + 1, 0).getDate(),
        )
      );
    case 'yearly':
      return day.slice(5) === (r.startDate || day).slice(5);
    case 'interval':
      return (
        Math.floor((Date.parse(day) - Date.parse(r.startDate)) / 86400000) %
          Math.max(1, Number(r.interval) || 1) ===
        0
      );
    default:
      return true;
  }
}
export function completionId(routine: string, period: string) {
  return `${routine}:${period}`;
}
export function backoff(attempt: number) {
  return Math.min(3600000, 1000 * 2 ** Math.min(attempt, 12));
}
export function validateSettings(s: Settings) {
  if (
    !Number.isFinite(s.lat) ||
    Math.abs(s.lat) > 89 ||
    !Number.isFinite(s.lng) ||
    Math.abs(s.lng) > 180
  )
    throw Error('Enter valid latitude and longitude');
  new Intl.DateTimeFormat('en', { timeZone: s.timezone });
  if (s.api && !/^https:\/\/[^\s]+\/api\.php$/.test(s.api))
    throw Error('API URL must be HTTPS and end with /api.php');
  if (s.warning < 1 || s.strict <= s.warning || s.strict >= 100)
    throw Error('Reminder percentages must satisfy 0 < warning < strict < 100');
}

export function scheduleOn(r: Record<string, any>, day: string) {
  for (const entry of r.scheduleHistory || [])
    if (day < entry.until) return entry.schedule as Record<string, any>;
  return r;
}

export const advanceCounter = (count: number, target: number) =>
  Math.min(target, Math.max(0, count) + 1);
