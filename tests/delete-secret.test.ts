import { beforeEach, it, expect, vi } from 'vitest';
const data = vi.hoisted(() => ({
  items: [] as any[],
  records: [] as any[],
  settings: { timezone: 'Asia/Karachi', privateReminder: true },
}));
vi.mock('../src/store', () => ({
  db: {
    get state() {
      return data;
    },
    find: (e: string, id: string) => data.records.find((r) => r.entity === e && r.id === id),
    configure: async (s: any) => {
      data.settings = s;
    },
    put: async (e: string, id: string, d: any, deleted: boolean) => {
      const r = data.records.find((r) => r.entity === e && r.id === id);
      Object.assign(r, { data: d, deleted });
    },
  },
}));
vi.mock('../src/private-store', () => ({
  privateItems: async () => data.items,
  putPrivate: async (i: any, deleted: boolean) => {
    data.items = data.items.filter((x) => x.id !== i.id);
    if (!deleted) data.items.push(i);
  },
}));
vi.mock('../src/native', () => ({ isNative: false, Native: {} }));
import { deleteSecret } from '../src/secrets-store';
beforeEach(() => {
  data.items = [
    { id: 'h', type: 'habit', start: '2026-01-01' },
    { id: 'c', type: 'checkin', habitId: 'h' },
    { id: 'r', type: 'recovery', habitId: 'h', routineId: 'n' },
    { id: 'other', type: 'habit', start: '2026-01-01' },
  ];
  data.records = [{ id: 'n', entity: 'routines', data: { secretPenalty: true, kind: 'nafl' } }];
});
it('deletes the secret and its private history and cancels an untouched penalty', async () => {
  await deleteSecret('h');
  expect(data.items.map((i) => i.id)).toEqual(['other']);
  expect(data.records[0].deleted).toBe(true);
});
it('keeps completed or partially performed worship when deleting a secret', async () => {
  data.records.push({
    id: 'progress',
    entity: 'tasbih_progress',
    data: { routineId: 'n', count: 1 },
  });
  await deleteSecret('h');
  expect(data.items.map((i) => i.id)).toEqual(['other']);
  expect(data.records[0].deleted).not.toBe(true);
});
