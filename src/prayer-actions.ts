import { prayerState, recordedPrayerWindow, type PrayerWindow, type RecordData } from './domain';
export type PrayerAction = 'prayed' | 'qaza' | 'snooze' | 'close';
/** A display event, snooze, or close can never produce a worship write. */
export function prayerMutation(
  action: PrayerAction,
  window: PrayerWindow,
  old: RecordData | undefined,
  now = new Date(),
) {
  if (action === 'snooze' || action === 'close') return null;
  window = recordedPrayerWindow(window, old);
  const status = prayerState(window, old, now);
  if (['ontime', 'qaza', 'na'].includes(status)) return null;
  if (action === 'prayed' && !(now >= window.start && now < window.end))
    throw Error('Prayer window is not open');
  if (action === 'qaza' && !(now >= window.end)) throw Error('Prayer window has not ended');
  const [day, prayer] = window.key.split(':');
  return {
    ...(!old?.deleted ? old?.data : {}),
    day,
    prayer,
    windowStart: window.start.toISOString(),
    windowEnd: window.end.toISOString(),
    timezone: !old?.deleted ? old?.data.timezone : undefined,
    completedAt: action === 'prayed' ? now.toISOString() : undefined,
    qazaAt: action === 'qaza' ? now.toISOString() : undefined,
  };
}
export function remainingSeconds(end: Date, now = new Date()) {
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 1000));
}
