import { compactPreferenceQueue } from './preferences-outbox';
import { browserStory } from './card-texts';
import { earnedForSources, completionFeedback } from './completion-feedback';
import { replayPendingOrder } from './purchases';
import { mergeCollection } from './collectibles';
import { reconcileEconomy, type Economy } from './economy';
import { prayerMutation, type PrayerAction } from './prayer-actions';
import { Native, isNative } from './native';
import {
  defaults,
  backoff,
  dayKey,
  prayers,
  type Settings,
  type RecordData,
  type Operation,
  type Entity,
} from './domain';
import { replayProgress, type Progress } from './progress';
import { mergeState } from './merge';
export interface Snapshot {
  collectibles?: import('./collectibles').Collectibles;
  legacyFreeze?: Progress;
  economy?: Economy;
  schema: number;
  owner: string | null;
  profile: Record<string, any> | null;
  records: RecordData[];
  queue: Operation[];
  cursor: number;
  lastSync: string | null;
  settings: Settings;
  cloud: any;
  localFiles?: import('./files').LocalFile[];
  progress?: Progress;
  pendingFileDeletes?: string[];
  prayerCache?: unknown[];
}
const blank = (): Snapshot => ({
  schema: 1,
  owner: null,
  profile: null,
  records: [],
  queue: [],
  cursor: 0,
  lastSync: null,
  settings: { ...defaults, adjustments: [...defaults.adjustments] },
  cloud: null,
});
export class LocalStore {
  state = blank();
  private writing = Promise.resolve();
  private nativeBase = '';
  async init() {
    const raw = isNative ? (await Native.load()).value : localStorage.getItem('salahguard');
    this.nativeBase = raw || '';
    if (raw) {
      const data = JSON.parse(raw);
      if (data.schema !== 1) throw Error('Unsupported local database version');
      this.state = { ...blank(), ...data, settings: { ...defaults, ...data.settings } };
      if (!data.settings.appearance && data.settings.dark) this.state.settings.appearance = 'dark';
    } else {
      const lang = navigator.language.slice(0, 2);
      if (lang === 'ar' || lang === 'ur') this.state.settings.lang = lang;
    }
    const compacted = compactPreferenceQueue(this.state.queue, this.state.records);
    const repairedPreferences = compacted.length !== this.state.queue.length;
    this.state.queue = compacted;
    const applyDeployment = !this.state.settings.api && !!defaults.api;
    if (applyDeployment) this.state.settings.api = defaults.api;
    if (!this.state.settings.trackingStart) {
      this.state.settings.trackingStart =
        this.list('prayer_records')
          .map((r) => r.data.day)
          .filter(Boolean)
          .sort()[0] || dayKey(new Date(), this.state.settings.timezone);
      await this.persist();
    } else if (applyDeployment) await this.persist();
    if (!this.state.economy || repairedPreferences) await this.persist();
  }
  async persist() {
    if (
      !this.state.legacyFreeze &&
      ((this.state.progress?.wallet || 0) > 0 || this.state.progress?.ledger.length)
    )
      this.state.legacyFreeze = structuredClone(this.state.progress);
    this.state.progress = replayProgress(this.state.records);
    if (!isNative) this.state.economy = reconcileEconomy(this.state.records, this.state.economy);
    if (!isNative && typeof indexedDB !== 'undefined')
      for (const card of Object.values(this.state.collectibles?.library || {})) {
        if (card.verification === 'verified' && card.english && card.urdu) {
          await browserStory(card.id, card);
          delete card.english;
          delete card.urdu;
        }
      }
    const raw = isNative ? '' : JSON.stringify(this.state);
    const write = this.writing
      .catch(() => {})
      .then(async () => {
        if (isNative) {
          // Capture the latest foreground edits AFTER the previous native acknowledgment.
          // Rapid taps must not resurrect superseded outbox operations or old record versions.
          const value = JSON.stringify(this.state),
            base = this.nativeBase;
          const result = await Native.save({ value, base });
          this.nativeBase = result.value;
          this.state = mergeState(JSON.parse(value), this.state, JSON.parse(result.value));
          window.dispatchEvent(new Event('salahguard:store'));
        } else localStorage.setItem('salahguard', raw);
      });
    this.writing = write;
    await write;
  }
  async flush() {
    await this.writing;
  }
  async reloadNative() {
    if (!isNative) return;
    await this.writing;
    const base = structuredClone(this.state);
    const raw = (await Native.load()).value;
    if (raw) {
      this.nativeBase = raw;
      this.state = mergeState(base, this.state, JSON.parse(raw));
      this.state.progress = replayProgress(this.state.records);
    }
  }
  list(entity: Entity) {
    return this.state.records.filter((r) => r.entity === entity && !r.deleted);
  }
  find(entity: Entity, id: string) {
    return this.state.records.find((r) => r.entity === entity && r.id === id);
  }
  async put(
    entity: Entity,
    id: string,
    data: Record<string, any>,
    deleted = false,
    persist = true,
  ) {
    const before = structuredClone(this.state.economy);
    const old = this.find(entity, id);
    const r: RecordData = { id, entity, data, version: old?.version || 0, deleted };
    const i = this.state.records.findIndex((x) => x.entity === entity && x.id === id);
    if (i < 0) this.state.records.push(r);
    else this.state.records[i] = r;
    // Coalesce unsent mutations, preserving the last acknowledged version.
    const q = this.state.queue.findIndex(
      (o) => o.record.entity === entity && o.record.id === id && o.attempts === 0,
    );
    const op = { id: crypto.randomUUID(), record: structuredClone(r), attempts: 0, nextTry: 0 };
    if (q >= 0) this.state.queue[q] = op;
    else this.state.queue.push(op);
    if (persist) {
      await this.persist();
      const prefix =
        entity === 'prayer_records'
          ? 'prayer:' + id
          : entity === 'routine_completions'
            ? 'routine:' + id
            : entity === 'qaza_history'
              ? 'historical:' + id
              : '';
      const routine =
        entity === 'routine_completions' ? this.find('routines', data.routineId) : null;
      const label =
        entity === 'prayer_records'
          ? this.state.economy?.claims[prefix]?.kind === 'qaza'
            ? 'Qaza'
            : String(data.prayer || 'Prayer')
          : entity === 'qaza_history'
            ? 'Qaza'
            : { tasbih: 'Tasbih', dua: 'Dua', quran: 'Quran', nafl: 'Nafl' }[
                routine?.data.kind as string
              ] || 'Routine';
      completionFeedback(label, earnedForSources(before, this.state.economy, prefix));
    }
  }
  async applyPrayer(action: PrayerAction, key: string, now = new Date()) {
    if (action === 'snooze' || action === 'close') return false;
    const before = structuredClone(this.state.economy);
    const receipt = () =>
      completionFeedback(
        action === 'qaza' ? 'Qaza' : key.split(':')[1],
        earnedForSources(before, this.state.economy, 'prayer:' + key),
      );
    if (isNative) {
      await this.writing;
      const result = await Native.deen({
        op: 'recordPrayer',
        key,
        action,
        owner: this.state.owner,
      });
      await this.reloadNative();
      window.dispatchEvent(new Event('salahguard:store'));
      if (result.changed === true) receipt();
      return result.changed === true;
    }
    const prayerWindow = prayers(key.split(':')[0], this.state.settings).find((w) => w.key === key);
    if (!prayerWindow) throw Error('Select a prayer');
    const data = prayerMutation(action, prayerWindow, this.find('prayer_records', key), now);
    if (!data) return false;
    await this.put(
      'prayer_records',
      key,
      { ...data, timezone: data.timezone || this.state.settings.timezone },
      false,
      false,
    );
    if (action === 'qaza')
      await this.put(
        'qaza_records',
        key,
        { day: data.day, prayer: data.prayer, qazaAt: data.qazaAt },
        false,
        false,
      );
    await this.persist();
    receipt();
    return true;
  }
  async configure(s: Settings) {
    this.state.settings = s;
    this.state.prayerCache = Array.from({ length: 30 }, (_, i) =>
      prayers(dayKey(new Date(Date.now() + i * 86400000), s.timezone), s),
    );
    const {
      api: _,
      soundUris: __,
      soundNames: ___,
      privateActivityReminders: ____,
      privateCheckinDoneDay: _____,
      privatePenaltyReminders: ______,
      ...portable
    } = s;
    await this.put('user_settings', 'preferences', portable);
  }
}
export const db = new LocalStore();
let token = '';
export function currentToken() {
  return token;
}
export async function loadToken() {
  token = isNative ? (await Native.vaultGet()).value : '';
  return token;
}
export async function saveToken(t: string) {
  token = t;
  if (isNative) await Native.vaultSet({ value: t });
}
export function apiURL(route: string) {
  return `${db.state.settings.api}?route=${encodeURIComponent('/v1/' + route)}`;
}
export async function api(
  route: string,
  body?: unknown,
  method = body ? 'POST' : 'GET',
): Promise<any> {
  if (isNative) token = (await Native.vaultGet()).value;
  if (!db.state.settings.api)
    throw Error('Online account services are not configured for this build.');
  const response = await fetch(apiURL(route), {
    method,
    headers: {
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const json = await response.json().catch(() => {
    throw Error('The account server is unavailable. Please try again later.');
  });
  if (!response.ok)
    throw Object.assign(Error(json.error || `HTTP ${response.status}`), {
      status: response.status,
    });
  return json;
}
let syncing = false;
export async function sync(force = false) {
  if (syncing) return;
  if (!token) throw Error('Sign in to synchronize');
  syncing = true;
  try {
    if (isNative) {
      await db.persist();
      try {
        await Native.sync({ force });
      } finally {
        await db.reloadNative();
        await loadToken();
      }
      if ((db.state as any).nativeSyncPending)
        throw Error('Some changes need attention in Sync Center');
      return;
    }
    // Refresh rotates credentials; a brief server grace permits retry after an interrupted response.
    const session = await api('auth/refresh', {});
    await saveToken(session.token);
    for (const id of [...(db.state.pendingFileDeletes || [])]) {
      try {
        await api('files/' + id, undefined, 'DELETE');
      } catch (e) {
        if (!(e as Error).message.includes('File not found')) throw e;
      }
      db.state.pendingFileDeletes = (db.state.pendingFileDeletes || []).filter((x) => x !== id);
      await db.persist();
    }
    // File bytes are never put in JSON sync records. Retry unfinished imports on the next sync.
    const fileService = await import('./files');
    for (const file of await fileService.localFiles())
      if (!file.cloudId && (force || !file.nextTry || file.nextTry <= Date.now())) {
        try {
          await fileService.uploadFile(file);
          delete file.error;
          delete file.nextTry;
        } catch (e) {
          file.error = (e as Error).message;
          file.attempts = (file.attempts || 0) + 1;
          file.nextTry = Date.now() + backoff(file.attempts);
        }
        await db.persist();
      }
    for (const op of [...db.state.queue]) {
      if (op.nextTry > Date.now() && !force) continue;
      try {
        const result = await api('sync/push', {
          operations: [{ operationId: op.id, record: op.record }],
        });
        const ack = result.results[0];
        if (ack.conflict) {
          op.error = 'Conflict: review local and cloud values in Sync Center';
          op.attempts++;
          op.nextTry = Number.MAX_SAFE_INTEGER;
          op.record.data._cloud = ack.record;
          continue;
        }
        const local = db.find(op.record.entity, op.record.id);
        if (local) local.version = ack.version;
        db.state.queue = db.state.queue.filter((o) => o.id !== op.id);
        for (const queued of db.state.queue)
          if (queued.record.entity === op.record.entity && queued.record.id === op.record.id)
            queued.record.version = ack.version;
      } catch (e) {
        op.attempts++;
        op.nextTry = Date.now() + backoff(op.attempts);
        op.error = (e as Error).message;
        await db.persist();
        throw e;
      }
      await db.persist();
    }
    let more = true;
    while (more) {
      const result = await api('sync/pull/' + db.state.cursor);
      for (const r of result.records as RecordData[]) {
        if (db.state.queue.some((o) => o.record.entity === r.entity && o.record.id === r.id))
          continue;
        const i = db.state.records.findIndex((x) => x.entity === r.entity && x.id === r.id);
        if (i < 0) db.state.records.push(r);
        else db.state.records[i] = r;
      }
      db.state.cursor = result.cursor;
      more = result.more;
      await db.persist();
    }
    const prefs = db.find('user_settings', 'preferences');
    if (
      prefs &&
      !prefs.deleted &&
      !db.state.queue.some(
        (o) => o.record.entity === 'user_settings' && o.record.id === 'preferences',
      )
    ) {
      const settings = db.state.settings;
      const portable = { ...prefs.data };
      for (const key of [
        'api',
        'soundUris',
        'soundNames',
        'privateActivityReminders',
        'privateCheckinDoneDay',
        'privatePenaltyReminders',
      ])
        delete portable[key];
      db.state.settings = { ...defaults, ...settings, ...portable };
    }
    db.state.cloud = await api('sync/status');
    db.state.profile = await api('profile');
    await syncGemEconomy();
    db.state.lastSync = new Date().toISOString();
    await db.persist();
  } finally {
    syncing = false;
  }
}
export async function signIn(email: string, password: string, name?: string) {
  const r = await api(name ? 'auth/register' : 'auth/login', { email, password, name });
  if (db.state.owner && db.state.owner !== r.user.id)
    throw Error(
      'This installation contains another account. Export pending data and clear it before switching accounts.',
    );
  db.state.owner = r.user.id;
  db.state.profile = r.user;
  await saveToken(r.token);
  await db.persist();
}

async function syncGemEconomy() {
  try {
    // Source records must arrive before spending their offline rewards.
    if (!db.state.queue.length)
      for (const order of Object.values(db.state.economy?.orders || {})
        .filter((o) => o.status === 'pending')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
        const payload = { ...order.payload };
        if (payload.fileId) {
          const file = db.state.localFiles?.find(
            (f) => f.id === payload.fileId || f.cloudId === payload.fileId,
          );
          if (!file?.cloudId) continue;
          payload.fileId = file.cloudId;
        }
        try {
          if (order.kind === 'pack')
            await api('cards/import-pack', { id: order.id, ...payload, expectedCost: order.cost });
          else
            await api('economy/purchase', {
              id: order.id,
              kind: order.kind,
              payload,
              expectedCost: order.cost,
            });
        } catch (e) {
          if ((e as any).status !== 422) throw e;
          order.status = 'rejected';
          order.error = (e as Error).message;
        }
      }
    const canonical: Economy = await api('economy/reconcile', {}),
      orders = Object.values(db.state.economy?.orders || {});
    let next = reconcileEconomy(db.state.records, canonical);
    for (const order of orders) {
      if (next.orders?.[order.id]) continue;
      if (order.status === 'pending') {
        try {
          next = replayPendingOrder(next, order);
        } catch (e) {
          next.orders = {
            ...next.orders,
            [order.id]: { ...order, status: 'rejected', error: (e as Error).message },
          };
        }
      } else next.orders = { ...next.orders, [order.id]: order };
    }
    db.state.economy = next;
    const collection = await api('cards/collection');
    db.state.collectibles = mergeCollection(db.state.collectibles, collection);
    const reveals = Object.values(db.state.collectibles.copies)
      .filter((c) => c.revealed && !c.revealSynced && !c.pendingSync)
      .slice(0, 100);
    if (reveals.length) {
      await api('cards/reveal', { copyIds: reveals.map((c) => c.id) });
      for (const copy of reveals) copy.revealSynced = true;
    }
    (db.state as any).economySyncError = '';
  } catch (e) {
    (db.state as any).economySyncError = (e as Error).message;
  }
}
