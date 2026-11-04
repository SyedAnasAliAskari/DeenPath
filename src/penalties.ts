import type { PrivateItem } from './private-store';
import type { RecordData } from './domain';
export const penaltyWindowMs = 24 * 60 * 60 * 1000;
export function moneyMinor(value: string): number {
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(value.trim()))
    throw Error('Enter a positive amount with at most two decimal places');
  const [whole, fraction = ''] = value.trim().split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw Error('Charity amount must be greater than zero');
  return amount;
}
export function formatMoney(minor: number, currency = 'PKR') {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(minor / 100);
}
export function penaltyPerformed(task: PrivateItem, records: RecordData[]) {
  return (
    task.state === 'done' ||
    (task.kind === 'charity' && !!task.completedAt) ||
    (!!task.routineId &&
      records.some(
        (r) =>
          !r.deleted && r.entity === 'routine_completions' && r.data.routineId === task.routineId,
      ))
  );
}
export function penaltySchedules(items: PrivateItem[], records: RecordData[]) {
  return items
    .filter(
      (t) =>
        t.type === 'recovery' &&
        t.state === 'pending' &&
        t.createdAt &&
        t.dueAt &&
        !penaltyPerformed(t, records) &&
        (!t.routineId ||
          records.some((r) => r.entity === 'routines' && r.id === t.routineId && !r.deleted)),
    )
    .map((t) => ({
      id: t.id,
      createdAt: String(t.createdAt),
      dueAt: String(t.dueAt),
      ...(t.routineId ? { routineId: String(t.routineId) } : {}),
    }));
}
export function penaltyReminderTimes(createdAt: string, dueAt: string) {
  const start = Date.parse(createdAt),
    end = Date.parse(dueAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const times: number[] = [];
  for (let at = start + 4 * 3600000; at < Math.min(end, start + penaltyWindowMs); at += 4 * 3600000)
    times.push(at);
  return times;
}
