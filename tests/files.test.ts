import { beforeEach, it, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({
  localFiles: [] as any[],
  pendingFileDeletes: [] as string[],
  owner: 'account',
}));
const records = vi.hoisted(() => [] as any[]);
const persist = vi.hoisted(() => vi.fn());
vi.mock('../src/store', () => ({
  db: { state, list: () => records, persist, find: () => undefined },
  api: vi.fn(),
  apiURL: vi.fn(),
  currentToken: vi.fn(),
}));
vi.mock('../src/native', () => ({ isNative: false, Native: { removeFile: vi.fn() } }));
import { deleteRoutineAttachment, linkRoutineFile } from '../src/files';
beforeEach(() => {
  state.localFiles = [];
  state.pendingFileDeletes = [];
  records.length = 0;
  persist.mockClear();
});
it('removes an owned file and queues its cloud deletion', async () => {
  state.localFiles = [{ id: 'f', cloudId: 'cloud', routineId: 'r' }];
  await deleteRoutineAttachment({ id: 'r', data: { fileId: 'f', fileCloudId: 'cloud' } });
  expect(state.localFiles).toEqual([]);
  expect(state.pendingFileDeletes).toEqual(['cloud']);
});
it('retains a shared legacy file until its final routine is deleted', async () => {
  state.localFiles = [{ id: 'f', cloudId: 'cloud' }];
  records.push({ id: 'other', data: { fileCloudId: 'cloud' } });
  await deleteRoutineAttachment({ id: 'r', data: { fileId: 'f', fileCloudId: 'cloud' } });
  expect(state.localFiles).toHaveLength(1);
  expect(state.pendingFileDeletes).toEqual([]);
  records.length = 0;
  await deleteRoutineAttachment({ id: 'other', data: { fileCloudId: 'cloud' } });
  expect(state.localFiles).toEqual([]);
});
it('retains profile images and queues absent cloud attachments exactly once', async () => {
  state.localFiles = [{ id: 'profile', profile: true }];
  await deleteRoutineAttachment({ id: 'r', data: { fileId: 'profile' } });
  expect(state.localFiles).toHaveLength(1);
  for (let n = 0; n < 2; n++)
    await deleteRoutineAttachment({ id: 'missing', data: { fileCloudId: 'remote' } });
  expect(state.pendingFileDeletes).toEqual(['remote']);
});
it('clones a shared attachment to give each routine independent ownership', async () => {
  const f = {
    id: 'f',
    name: 'reading.png',
    mime: 'image/png',
    bytes: 1,
    base64: 'YQ==',
    cloudId: 'remote',
  };
  state.localFiles = [f];
  records.push({ id: 'other', data: { fileId: 'f' } });
  const linked = await linkRoutineFile(f, 'new');
  expect(linked.id).not.toBe('f');
  expect(linked.routineId).toBe('new');
  expect(linked.cloudId).toBeUndefined();
  expect(state.localFiles).toHaveLength(2);
});
