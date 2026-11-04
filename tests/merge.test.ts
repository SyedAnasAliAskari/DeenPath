import { it, expect } from 'vitest';
import { mergeState } from '../src/merge';
it('keeps a new local counter edit while background sync acknowledges the previous operation', () => {
  const record = (count: number, version: number) => ({
    entity: 'tasbih_progress',
    id: 'counter:today',
    data: { count },
    version,
  });
  const base = { records: [record(1, 0)], queue: [{ id: 'a', record: record(1, 0) }] };
  const incoming = { records: [record(2, 0)], queue: [{ id: 'b', record: record(2, 0) }] };
  const cloud = { records: [record(1, 1)], queue: [] };
  const merged = mergeState(base, incoming, cloud);
  expect(merged.records[0].data.count).toBe(2);
  expect(merged.records[0].version).toBe(1);
  expect(merged.queue.map((o: any) => o.id)).toEqual(['b']);
  expect(merged.queue[0].record.version).toBe(0);
});
it('does not restore an acknowledged operation when the foreground changed only appearance', () => {
  const base = { records: [], queue: [{ id: 'a' }], settings: { appearance: 'light' } };
  expect(
    mergeState(
      base,
      { ...base, settings: { appearance: 'dark' } },
      { records: [], queue: [], settings: { appearance: 'light' }, lastSync: 'confirmed' },
    ),
  ).toEqual({ records: [], queue: [], settings: { appearance: 'dark' }, lastSync: 'confirmed' });
});
it('preserves cloud tombstones and newly added records that were untouched locally', () => {
  const base = { records: [{ entity: 'routines', id: 'a', version: 1, data: { title: 'old' } }] };
  const cloud = {
    records: [
      { entity: 'routines', id: 'a', version: 2, data: { title: 'old' }, deleted: true },
      { entity: 'routines', id: 'b', version: 1, data: { title: 'new' } },
    ],
  };
  expect(mergeState(base, base, cloud)).toEqual(cloud);
});
