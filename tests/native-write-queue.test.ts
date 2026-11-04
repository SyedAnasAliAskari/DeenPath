import { it, expect, vi } from 'vitest';
const bridge = vi.hoisted(() => ({ save: vi.fn(), load: vi.fn() }));
vi.mock('../src/native', () => ({ isNative: true, Native: bridge }));
import { LocalStore } from '../src/store';
import { mergeState } from '../src/merge';
it('rapid native taps retain one latest outbox mutation and use each acknowledged base', async () => {
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  const store = new LocalStore();
  store.state.settings.trackingStart = '2026-11-01';
  store.state.economy = { version: 1, balance: 0, claims: {}, transactions: {} };
  let native = structuredClone(store.state);
  const acknowledgments: string[] = [];
  const bases: string[] = [];
  bridge.load.mockImplementation(async () => ({ value: JSON.stringify(native) }));
  bridge.save.mockImplementation(async ({ value, base }) => {
    bases.push(base);
    await new Promise((resolve) => setTimeout(resolve, 2));
    native = mergeState(base ? JSON.parse(base) : {}, JSON.parse(value), native);
    const result = JSON.stringify(native);
    acknowledgments.push(result);
    return { value: result };
  });
  await store.init();
  bases.length = 0;
  acknowledgments.length = 0;
  await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      store.put('tasbih_progress', 'r:today', {
        routineId: 'r',
        period: 'today',
        count: index + 1,
      }),
    ),
  );
  expect(native.records.find((row) => row.entity === 'tasbih_progress')?.data.count).toBe(20);
  expect(native.queue).toHaveLength(1);
  expect(native.queue[0].record.data.count).toBe(20);
  expect(store.state.queue).toHaveLength(1);
  for (let index = 1; index < bases.length; index++)
    expect(bases[index]).toBe(acknowledgments[index - 1]);
  vi.unstubAllGlobals();
});
