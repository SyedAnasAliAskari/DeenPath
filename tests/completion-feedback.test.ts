import { describe, it, expect } from 'vitest';
import { earnedForSources } from '../src/completion-feedback';
import { emptyEconomy, reconcileEconomy } from '../src/economy';
describe('completion receipts', () => {
  it('shows only the actual claim increase, never purchases, backfill or duplicate writes', () => {
    const before = emptyEconomy();
    const after = {
      ...emptyEconomy(),
      balance: 999,
      claims: {
        'prayer:today:Fajr': {
          kind: 'prayer',
          amount: 10,
          active: true,
          revision: 1,
          rates: { prayer: 10 },
        },
        'routine:other': { kind: 'dua', amount: 5, active: true, revision: 1, rates: { dua: 5 } },
      },
    } as any;
    expect(earnedForSources(before, after, 'prayer:today:Fajr')).toBe(10);
    expect(earnedForSources(after, after, 'prayer:today:Fajr')).toBe(0);
    expect(earnedForSources(after, before, 'prayer:today:Fajr')).toBe(0);
    expect(earnedForSources(before, after, '')).toBe(0);
  });
  it('reports only the net increase when correcting a rewarded Qaza to on-time', () => {
    const claim = (amount: number) =>
      ({
        ...emptyEconomy(),
        claims: { 'prayer:x': { kind: 'prayer', amount, active: true, revision: 1, rates: {} } },
      }) as any;
    expect(earnedForSources(claim(8), claim(10), 'prayer:x')).toBe(2);
  });
});
