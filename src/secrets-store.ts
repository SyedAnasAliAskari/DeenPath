import { penaltySchedules } from './penalties';
import { db } from './store';
import { Native, isNative } from './native';
import { privateItems, putPrivate } from './private-store';
import { dayKey } from './domain';
import { planSecretAnswer, type SecretAnswer } from './secrets-model';
import { scheduleReminders } from './reminders';
export async function refreshSecretSchedule() {
  const items = await privateItems(),
    today = dayKey(new Date(), db.state.settings.timezone),
    habits = items.filter((x) => x.type === 'habit' && !x.archived && x.start <= today);
  await db.configure({
    ...db.state.settings,
    privateReminder: habits.length > 0 && !!db.state.settings.privateReminder,
    privatePenaltyReminders: penaltySchedules(items, db.state.records),
    privateTime: db.state.settings.privateTime || '23:00',
    privateCheckinDoneDay:
      habits.length &&
      habits.every((h) =>
        items.some(
          (c) =>
            c.type === 'checkin' &&
            c.habitId === h.id &&
            c.day === today &&
            ['avoided', 'slipped'].includes(c.state),
        ),
      )
        ? today
        : '',
  });
  await scheduleReminders();
}
export async function answerSecret(habitId: string, day: string, state: SecretAnswer) {
  if (isNative) {
    await db.flush();
    const result = await Native.deen({
      op: 'secretCheckin',
      owner: db.state.owner || '',
      habitId,
      day,
      state,
    });
    await db.reloadNative();
    return result.changed as boolean;
  }
  const plan = planSecretAnswer(
    await privateItems(),
    db.state.records,
    habitId,
    day,
    state,
    dayKey(new Date(), db.state.settings.timezone),
    crypto.randomUUID(),
    db.state.settings.timezone,
  );
  for (const item of plan.privateItems) await putPrivate(item);
  for (const r of plan.publicRecords) await db.put(r.entity, r.id, r.data, !!r.deleted);
  await refreshSecretSchedule();
  return plan.changed;
}

export async function deleteSecret(habitId: string) {
  const items = await privateItems(),
    related = items.filter(
      (item) =>
        item.id === habitId ||
        (['checkin', 'recovery'].includes(item.type) && item.habitId === habitId),
    );
  for (const task of related.filter((item) => item.type === 'recovery' && item.routineId)) {
    const routine = db.find('routines', task.routineId),
      performed = db.state.records.some(
        (r) =>
          !r.deleted &&
          r.data.routineId === task.routineId &&
          (r.entity === 'routine_completions' ||
            (r.entity === 'tasbih_progress' && r.data.count > 0)),
      );
    if (routine && !routine.deleted && routine.data.secretPenalty && !performed)
      await db.put('routines', routine.id, routine.data, true);
  }
  for (const item of related.filter((item) => item.id !== habitId)) await putPrivate(item, true);
  const ids = new Set(related.map((item) => item.id));
  if (db.state.settings.privateActivityReminders?.some((item: any) => ids.has(item.id)))
    await db.configure({
      ...db.state.settings,
      privateActivityReminders: db.state.settings.privateActivityReminders.filter(
        (item: any) => !ids.has(item.id),
      ),
    });
  const habit = related.find((item) => item.id === habitId);
  if (habit) await putPrivate(habit, true);
  await refreshSecretSchedule();
}

export async function completeCharityPenalty(id: string) {
  if (isNative) {
    await db.flush();
    await Native.deen({ op: 'completeCharityPenalty', id, owner: db.state.owner || '' });
    await db.reloadNative();
  } else {
    const item = (await privateItems()).find(
      (t) => t.id === id && t.type === 'recovery' && t.kind === 'charity',
    );
    if (!item) throw Error('Charity penalty not found');
    if (item.state === 'pending')
      await putPrivate({ ...item, state: 'done', completedAt: new Date().toISOString() });
  }
  await refreshSecretSchedule();
}
