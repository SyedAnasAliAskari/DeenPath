import { it, expect, vi } from 'vitest';
vi.mock('../src/native', () => ({
  isNative: true,
  Native: { deen: vi.fn().mockRejectedValue(new Error('AlarmManager unavailable')) },
}));
import { db } from '../src/store';
import { scheduleReminders } from '../src/reminders';
it('does not fail a successful local action when reminder rescheduling fails', async () => {
  const dispatchEvent = vi.fn();
  vi.stubGlobal('window', { dispatchEvent });
  db.state.settings.enforcer = true;
  await expect(scheduleReminders()).resolves.toBeUndefined();
  expect(dispatchEvent).toHaveBeenCalledTimes(1);
});
