import { reconcileEconomy, type Economy, economyConfig } from './economy';
import type { RecordData } from './domain';
export type CardRarity = 'common' | 'uncommon' | 'rare' | 'ultra';
export interface CollectibleCard {
  id: string;
  title: string;
  category: string;
  rarity: CardRarity;
  story: string;
  titleUrdu?: string;
  summary?: string;
  summaryUrdu?: string;
  english?: string;
  urdu?: string;
  edition?: number;
  englishReviewed?: boolean;
  urduReviewed?: boolean;
  references: { title: string; url: string }[];
  verification: string;
  status: string;
  generationDate: string | null;
  version: number;
  artId: string | null;
  artVerified: boolean;
}
export interface CardCopy {
  id: string;
  cardId: string;
  orderId: string;
  position: number;
  acquiredAt: string;
  revealed: boolean;
  hidden?: boolean;
  pendingSync: boolean;
  revealSynced?: boolean;
}
export interface CardPack {
  id: string;
  copyIds: string[];
  createdAt: string;
  pendingSync: boolean;
  error?: string;
  opened?: boolean;
}
export interface Collectibles {
  version: 1;
  library: Record<string, CollectibleCard>;
  copies: Record<string, CardCopy>;
  packs: Record<string, CardPack>;
  artwork: Record<
    string,
    { path?: string; base64?: string; mime: string; bytes?: number; touched?: number }
  >;
  reservations?: Record<string, { cardIds: string[]; cost: number }>;
}
export const emptyCollectibles = (): Collectibles => ({
  version: 1,
  library: {},
  copies: {},
  packs: {},
  artwork: {},
});
export const cardRarities: CardRarity[] = ['common', 'uncommon', 'rare', 'ultra'];
export function verifiedCard(input: unknown): input is CollectibleCard {
  const card = input as CollectibleCard;
  return (
    !!card &&
    typeof card.id === 'string' &&
    /^[a-f0-9-]{36}$/.test(card.id) &&
    typeof card.title === 'string' &&
    typeof card.story === 'string' &&
    cardRarities.includes(card.rarity) &&
    (card.edition || 0) >= 2 &&
    card.englishReviewed === true &&
    card.urduReviewed === true &&
    card.verification === 'verified' &&
    card.status === 'published' &&
    card.artVerified === true &&
    typeof card.artId === 'string' &&
    /^[a-f0-9-]{36}$/.test(card.artId) &&
    Array.isArray(card.references) &&
    card.references.length > 0 &&
    card.references.length <= 8 &&
    card.references.every(
      (ref) =>
        typeof ref.title === 'string' && typeof ref.url === 'string' && /^https:\/\//.test(ref.url),
    )
  );
}
export function randomInteger(min: number, max: number): number {
  const size = max - min + 1,
    limit = Math.floor(4294967296 / size) * size;
  let value: number;
  do {
    value = crypto.getRandomValues(new Uint32Array(1))[0];
  } while (value >= limit);
  return min + (value % size);
}
export function selectPack(
  library: CollectibleCard[],
  random = randomInteger,
  weights = economyConfig.rarities,
): CollectibleCard[] {
  const pools = Object.fromEntries(
    cardRarities.map((rarity) => [
      rarity,
      library.filter((c) => verifiedCard(c) && c.rarity === rarity),
    ]),
  ) as Record<CardRarity, CollectibleCard[]>;
  for (const rarity of cardRarities) {
    pools[rarity] = [...new Map(pools[rarity].map((c) => [c.id, c])).values()];
    if (pools[rarity].length < 3)
      throw Error('The verified card library is still being prepared. No Gems were spent.');
  }
  if (
    cardRarities.reduce((sum, r) => sum + weights[r], 0) !== 100 ||
    cardRarities.some((r) => !Number.isInteger(weights[r]) || weights[r] < 1)
  )
    throw Error('Invalid rarity configuration');
  const chosen: CollectibleCard[] = [];
  for (let i = 0; i < 3; i++) {
    const roll = random(1, 100);
    if (roll < 1 || roll > 100) throw Error('Invalid random source');
    let ceiling = 0;
    const rarity = cardRarities.find((r) => {
      ceiling += weights[r];
      return roll <= ceiling;
    })!;
    const index = random(0, pools[rarity].length - 1);
    if (!pools[rarity][index]) throw Error('Invalid random source');
    chosen.push(pools[rarity].splice(index, 1)[0]);
  }
  return chosen;
}
export function purchaseLocalPack(
  records: RecordData[],
  old: Economy,
  collection: Collectibles,
  id: string,
  random = randomInteger,
  now = new Date(),
): { economy: Economy; collectibles: Collectibles } {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw Error('Invalid pack identifier');
  const economy = reconcileEconomy(records, old, now),
    state = structuredClone(collection);
  if (economy.orders?.[id]) {
    if (economy.orders[id].kind !== 'pack' || !state.packs[id])
      throw Error('This purchase identifier was already used');
    return { economy, collectibles: state };
  }
  const cost = Math.max(
    1,
    Math.min(100000, Math.trunc(economy.prices?.pack ?? economyConfig.prices.pack)),
  );
  if (economy.balance < cost) throw Error('Not enough Gems');
  const reservation = state.reservations?.[id];
  if (reservation && reservation.cost !== cost)
    throw Error('The pack price changed. No Gems were spent.');
  const cards = reservation
    ? reservation.cardIds.map((key) => state.library[key])
    : selectPack(Object.values(state.library), random, economy.rarities || economyConfig.rarities);
  if (
    cards.length !== 3 ||
    new Set(cards.map((c) => c?.id)).size !== 3 ||
    cards.some((c) => !verifiedCard(c) || !c.english || !c.urdu)
  )
    throw Error(
      'Connect to save the three complete stories before opening this pack. No Gems were spent.',
    );
  const copyIds = cards.map(() => crypto.randomUUID());
  cards.forEach((card, position) => {
    const copy = copyIds[position];
    state.copies[copy] = {
      id: copy,
      cardId: card.id,
      orderId: id,
      position,
      acquiredAt: now.toISOString(),
      revealed: false,
      pendingSync: true,
    };
  });
  state.packs[id] = { id, copyIds, createdAt: now.toISOString(), pendingSync: true };
  economy.balance -= cost;
  const key = 'order:' + id;
  economy.transactions[key] = {
    id: key,
    source: key,
    kind: 'pack',
    delta: -cost,
    at: now.toISOString(),
    balanceAfter: economy.balance,
  };
  economy.orders = {
    ...economy.orders,
    [id]: {
      id,
      kind: 'pack',
      payload: { cardIds: cards.map((c) => c.id), copyIds },
      cost,
      createdAt: now.toISOString(),
      status: 'pending',
    },
  };
  return { economy, collectibles: state };
}

