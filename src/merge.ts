const keyFor = (path: string, item: any) =>
  path === 'records' ? `${item.entity}:${item.id}` : item.id;
const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
/** Three-way merge preserves foreground edits while native WorkManager acknowledges other work. */
export function mergeState(base: any, incoming: any, current: any, path = ''): any {
  if (same(incoming, base)) return current;
  if (same(current, base) || same(current, incoming)) return incoming;
  if (
    ['records', 'queue', 'localFiles'].includes(path) &&
    Array.isArray(incoming) &&
    Array.isArray(current)
  ) {
    const map = (list: any[]) => new Map((list || []).map((item) => [keyFor(path, item), item]));
    const b = map(base),
      i = map(incoming),
      c = map(current);
    return [...new Set([...b.keys(), ...c.keys(), ...i.keys()])].flatMap((key) => {
      const value = mergeState(b.get(key), i.get(key), c.get(key), 'item');
      return value === undefined ? [] : [value];
    });
  }
  if (
    incoming &&
    current &&
    typeof incoming === 'object' &&
    typeof current === 'object' &&
    !Array.isArray(incoming) &&
    !Array.isArray(current)
  ) {
    const result: Record<string, any> = {};
    for (const key of new Set([
      ...Object.keys(base || {}),
      ...Object.keys(current),
      ...Object.keys(incoming),
    ])) {
      const value = mergeState(base?.[key], incoming[key], current[key], key);
      if (value !== undefined) result[key] = value;
    }
    return result;
  }
  return incoming;
}
