import { dayKey, prayers, prayerNames, type Settings, type RecordData } from './domain';
export const shiftDay = (day: string, n: number) =>
  new Date(Date.parse(day + 'T12:00Z') + n * 86400000).toISOString().slice(0, 10);
export type PrayerStatus = 'ontime' | 'qaza' | 'missed' | 'unknown' | 'notDue' | 'open' | 'na';
export interface Slot {
  day: string;
  prayer: string;
  id: string;
  status: PrayerStatus;
  start: string;
  end: string;
  friday: boolean;
  displayPrayer: string;
}
export interface Streak {
  current: number;
  best: number;
  total: number;
}
export function streak(sequence: (boolean | null)[]): Streak {
  let current = 0,
    best = 0,
    total = 0;
  for (const success of sequence) {
    if (success === null) continue;
    current = success ? current + 1 : 0;
    if (success) total++;
    best = Math.max(best, current);
  }
  return { current, best, total };
}
export function prayerSlots(
  records: RecordData[],
  s: Settings,
  from: string,
  to: string,
  now = new Date(),
): Slot[] {
  const map = new Map(
    records.filter((r) => r.entity === 'prayer_records' && !r.deleted).map((r) => [r.id, r.data]),
  );
  const rows: Slot[] = [];
  for (let day = from; day <= to; day = shiftDay(day, 1)) {
    for (const w of prayers(day, s)) {
      const r = map.get(w.key),
        start = r?.windowStart || w.start.toISOString(),
        end = r?.windowEnd || w.end.toISOString();
      const valid =
        r?.completedAt &&
        Date.parse(r.completedAt) >= Date.parse(start) &&
        Date.parse(r.completedAt) < Date.parse(end);
      const status: PrayerStatus =
        r?.status === 'na'
          ? 'na'
          : r?.qazaAt
            ? 'qaza'
            : valid
              ? 'ontime'
              : r?.status === 'missed' || r?.completedAt
                ? 'missed'
                : now.getTime() < Date.parse(start)
                  ? 'notDue'
                  : now.getTime() < Date.parse(end)
                    ? 'open'
                    : 'unknown';
      rows.push({
        day,
        prayer: w.name,
        id: w.key,
        start,
        end,
        status,
        friday: w.name === 'Dhuhr' && new Date(day + 'T12:00Z').getUTCDay() === 5,
        displayPrayer:
          w.name === 'Dhuhr' && new Date(day + 'T12:00Z').getUTCDay() === 5 && r?.midday !== 'Dhuhr'
            ? 'Jummah'
            : w.name,
      });
    }
  }
  return rows;
}
export function summarizeSlots(slots: Slot[]) {
  return {
    total: slots.filter((x) => !['na', 'notDue'].includes(x.status)).length,
    ontime: slots.filter((x) => x.status === 'ontime').length,
    qaza: slots.filter((x) => x.status === 'qaza').length,
    missed: slots.filter((x) => x.status === 'missed').length,
    unknown: slots.filter((x) => x.status === 'unknown' || x.status === 'open').length,
    current: streak(
      slots.map((x) =>
        ['na', 'notDue', 'open'].includes(x.status) ? null : x.status === 'ontime',
      ),
    ).current,
    best: streak(
      slots.map((x) =>
        ['na', 'notDue', 'open'].includes(x.status) ? null : x.status === 'ontime',
      ),
    ).best,
  };
}
export function prayerReport(slots: Slot[]) {
  const rows = [...prayerNames, 'Jummah'].map((name) => ({
    name,
    ...summarizeSlots(slots.filter((s) => s.displayPrayer === name)),
  }));
  const days = [...new Set(slots.map((x) => x.day))];
  const overall = streak(
    days.map((day) => {
      const eligible = slots.filter((s) => s.day === day && s.status !== 'na');
      if (eligible.some((s) => ['missed', 'qaza', 'unknown'].includes(s.status))) return false;
      if (!eligible.length || eligible.some((s) => s.status === 'notDue' || s.status === 'open'))
        return null;
      return eligible.every((s) => s.status === 'ontime');
    }),
  );
  return [
    ...rows,
    { name: 'Overall', ...summarizeSlots(slots), current: overall.current, best: overall.best },
  ];
}
export type RangePreset =
  '7' | '30' | '90' | 'month' | 'previous' | 'selectedMonth' | 'year' | 'custom' | 'lifetime';
