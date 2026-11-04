import { economyConfig, reconcileEconomy, type Economy } from './economy';
import type { RecordData } from './domain';
export type PurchaseKind = 'unlock' | 'colors' | 'wallpaper' | 'seasonal' | 'animated' | 'default';
export interface CustomTheme {
  primary?: string;
  secondary?: string;
  wallpaper?: { wallpaper?: string; fileId?: string };
  effects?: string[];
}
export interface ThemeOrder {
  id: string;
  kind: PurchaseKind | 'pack';
  payload: Record<string, any>;
  cost: number;
  createdAt: string;
  status: 'pending' | 'accepted' | 'rejected';
  error?: string;
}
export const themePrices = { ...economyConfig.prices, default: 0 };
export function cleanThemePurchase(
  kind: PurchaseKind,
  payload: Record<string, any>,
): Record<string, any> {
  if (!(kind in themePrices) || kind === ('pack' as string)) throw Error('Unknown customization');
  if (kind === 'unlock' || kind === 'default') return {};
  if (kind === 'colors') {
    if (
      !['primary', 'secondary'].every(
        (k) => typeof payload[k] === 'string' && /^#[a-f0-9]{6}$/i.test(payload[k]),
      )
    )
      throw Error('Choose valid colors');
    return { primary: payload.primary.toLowerCase(), secondary: payload.secondary.toLowerCase() };
  }
  if (kind === 'wallpaper') {
    if (payload.fileId) {
      if (!/^[a-f0-9-]{36}$/.test(payload.fileId)) throw Error('Invalid wallpaper file');
      return { fileId: payload.fileId };
    }
    if (!['sand', 'garden', 'night'].includes(payload.wallpaper)) throw Error('Choose a wallpaper');
    return { wallpaper: payload.wallpaper };
  }
  if (kind === 'seasonal') {
    if (!['ramadan', 'eid'].includes(payload.seasonal)) throw Error('Choose a seasonal theme');
    return { seasonal: payload.seasonal };
  }
  if (
    !Array.isArray(payload.effects) ||
    !payload.effects.length ||
    payload.effects.length > 4 ||
    new Set(payload.effects).size !== payload.effects.length ||
    !payload.effects.every((e: unknown) =>
      ['stars', 'lanterns', 'clouds', 'geometry'].includes(String(e)),
    )
  )
    throw Error('Choose one or more effects');
  return { effects: [...payload.effects].sort() };
}
export function applyTheme(
  theme: CustomTheme,
  kind: PurchaseKind,
  payload: Record<string, any>,
): CustomTheme {
  if (kind === 'default') return {};
  if (kind === 'unlock') return { ...theme };
  if (kind === 'colors') return { ...theme, ...payload };
  if (kind === 'wallpaper') return { ...theme, wallpaper: payload };
  if (kind === 'seasonal')
    return {
      ...theme,
      wallpaper: { wallpaper: payload.seasonal },
      primary: payload.seasonal === 'ramadan' ? '#245858' : '#573c76',
      secondary: '#b28b34',
    };
  return { ...theme, effects: payload.effects };
}
export function purchaseTheme(
  records: RecordData[],
  old: Economy,
  id: string,
  kind: PurchaseKind,
  input: Record<string, any>,
  now = new Date(),
  prices = { ...themePrices, ...old?.prices },
): Economy {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw Error('Invalid purchase identifier');
  const payload = cleanThemePurchase(kind, input),
    state = reconcileEconomy(records, old, now),
    prior = state.orders?.[id];
  if (prior) {
    if (prior.kind !== kind || JSON.stringify(prior.payload) !== JSON.stringify(payload))
      throw Error('This purchase identifier was already used');
    return state;
  }
  if (!['default', 'unlock'].includes(kind) && !state.studioUnlocked)
    throw Error('Unlock Theme Studio first');
  if (kind === 'unlock' && state.studioUnlocked) throw Error('Theme Studio is already unlocked');
  const cost = kind === 'default' ? 0 : Math.max(0, Math.min(100000, Math.trunc(prices[kind])));
  if (cost > 0 && state.balance < cost) throw Error('Not enough Gems');
  state.balance -= cost;
  state.studioUnlocked = state.studioUnlocked || kind === 'unlock';
  state.theme = applyTheme(state.theme || {}, kind, payload);
  state.orders = {
    ...state.orders,
    [id]: { id, kind, payload, cost, createdAt: now.toISOString(), status: 'pending' },
  };
  const key = 'order:' + id;
  state.transactions[key] = {
    id: key,
    source: key,
    kind: 'purchase',
    delta: -cost,
    at: now.toISOString(),
    balanceAfter: state.balance,
  };
  return state;
}
function luminance(hex: string) {
  const rgb = hex
    .match(/[a-f0-9]{2}/gi)!
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
export function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
export function readableAccent(hex: string, dark: boolean) {
  let color = hex;
  const target = dark ? '#162c23' : '#fffef9';
  for (let step = 0; contrast(color, target) < 4.5 && step < 25; step++)
    color =
      '#' +
      color
        .match(/[a-f0-9]{2}/gi)!
        .map((v) =>
          Math.round(parseInt(v, 16) * 0.85 + (dark ? 255 : 0) * 0.15)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('');
  return color;
}
export const accentInk = (hex: string) =>
  contrast(hex, '#ffffff') >= contrast(hex, '#000000') ? '#ffffff' : '#000000';
