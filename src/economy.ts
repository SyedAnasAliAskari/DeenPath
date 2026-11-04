import config from './content/economy.json';
import type { RecordData } from './domain';
export { config as economyConfig };
export type RewardKind = keyof typeof config.rewards;
export interface GemClaim {
  kind: RewardKind;
  amount: number;
  active: boolean;
  revision: number;
  rates: Partial<Record<RewardKind, number>>;
}
export interface GemTransaction {
  id: string;
  source: string;
  kind: string;
  delta: number;
  at: string;
  balanceAfter: number;
}
export interface Economy {
  rewardValues?: typeof config.rewards;
  prices?: Partial<Record<string, number>>;
  rarities?: typeof config.rarities;
  studioUnlocked?: boolean;
  theme?: import('./themes').CustomTheme;
  orders?: Record<string, import('./themes').ThemeOrder>;
  version: 1;
  balance: number;
  claims: Record<string, GemClaim>;
  transactions: Record<string, GemTransaction>;
}
export const emptyEconomy = (): Economy => ({
  version: 1,
  balance: 0,
  claims: {},
  transactions: {},
});
/** Rewards are projected from completion records; submitted balance fields are never claims. */
export function rewardSources(records: RecordData[], now = Date.now()): Map<string, RewardKind> {
  const sources = new Map<string, RewardKind>(),
    live = records.filter((r) => !r.deleted);
  const routines = new Map(records.filter((r) => r.entity === 'routines').map((r) => [r.id, r]));
  const valid = (v: unknown) =>
    typeof v === 'string' && Number.isFinite(Date.parse(v)) && Date.parse(v) <= now + 300000;
  for (const r of live) {
    const d = r.data;
    if (
      r.entity === 'prayer_records' &&
      /^\d{4}-\d{2}-\d{2}:(Fajr|Dhuhr|Asr|Maghrib|Isha)$/.test(r.id) &&
      r.id === d.day + ':' + d.prayer &&
      d.status !== 'na'
    ) {
      const start = Date.parse(d.windowStart),
        end = Date.parse(d.windowEnd);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      if (
        valid(d.completedAt) &&
        Date.parse(d.completedAt) >= start &&
        Date.parse(d.completedAt) < end
      )
        sources.set('prayer:' + r.id, 'prayer');
      else if (valid(d.qazaAt) && Date.parse(d.qazaAt) >= end)
        sources.set('prayer:' + r.id, 'qaza');
    }
    if (r.entity === 'qaza_history') {
      const count = Math.max(0, Math.min(100000, Number(d.quantity) || 0)),
        seen = new Set<string>();
      let earned = 0;
      for (const item of Array.isArray(d.completed) ? d.completed : [])
        if (typeof item.id === 'string' && item.id && !seen.has(item.id) && valid(item.at)) {
          seen.add(item.id);
          const quantity = Number.isInteger(item.quantity ?? 1)
            ? Math.max(0, Math.min(count - earned, item.quantity ?? 1))
            : 0;
          for (let i = 0; i < quantity; i++)
            sources.set('historical:' + r.id + ':' + item.id + ':' + i, 'qaza');
          earned += quantity;
          if (earned >= count) break;
        }
    }
    if (
      r.entity === 'routine_completions' &&
      r.id === d.routineId + ':' + d.period &&
      valid(d.completedAt)
    ) {
      // Tombstoned definitions retain earned completions; deleting a routine is not undoing worship.
      const routine = routines.get(d.routineId);
      const kind = routine?.data.kind;
      if (['tasbih', 'dua', 'custom', 'quran', 'nafl'].includes(kind))
        sources.set('routine:' + r.id, ['tasbih', 'dua'].includes(kind) ? kind : 'custom');
    }
  }
  return sources;
}
export function reconcileEconomy(
  records: RecordData[],
  old: Economy | undefined,
  now = new Date(),
  rewards = old?.rewardValues || config.rewards,
): Economy {
  const state: Economy = structuredClone(old || emptyEconomy()),
    sources = rewardSources(records, now.getTime());
  // Existing ledger is an audit trail. Corrections reverse only their original claim; misses add nothing.
  for (const source of new Set([...Object.keys(state.claims), ...sources.keys()])) {
    const kind = sources.get(source),
      prior = state.claims[source];
    if (!kind && !prior) continue;
    const rates = { ...prior?.rates };
    if (kind && rates[kind] === undefined)
      rates[kind] = Math.max(0, Math.min(10000, Math.trunc(rewards[kind])));
    const amount = kind ? rates[kind]! : 0,
      previous = prior?.active ? prior.amount : 0;
    if (amount === previous && (!kind || prior?.kind === kind)) continue;
    const revision = (prior?.revision || 0) + 1,
      delta = amount - previous,
      id = source + ':' + revision;
    state.balance += delta;
    state.claims[source] = { kind: kind || prior.kind, amount, active: !!kind, revision, rates };
    state.transactions[id] = {
      id,
      source,
      kind: kind || 'correction',
      delta,
      at: now.toISOString(),
      balanceAfter: state.balance,
    };
  }
  return state;
}
