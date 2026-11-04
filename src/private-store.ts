import { Native, isNative } from './native';
import { db } from './store';
export interface PrivateItem {
  id: string;
  type: 'habit' | 'checkin' | 'recovery' | 'journal' | 'chat';
  [key: string]: any;
}
// Browser preview is ephemeral; no persistent plaintext private records or API keys.
let preview: PrivateItem[] = [];
export async function privateItems(): Promise<PrivateItem[]> {
  if (!isNative) return preview;
  const items: PrivateItem[] = [];
  for (const record of db.list('private_records')) {
    const decoded = await Native.deen({ op: 'open', value: record.data.sealed });
    items.push({ ...JSON.parse(decoded.value), id: record.id });
  }
  return items;
}
export async function putPrivate(item: PrivateItem, deleted = false) {
  if (!isNative) {
    preview = preview.filter((x) => x.id !== item.id);
    if (!deleted) preview.push(item);
    return;
  }
  const sealed = await Native.deen({ op: 'seal', value: JSON.stringify(item) });
  await db.put(
    'private_records',
    item.id,
    { sealed: sealed.value, format: 'aes-gcm-device-v1' },
    deleted,
  );
}
export async function privacyStatus() {
  return isNative ? Native.deen({ op: 'privacyStatus' }) : { enabled: false, unlocked: true };
}
export async function lockPrivate() {
  if (isNative) await Native.deen({ op: 'lock' });
}
