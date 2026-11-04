import { db, api, apiURL, currentToken } from './store';
import { isNative, Native } from './native';
export interface LocalFile {
  id: string;
  name: string;
  mime: string;
  bytes: number;
  path?: string;
  base64?: string;
  cloudId?: string;
  page?: number;
  error?: string;
  attempts?: number;
  nextTry?: number;
  offset?: number;
  zoom?: number;
  profile?: boolean;
  routineId?: string;
}
const bytesTo64 = (buffer: ArrayBuffer) => {
  let s = '';
  for (const c of new Uint8Array(buffer)) s += String.fromCharCode(c);
  return btoa(s);
};
export function files(): LocalFile[] {
  return db.find('user_settings', 'files')?.data.items || [];
}
async function persist(items: LocalFile[]) {
  db.state.localFiles = items;
  await db.persist();
}
// Local bytes stay separate from synchronized metadata, under app-private storage.
export async function localFiles(): Promise<LocalFile[]> {
  return db.state.localFiles || [];
}
async function saveIndex(items: LocalFile[]) {
  await persist(items);
}
export async function importFile(file: File) {
  if (file.size > 8 * 1024 * 1024) throw Error('Maximum file size is 8 MiB');
  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw Error('Choose PDF, PNG, JPEG or WebP');
  const base64 = bytesTo64(await file.arrayBuffer());
  const f: LocalFile = {
    id: crypto.randomUUID(),
    name: file.name,
    mime: file.type,
    bytes: file.size,
  };
  if (isNative)
    f.path = (await Native.storeFile({ name: file.name, mime: file.type, base64 })).path;
  else f.base64 = base64;
  const all = await localFiles();
  all.push(f);
  await saveIndex(all);
  return f;
}
export async function fileBlob(f: LocalFile) {
  const b = f.base64 || (await Native.readFile({ path: f.path! })).base64;
  return new Blob([Uint8Array.from(atob(b), (c) => c.charCodeAt(0))], { type: f.mime });
}
export async function uploadFile(f: LocalFile, profile = false) {
  if (profile) {
    f.profile = true;
    await db.persist();
  }
  const form = new FormData();
  form.append('file', await fileBlob(f), f.name);
  if (profile) form.append('profile', '1');
  form.append('id', f.id);
  const remote = await api('files', form);
  f.cloudId = remote.id;
  const all = await localFiles();
  await saveIndex(all.map((x) => (x.id === f.id ? f : x)));
  for (const r of db.list('routines'))
    if (r.data.fileId === f.id && r.data.fileCloudId !== f.cloudId)
      await db.put('routines', r.id, { ...r.data, fileCloudId: f.cloudId });
  return remote;
}
export async function saveReadingPosition(id: string, offset: number, zoom: number) {
  const file = db.state.localFiles?.find((f) => f.id === id);
  if (file) {
    file.offset = offset;
    file.zoom = zoom;
    await db.persist();
  }
}
export async function restoreFiles() {
  const remote = (await api('files')) as any[];
  const all = await localFiles();
  for (const f of remote) {
    if (db.state.pendingFileDeletes?.includes(f.id)) continue;
    if (all.some((x) => x.cloudId === f.id)) continue;
    const res = await fetch(apiURL('files/' + f.id), {
      headers: { Authorization: `Bearer ${currentToken()}` },
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw Error('File download failed');
    const base64 = bytesTo64(await res.arrayBuffer());
    const item: LocalFile = { ...f, id: crypto.randomUUID(), cloudId: f.id };
    if (isNative) item.path = (await Native.storeFile({ name: f.name, mime: f.mime, base64 })).path;
    else item.base64 = base64;
    all.push(item);
    await saveIndex(all);
  }
}
export async function deleteFile(f: LocalFile) {
  if (f.cloudId || db.state.owner)
    db.state.pendingFileDeletes = [
      ...new Set([...(db.state.pendingFileDeletes || []), f.cloudId || f.id]),
    ];
  await saveIndex((await localFiles()).filter((x) => x.id !== f.id));
  if (f.path) await Native.removeFile({ path: f.path });
}

// Routine attachments are owned; legacy/shared documents remain until their final link is removed.
export async function linkRoutineFile(file: LocalFile, routineId: string) {
  const shared = db
    .list('routines')
    .some(
      (r) =>
        r.id !== routineId &&
        (r.data.fileId === file.id || (file.cloudId && r.data.fileCloudId === file.cloudId)),
    );
  if (shared || file.profile || (file.routineId && file.routineId !== routineId))
    file = await importFile(new File([await fileBlob(file)], file.name, { type: file.mime }));
  file.routineId = routineId;
  await saveIndex((await localFiles()).map((f) => (f.id === file.id ? file : f)));
  return file;
}
export async function deleteRoutineAttachment(routine: { id: string; data: Record<string, any> }) {
  const file = (await localFiles()).find(
    (f) => f.id === routine.data.fileId || (f.cloudId && f.cloudId === routine.data.fileCloudId),
  );
  const shared = db
    .list('routines')
    .some(
      (r) =>
        r.id !== routine.id &&
        ((file && r.data.fileId === file.id) ||
          (routine.data.fileCloudId && r.data.fileCloudId === routine.data.fileCloudId)),
    );
  if (shared || file?.profile) return;
  if (file) await deleteFile(file);
  else if (routine.data.fileCloudId) {
    db.state.pendingFileDeletes = [
      ...new Set([...(db.state.pendingFileDeletes || []), routine.data.fileCloudId]),
    ];
    await db.persist();
  }
}
