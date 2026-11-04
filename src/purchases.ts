import type { Economy } from './economy';
import { applyTheme, cleanThemePurchase, type ThemeOrder } from './themes';
/** Replay the original quoted cost, never re-roll a pack or silently substitute a new price. */
export function replayPendingOrder(old: Economy, order: ThemeOrder): Economy {
  const state = structuredClone(old);
  if (state.orders?.[order.id]) return state;
  if (!Number.isSafeInteger(order.cost) || order.cost < 0 || order.cost > 100000)
    throw Error('Invalid purchase cost');
  if (order.cost > 0 && state.balance < order.cost)
    throw Error('This offline purchase needs attention because the cloud balance changed.');
  if (order.kind === 'pack') {
    for (const key of ['cardIds', 'copyIds'])
      if (
        !Array.isArray(order.payload[key]) ||
        order.payload[key].length !== 3 ||
        new Set(order.payload[key]).size !== 3 ||
        !order.payload[key].every(
          (id: unknown) => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id),
        )
      )
        throw Error('Invalid saved pack');
  } else {
    const payload = cleanThemePurchase(order.kind, order.payload);
    state.theme = applyTheme(state.theme || {}, order.kind, payload);
    state.studioUnlocked = state.studioUnlocked || order.kind === 'unlock';
  }
  state.balance -= order.cost;
  state.orders = { ...state.orders, [order.id]: structuredClone(order) };
  const key = 'order:' + order.id;
  state.transactions[key] = {
    id: key,
    source: key,
    kind: order.kind === 'pack' ? 'pack' : 'purchase',
    delta: -order.cost,
    at: order.createdAt,
    balanceAfter: state.balance,
  };
  return state;
}
