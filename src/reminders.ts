import { Native, isNative } from './native';
let lastWarning = 0;
// The same native planner is used on edits, launch, reboot and WorkManager renewal.
export async function scheduleReminders() {
  if (!isNative) return;
  try {
    await Native.deen({ op: 'rebuildReminders' });
  } catch (e) {
    if (Date.now() - lastWarning > 30000) {
      lastWarning = Date.now();
      window.dispatchEvent(
        new CustomEvent('salahguard:reminder-warning', { detail: (e as Error).message }),
      );
    }
  }
}
