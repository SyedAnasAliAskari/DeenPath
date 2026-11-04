import { it, expect } from 'vitest';
import { compactPreferenceQueue } from '../src/preferences-outbox';
import type { Operation, RecordData } from '../src/domain';
const current: RecordData = {
  entity: 'user_settings',
  id: 'preferences',
  version: 0,
  deleted: false,
  data: { appearance: 'dark', reminderRepeat: { gentle: 15, warning: 10, strict: 1 } },
};
const op = (id: string, record: RecordData, attempts = 0): Operation => ({
  id,
  record,
  attempts,
  nextTry: 0,
});
it('keeps the exact current preference operation and leaves worship operations untouched', () => {
  const old = { ...current, data: { appearance: 'light' } },
    worship: RecordData = {
      entity: 'tasbih_progress',
      id: 'counter:today',
      version: 0,
      deleted: false,
      data: { count: 20 },
    };
  const queue = [op('current', current), op('old', old), op('w1', worship), op('w2', worship)];
  expect(compactPreferenceQueue(queue, [current, worship]).map((item) => item.id)).toEqual([
    'current',
    'w1',
    'w2',
  ]);
  expect(queue).toHaveLength(4);
});
it('preserves attempted, conflicted and nonmatching preference backlogs', () => {
  const old = { ...current, data: { appearance: 'light' } };
  for (const queue of [
    [op('a', current), op('b', old, 1)],
    [op('a', current), { ...op('b', old), error: 'Conflict' }],
    [op('a', old), op('b', old)],
  ])
    expect(compactPreferenceQueue(queue, [current])).toEqual(queue);
});
