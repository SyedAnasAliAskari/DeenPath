import type { Operation, RecordData } from './domain';
const stable = (value: any): any =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, stable(value[key])]),
        )
      : value;
/** Repair only duplicate never-attempted preferences with an exact canonical entry. */
export function compactPreferenceQueue(queue: Operation[], records: RecordData[]): Operation[] {
  const groups = new Map<string, Operation[]>(),
    removed = new Set<string>();
  for (const op of queue)
    if (op.record.entity === 'user_settings')
      groups.set(op.record.id, [...(groups.get(op.record.id) || []), op]);
  for (const [id, items] of groups) {
    if (
      items.length < 2 ||
      items.some((op) => op.attempts !== 0 || op.error || op.record.data._cloud)
    )
      continue;
    const record = records.find((row) => row.entity === 'user_settings' && row.id === id);
    if (!record) continue;
    const canonical = JSON.stringify(stable(record)),
      keep = [...items].reverse().find((op) => JSON.stringify(stable(op.record)) === canonical);
    if (!keep) continue;
    for (const op of items) if (op.id !== keep.id) removed.add(op.id);
  }
  return queue.filter((op) => !removed.has(op.id));
}
