import { it, expect, vi } from 'vitest';
import { askProviders } from '../src/guidance-model';
it('uses personal paid API before Gemini and makes no duplicate paid retry', async () => {
  const call = vi.fn().mockResolvedValue({ ok: true, status: 200, text: 'answer' });
  expect((await askProviders([], { paid: true, gemini: true }, true, call)).provider).toBe('paid');
  expect(call).toHaveBeenCalledTimes(1);
});
it('falls back on quota exhaustion and records provider disclosure', async () => {
  const call = vi
    .fn()
    .mockResolvedValueOnce({ ok: false, status: 429 })
    .mockResolvedValueOnce({ ok: true, status: 200, text: 'answer' });
  const result = await askProviders([], { paid: true, gemini: true }, true, call);
  expect(result.provider).toBe('gemini');
  expect(result.failures).toEqual([{ provider: 'paid', status: 429 }]);
  expect(call).toHaveBeenCalledTimes(2);
});
it('honors disabled fallback even on auth failure', async () => {
  const call = vi.fn().mockResolvedValue({ ok: false, status: 401 });
  expect((await askProviders([], { paid: true, gemini: true }, false, call)).provider).toBe(
    'offline',
  );
  expect(call).toHaveBeenCalledTimes(1);
});
it('handles connection failures and all providers unavailable without infinite retries', async () => {
  const call = vi.fn().mockRejectedValue(new Error('network'));
  expect((await askProviders([], { paid: true, gemini: true }, true, call)).provider).toBe(
    'offline',
  );
  expect(call).toHaveBeenCalledTimes(2);
});
it('offers offline resources without a key and never contacts an invented Rasikh endpoint', async () => {
  const call = vi.fn();
  expect((await askProviders([], { paid: false, gemini: false }, true, call)).provider).toBe(
    'offline',
  );
  expect(call).not.toHaveBeenCalled();
});
