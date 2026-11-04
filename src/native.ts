import { Capacitor, registerPlugin } from '@capacitor/core';
export const isNative = Capacitor.isNativePlatform();
export interface Reminder {
  id: string;
  at: number;
  title: string;
  body: string;
  category: string;
  route: string;
  silent: boolean;
  vibration: boolean;
  windowStart?: string;
  windowEnd?: string;
  lang?: string;
}
interface NativeApi {
  addListener(
    event: 'narration',
    listener: (data: {
      state: string;
      storyId: string;
      language: string;
      sentence: number;
      total: number;
      message: string;
    }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  deen(options: Record<string, unknown>): Promise<any>;
  addListener(
    event: 'heading',
    listener: (data: { degrees: number; accuracy: number }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    event: 'storeChanged',
    listener: (data: { handledRoute?: string }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  load(): Promise<{ value: string }>;
  save(o: { value: string; base?: string }): Promise<{ value: string }>;
  sync(o: { force: boolean }): Promise<{ value: string }>;
  testReminder(o: { overlay: boolean; secrets?: boolean }): Promise<{
    scheduled: boolean;
    at: number;
    exact: boolean;
    notifications: boolean;
    channelEnabled: boolean;
    overlay: boolean;
    muted?: boolean;
  }>;
  pickSound(o: { category: string }): Promise<{ uri: string; name: string; cancelled?: boolean }>;
  vaultGet(): Promise<{ value: string }>;
  vaultSet(o: { value: string }): Promise<void>;
  schedule(o: { reminders: Reminder[]; replace?: boolean }): Promise<{ exact: boolean }>;
  permissions(): Promise<{
    notifications: boolean;
    exact: boolean;
    overlay: boolean;
    fullScreen?: boolean;
    batteryUnrestricted?: boolean;
  }>;
  requestNotifications(): Promise<void>;
  openSettings(o: { kind: string }): Promise<void>;
  locate(): Promise<{ lat: number; lng: number }>;
  storeFile(o: { name: string; base64: string; mime: string }): Promise<{ path: string }>;
  readFile(o: { path: string }): Promise<{ base64: string }>;
  removeFile(o: { path: string }): Promise<void>;
  viewFile(o: { path: string; page: number; routineId?: string }): Promise<void>;
  filePosition(o: { path: string }): Promise<{ page: number }>;
  storage(): Promise<{ bytes: number }>;
}
export const Native = registerPlugin<NativeApi>('SalahNative');
