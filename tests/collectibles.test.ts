import { describe, it, expect } from 'vitest';
import { emptyEconomy } from '../src/economy';
import {
  emptyCollectibles,
  selectPack,
  purchaseLocalPack,
  type CollectibleCard,
} from '../src/collectibles';
const library: CollectibleCard[] = ['common', 'uncommon', 'rare', 'ultra'].flatMap((rarity, r) =>
  Array.from({ length: 3 }, (_, i) => ({
    id: `00000000-0000-0000-0000-${String(r * 3 + i).padStart(12, '0')}`,
    title: 'Synthetic fixture',
    rarity: rarity as any,
    category: 'fixture',
    story: 'Synthetic fixture, no historical claim.',
    references: [{ title: 'Fixture only', url: 'https://example.invalid' }],
    verification: 'verified',
    status: 'published',
    generationDate: null,
    version: 1,
    artId: '11111111-1111-1111-1111-111111111111',
    artVerified: true, edition: 2, englishReviewed: true, urduReviewed: true, english: 'This is a synthetic test card. It makes no historical or religious claim. The third sentence tests the reading view.', urdu: 'یہ آزمائشی کہانی ہے۔ اس میں کوئی تاریخی یا مذہبی دعویٰ نہیں ہے۔ یہ صرف زبان اور قاری کی جانچ کے لیے ہے۔', titleUrdu: 'آزمائشی کہانی',
  })),
);
const id = '12345678-1234-1234-1234-123456789abc';
describe('offline collectible ownership', () => {
  it('applies rarity probabilities to every draw and prevents duplicate definitions within a pack', () => {
    for (const [roll, rarity] of [
      [1, 'common'],
      [55, 'common'],
      [56, 'uncommon'],
      [85, 'uncommon'],
      [86, 'rare'],
      [97, 'rare'],
      [98, 'ultra'],
      [100, 'ultra'],
    ] as const) {
      let call = 0;
      const cards = selectPack(library, () => (call++ % 2 === 0 ? roll : 0));
      expect(new Set(cards.map((c) => c.id)).size).toBe(3);
      expect(cards.every((c) => c.rarity === rarity)).toBe(true);
    }
  });
  it('saves three face-down owned copies and one debit before any animation', () => {
    const collection = emptyCollectibles();
    collection.library = Object.fromEntries(library.map((c) => [c.id, c]));
    const before = { ...emptyEconomy(), balance: 1000 },
      p = purchaseLocalPack([], before, collection, id, (min) => min);
    expect(p.economy.balance).toBe(500);
    expect(Object.values(p.collectibles.copies).every((c) => !c.revealed)).toBe(true);
    const restored = JSON.parse(JSON.stringify(p));
    expect(purchaseLocalPack([], restored.economy, restored.collectibles, id).economy.balance).toBe(
      500,
    );
    expect(Object.keys(restored.collectibles.copies)).toHaveLength(3);
    expect(before.balance).toBe(1000);
  });
  it('requires verified content and all rarity pools without spending or mutating the wallet', () => {
    const c = emptyCollectibles();
    c.library = Object.fromEntries(
      library.map((card) => [card.id, { ...card, verification: 'draft' }]),
    );
    const balance = { ...emptyEconomy(), balance: 1000 };
    expect(() => purchaseLocalPack([], balance, c, id)).toThrow('verified card library');
    expect(balance.balance).toBe(1000);
    expect(Object.keys(c.copies)).toHaveLength(0);
  });
});