export function dateRange(
  preset: RangePreset,
  today: string,
  start: string,
  selected = today,
  customEnd = today,
) {
  let from = start,
    to = today;
  if (['7', '30', '90'].includes(preset)) from = shiftDay(today, 1 - Number(preset));
  if (preset === 'month') from = today.slice(0, 7) + '-01';
  if (preset === 'previous') {
    to = shiftDay(today.slice(0, 7) + '-01', -1);
    from = to.slice(0, 7) + '-01';
  }
  if (preset === 'selectedMonth') {
    from = selected.slice(0, 7) + '-01';
    to = shiftDay(
      new Date(Date.UTC(Number(selected.slice(0, 4)), Number(selected.slice(5, 7)), 1))
        .toISOString()
        .slice(0, 10),
      -1,
    );
  }
  if (preset === 'year') {
    from = selected.slice(0, 4) + '-01-01';
    to = selected.slice(0, 4) + '-12-31';
  }
  if (preset === 'custom') {
    from = selected;
    to = customEnd;
  }
  return { from: from < start ? start : from, to: to > today ? today : to };
}
export interface Habit {
  id: string;
  name: string;
  start: string;
  archived?: boolean;
  recovery?: {
    kind: 'nafl' | 'tasbih' | 'custom' | 'charity';
    amountMinor?: number;
    currency?: string;
    title: string;
    target: number;
    perOccurrence: boolean;
    reminderDay?: string;
    time?: string;
  };
}
export interface Checkin {
  id: string;
  habitId: string;
  day: string;
  state: 'avoided' | 'slipped' | 'skip';
  count: number;
  note: string;
}
export interface Recovery {
  id: string;
  habitId: string;
  day: string;
  kind: string;
  title: string;
  target: number;
  count: number;
  state: 'pending' | 'done' | 'dismissed';
  time?: string;
  postponed?: string;
  createdAt?: string;
  dueAt?: string;
  amountMinor?: number;
  currency?: string;
}
export function habitStats(habit: Habit, entries: Checkin[], from: string, to: string) {
  const relevant = entries.filter((c) => c.habitId === habit.id && c.day >= from && c.day <= to);
  const map = new Map(entries.filter((c) => c.habitId === habit.id).map((c) => [c.day, c]));
  const sequence: boolean[] = [];
  for (let d = habit.start; d <= to; d = shiftDay(d, 1))
    sequence.push(map.get(d)?.state === 'avoided');
  const days = Math.max(
    0,
    Math.round((Date.parse(to) - Date.parse(from < habit.start ? habit.start : from)) / 86400000) +
      1,
  );
  return {
    ...streak(sequence),
    success: relevant.filter((c) => c.state === 'avoided').length,
    slipped: relevant.filter((c) => c.state === 'slipped').length,
    unanswered: days - relevant.filter((c) => c.state !== 'skip').length,
    occurrences: relevant.reduce((n, c) => n + (c.state === 'slipped' ? c.count : 0), 0),
  };
}
export function recoveryTasks(
  habit: Habit,
  check: Checkin,
  existing: Recovery[],
  now = new Date().toISOString(),
): Recovery[] {
  if (check.state !== 'slipped' || !habit.recovery) return [];
  const spec = habit.recovery,
    count = spec.perOccurrence ? Math.min(check.count, 1000) : 1;
  return Array.from({ length: count }, (_, i) => {
    const id = `recovery:${habit.id}:${check.day}:${i}`;
    return (
      existing.find((x) => x.id === id) || {
        id,
        habitId: habit.id,
        day: spec.reminderDay || check.day,
        kind: spec.kind,
        title: spec.title,
        target: spec.target,
        count: 0,
        state: 'pending',
        time: spec.time,
        createdAt: now,
        dueAt: new Date(Date.parse(now) + 86400000).toISOString(),
        ...(spec.kind === 'charity'
          ? { amountMinor: spec.amountMinor, currency: spec.currency }
          : {}),
      }
    );
  });
}
export function qiblaBearing(lat: number, lng: number) {
  const rad = Math.PI / 180,
    a = lat * rad,
    k = 21.4225 * rad,
    delta = (39.8262 - lng) * rad;
  return (
    (Math.atan2(Math.sin(delta), Math.cos(a) * Math.tan(k) - Math.sin(a) * Math.cos(delta)) / rad +
      360) %
    360
  );
}
export function hijriParts(day: string, adjustment = 0) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-u-ca-islamic-civil', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      timeZone: 'UTC',
    })
      .formatToParts(new Date(shiftDay(day, adjustment) + 'T12:00Z'))
      .map((p) => [p.type, p.value]),
  );
}
/** Month/era names are explicit because some Android WebViews format Islamic dates with Gregorian month names and BC. */
export function formatHijriDay(
  day: string,
  lang: 'en' | 'ur' | 'ar',
  adjustment = 0,
  withYear = true,
) {
  const parts = hijriParts(day, adjustment);
  const months = {
    en: [
      'Muharram',
      'Safar',
      'Rabi al-Awwal',
      'Rabi al-Thani',
      'Jumada al-Awwal',
      'Jumada al-Thani',
      'Rajab',
      'Sha’ban',
      'Ramadan',
      'Shawwal',
      'Dhu al-Qi’dah',
      'Dhu al-Hijjah',
    ],
    ur: [
      'محرم',
      'صفر',
      'ربیع الاول',
      'ربیع الثانی',
      'جمادی الاول',
      'جمادی الثانی',
      'رجب',
      'شعبان',
      'رمضان',
      'شوال',
      'ذوالقعدہ',
      'ذوالحجہ',
    ],
    ar: [
      'محرم',
      'صفر',
      'ربيع الأول',
      'ربيع الآخر',
      'جمادى الأولى',
      'جمادى الآخرة',
      'رجب',
      'شعبان',
      'رمضان',
      'شوال',
      'ذو القعدة',
      'ذو الحجة',
    ],
  };
  const number = new Intl.NumberFormat(lang, { useGrouping: false });
  const date = number.format(Number(parts.day)) + ' ' + months[lang][Number(parts.month) - 1];
  return (
    date +
    (withYear
      ? ' ' +
        number.format(Number(parts.year)) +
        ' ' +
        (lang === 'en' ? 'AH' : lang === 'ur' ? 'ھ' : 'هـ')
      : '')
  );
}
export function quietAt(date: Date, s: Settings) {
  if (!s.quietEnabled) return false;
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: s.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  const a = s.quietStart || '22:00',
    b = s.quietEnd || '07:00';
  return a === b || (a < b ? time >= a && time < b : time >= a || time < b);
}

export function completedQaza(data: Record<string, any>): number {
  return (data.completed || []).reduce((n: number, c: any) => n + Number(c.quantity || 1), 0);
}
