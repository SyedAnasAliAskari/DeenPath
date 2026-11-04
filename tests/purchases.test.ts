import { describe, it, expect } from 'vitest';
import { emptyEconomy } from '../src/economy';
import { replayPendingOrder } from '../src/purchases';
const id = '12345678-1234-1234-1234-123456789abc';
describe('offline purchase reconciliation', () => {
  it('replays a quoted customization cost once without substituting a new price', () => {
    const state = { ...emptyEconomy(), balance: 100, prices: { colors: 80 } },
      order: any = {
        id,
        kind: 'colors',
        cost: 50,
        payload: { primary: '#123456', secondary: '#654321' },
        createdAt: '2026-11-01T00:00:00Z',
        status: 'pending',
      };
    const next = replayPendingOrder(state, order);
    expect(next.balance).toBe(50);
    expect(replayPendingOrder(next, order).balance).toBe(50);
    expect(state.balance).toBe(100);
  });
  it('replays a pack debit without changing its selected cards or copy IDs', () => {
    const order: any = {
      id,
      kind: 'pack',
      cost: 500,
      payload: {
        cardIds: [id, id.replace('abc', 'abd'), id.replace('abc', 'abe')],
        copyIds: [id.replace('abc', 'abf'), id.replace('abc', 'aca'), id.replace('abc', 'acb')],
      },
      createdAt: '2026-11-01T00:00:00Z',
      status: 'pending',
    };
    const next = replayPendingOrder({ ...emptyEconomy(), balance: 1000 }, order);
    expect(next.orders![id].payload).toEqual(order.payload);
    expect(next.balance).toBe(500);
  });
  it('rejects conflicting offline spending without mutating the canonical balance', () => {
    const state = { ...emptyEconomy(), balance: 10 };
    expect(() =>
      replayPendingOrder(state, {
        id,
        kind: 'unlock',
        cost: 1000,
        payload: {},
        createdAt: '2026-11-01T00:00:00Z',
        status: 'pending',
      }),
    ).toThrow('cloud balance changed');
    expect(state.balance).toBe(10);
  });
});