export function mergeCollection(
  old: Collectibles | undefined,
  data: { copies: any[]; hiddenCopyIds?: string[] },
): Collectibles {
  const state = structuredClone(old || emptyCollectibles()),
    groups = new Map<string, CardCopy[]>();
  for (const row of data.copies) {
    const card = row.card as CollectibleCard;
    if (card.verification !== 'verified') throw Error('Unverified collection content refused');
    state.library[card.id] = { ...state.library[card.id], ...card };
    const previous = state.copies[row.copyId],
      copy: CardCopy = {
        id: row.copyId,
        cardId: card.id,
        orderId: row.orderId,
        position: row.position,
        acquiredAt: row.acquiredAt,
        revealed: row.revealed || previous?.revealed || false,
        revealSynced: row.revealed === true,
        pendingSync: false,
        hidden: false,
      };
    state.copies[copy.id] = copy;
    groups.set(copy.orderId, [...(groups.get(copy.orderId) || []), copy]);
  }
  for (const [id, copies] of groups)
    state.packs[id] = {
      id,
      copyIds: copies.sort((a, b) => a.position - b.position).map((c) => c.id),
      createdAt: state.packs[id]?.createdAt || copies[0].acquiredAt,
      pendingSync: false,
      opened: state.packs[id]?.opened,
    };
  for (const id of data.hiddenCopyIds || []) {
    const copy = state.copies[id];
    if (copy) {
      copy.hidden = true;
      copy.pendingSync = false;
      if (state.library[copy.cardId]) state.library[copy.cardId].status = 'unavailable';
    }
  }
  return state;
}

export function updateCardLibrary(
  old: Collectibles | undefined,
  cards: CollectibleCard[],
  availability: { id: string; status: string; verified: boolean | number | string }[] = [],
): Collectibles {
  const state = structuredClone(old || emptyCollectibles());
  const owned = new Set(Object.values(state.copies).map((copy) => copy.cardId));
  for (const card of Object.values(state.library))
    if (!owned.has(card.id)) card.status = 'unavailable';
  for (const card of cards) {
    if (!verifiedCard(card)) throw Error('Unverified card refused');
    state.library[card.id] = { ...state.library[card.id], ...card };
  }
  for (const item of availability) {
    const card = state.library[item.id];
    if (card)
      card.status =
        String(item.verified) === '1' || item.verified === true
          ? ['flagged', 'withdrawn'].includes(item.status)
            ? item.status
            : 'unavailable'
          : 'unavailable';
  }
  for (const copy of Object.values(state.copies))
    copy.hidden = !['published', 'flagged'].includes(state.library[copy.cardId]?.status || '');
  return state;
}
