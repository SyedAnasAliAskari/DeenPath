import { penaltyWindowMs } from './penalties';
import { habitStats, shiftDay, type Habit, type Checkin } from './deen';
import type { PrivateItem } from './private-store';
import type { RecordData } from './domain';
export type SecretAnswer = 'avoided' | 'slipped';
export function secretStats(habit: Habit, items: PrivateItem[], today: string) {
  const unique = new Map<string, Checkin>();
  for (const item of items)
    if (item.type === 'checkin' && item.habitId === habit.id && item.day <= today)
      unique.set(item.day, item as unknown as Checkin);
  const checks = [...unique.values()];
  const until = unique.has(today) ? today : shiftDay(today, -1);
  return {
    ...habitStats(habit, checks, habit.start, until),
    points: checks.filter((c) => c.state === 'avoided').length,
  };
}
export function planSecretAnswer(
  items: PrivateItem[],
  records: RecordData[],
  habitId: string,
  day: string,
  state: SecretAnswer,
  today: string,
  newRoutineId: string,
  timezone: string,
  now = new Date().toISOString(),
) {
  const h = items.find((x) => x.type === 'habit' && x.id === habitId);
  if (
    !h ||
    h.archived ||
    day < h.start ||
    day > today ||
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(Date.parse(day)) ||
    new Date(day).toISOString().slice(0, 10) !== day
  )
    throw Error('Invalid Secrets check-in');
  const id = habitId + ':' + day,
    prior = items.find((x) => x.type === 'checkin' && x.id === id),
    taskId = `recovery:${habitId}:${day}:0`,
    task = items.find((x) => x.id === taskId);
  if (
    prior?.state === state &&
    (state === 'avoided' || task?.routineId || task?.kind === 'charity' || task?.state === 'done')
  )
    return { changed: false, privateItems: [] as PrivateItem[], publicRecords: [] as RecordData[] };
  const privateItems: PrivateItem[] = [
      {
        ...prior,
        id,
        type: 'checkin',
        habitId,
        day,
        state,
        count: state === 'slipped' ? 1 : 0,
        note: prior?.note || '',
      },
    ],
    publicRecords: RecordData[] = [];
  if (state === 'slipped' && h.recovery) {
    const spec = task || h.recovery,
      routineId = task?.routineId || newRoutineId,
      kind = ['nafl', 'charity'].includes(spec.kind) ? spec.kind : 'tasbih',
      target = Math.max(1, Number(spec.target) || 1);
    if (
      kind === 'charity' &&
      (!Number.isSafeInteger(spec.amountMinor) ||
        spec.amountMinor <= 0 ||
        !/^[A-Z]{3}$/.test(spec.currency || ''))
    )
      throw Error('Invalid charity amount or currency');
    const createdAt = task?.createdAt || now,
      dueAt = task?.dueAt || new Date(Date.parse(createdAt) + penaltyWindowMs).toISOString();
    const existing = records.find((r) => r.entity === 'routines' && r.id === routineId);
    privateItems.push({
      ...task,
      id: taskId,
      type: 'recovery',
      habitId,
      day,
      kind,
      title: spec.title || '',
      target,
      count: task?.count || 0,
      state:
        task?.state === 'done' || (kind === 'charity' && task?.completedAt) ? 'done' : 'pending',
      ...(kind === 'charity'
        ? { amountMinor: spec.amountMinor, currency: spec.currency }
        : { routineId }),
      ...(!task || task.createdAt ? { createdAt, dueAt } : {}),
      source: 'secret-checkin',
    });
    if (kind !== 'charity' && task?.state !== 'done' && (!existing || existing.deleted))
      publicRecords.push({
        id: routineId,
        entity: 'routines',
        version: existing?.version || 0,
        deleted: false,
        data: {
          title: kind === 'nafl' ? 'Nafl penalty' : 'Tasbih penalty',
          kind,
          target,
          dhikr: kind === 'tasbih' ? spec.title || 'أَسْتَغْفِرُ اللَّهَ' : '',
          frequency: 'unscheduled',
          timezone,
          startDate: day,
          time: '00:00',
          generated: true,
          secretPenalty: true,
        },
      });
  } else if (state === 'avoided' && task) {
    privateItems.push({ ...task, state: 'dismissed' });
    const routine = records.find(
      (r) => r.entity === 'routines' && r.id === task.routineId && !r.deleted,
    );
    const performed = records.some(
      (r) =>
        !r.deleted &&
        r.data.routineId === task.routineId &&
        (r.entity === 'routine_completions' ||
          (r.entity === 'tasbih_progress' && r.data.count > 0)),
    );
    if (routine && !performed) publicRecords.push({ ...routine, deleted: true });
  }
  return { changed: true, privateItems, publicRecords };
}
