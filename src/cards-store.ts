import { browserStory } from './card-texts';
import { db, api, apiURL } from './store';
import { Native, isNative } from './native';
import {
  emptyCollectibles,
  verifiedCard,
  updateCardLibrary,
  purchaseLocalPack,
  selectPack,
  type CollectibleCard,
} from './collectibles';
export async function refreshCardLibrary() {
  const response = await api('cards/library').catch(() => {
    throw Error('The card library is unavailable right now. Your saved collection is kept.');
  });
  if (
    !Array.isArray(response.cards) ||
    response.cards.length > 2500 ||
    !response.cards.every(verifiedCard)
  )
    throw Error('The card library is not ready yet. Your saved collection is kept.');
  if (isNative) {
    await db.flush();
    await Native.deen({
      op: 'cacheCardLibrary',
      owner: db.state.owner || '',
      cards: response.cards,
      states: response.states || [],
    });
    await db.reloadNative();
  } else {
    db.state.collectibles = updateCardLibrary(
      db.state.collectibles,
      response.cards,
      response.states || [],
    );
    await db.persist();
  }
  // Catalog refresh intentionally downloads no story bodies or artwork.
}
const assetFlights = new Map<string, Promise<void>>();
function assetDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('deenpath-card-art', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('art', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function browserAsset(id: string, blob?: Blob): Promise<Blob | null> {
  const database = await assetDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction('art', 'readwrite'),
        store = transaction.objectStore('art');
      let result: Blob | null = null;
      const request = store.get(id);
      request.onsuccess = () => {
        const old = request.result;
        if (blob || old) {
          result = blob || old.blob;
          store.put({ id, blob: result, touched: Date.now() });
        }
        const all = store.getAll();
        all.onsuccess = () => {
          let total = all.result.reduce((n, row) => n + row.blob.size, 0);
          for (const row of all.result.sort((a, b) => a.touched - b.touched)) {
            if (total <= 32 * 1024 * 1024) break;
            if (row.id === id) continue;
            store.delete(row.id);
            total -= row.blob.size;
          }
        };
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

async function cacheCardArt(card: CollectibleCard) {
  const id = card.artId!;
  const old = db.state.collectibles?.artwork[id];
  if (!isNative && (await browserAsset(id))) return;
  if (old) {
    if (!isNative && old.base64) return;
    try {
      await Native.readFile({ path: old.path! });
      return;
    } catch {
      /* A restored installation may need to download its public artwork again. */
    }
  }
  const response = await fetch(apiURL('cards/art/' + id), { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw Error('Artwork unavailable');
  const blob = await response.blob();
  if (blob.size > 6 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(blob.type))
    throw Error('Invalid artwork');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = btoa(binary);
  if (isNative) {
    const file = await Native.storeFile({
      name:
        'card-' +
        id +
        '.' +
        (blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'),
      mime: blob.type,
      base64,
    });
    await Native.deen({
      op: 'cacheCardArtwork',
      owner: db.state.owner || '',
      artId: id,
      path: file.path,
    });
    await db.reloadNative();
  } else {
    const state = db.state.collectibles || emptyCollectibles();
    await browserAsset(id, blob);
    state.artwork[id] = { mime: blob.type, bytes: blob.size, touched: Date.now() };
    db.state.collectibles = state;
    await db.persist();
  }
}
export async function cardArtwork(id: string): Promise<Blob | null> {
  let art = db.state.collectibles?.artwork[id];
  if (!isNative) {
    const cached = await browserAsset(id);
    if (cached) return cached;
  }
  if (!art || (!art.path && !art.base64)) {
    const card = Object.values(db.state.collectibles?.library || {}).find((c) => c.artId === id);
    if (!card) return null;
    let flight = assetFlights.get(id);
    if (!flight) {
      flight = cacheCardArt(card).finally(() => assetFlights.delete(id));
      assetFlights.set(id, flight);
    }
    await flight;
    if (!isNative) return browserAsset(id);
    art = db.state.collectibles?.artwork[id];
  }
  if (!art) return null;
  try {
    const encoded = art.base64 || (await Native.readFile({ path: art.path! })).base64;
    return new Blob([Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))], { type: art.mime });
  } catch {
    return null;
  }
}
export async function savedStories(ids: string[]): Promise<CollectibleCard[]> {
  if (isNative) return (await Native.deen({ op: 'cardStories', ids })).cards || [];
  const rows = await Promise.all(
    ids.map(async (id) => (await browserStory(id)) || db.state.collectibles?.library[id]),
  );
  return rows.filter(Boolean) as CollectibleCard[];
}
export async function loadOwnedStory(card: CollectibleCard): Promise<CollectibleCard> {
  const saved = (await savedStories([card.id]))[0];
  if (saved?.english && saved?.urdu)
    return { ...card, ...saved, status: card.status, verification: card.verification };
  if ((card.edition || 0) < 2) return saved || card;
  try {
    const response = await api('cards/details/' + card.id);
    const detail = response.cards?.find((item: CollectibleCard) => item.id === card.id);
    if (!verifiedCard(detail) || !detail.english || !detail.urdu) throw Error('Story unavailable');
    if (isNative) {
      await Native.deen({ op: 'cacheCardDetails', cards: [detail], owner: db.state.owner || '' });
      await db.reloadNative();
    } else await browserStory(card.id, detail);
    return { ...detail, status: card.status, verification: card.verification };
  } catch {
    throw Error(
      'The full story is not saved on this device yet. Connect to restore it. Your card remains owned.',
    );
  }
}
export async function buyCardPack(requestedId?: string) {
  // Keep the original selection when an unpaid download is interrupted.
  const state = db.state.collectibles || emptyCollectibles();
  const owner = db.state.owner;
  const sameOwner = () => {
    if (db.state.owner !== owner)
      throw Error('Account changed. No purchase was made for the new account.');
  };
  const id =
    requestedId ||
    Object.keys(state.reservations || {}).find((key) => !state.packs[key]) ||
    crypto.randomUUID();
  if (state.packs[id]) return id;
  if (isNative) {
    await db.flush();
    await Native.deen({ op: 'reservePack', id, owner: owner || '' });
    await db.reloadNative();
  } else if (!state.reservations?.[id]) {
    if ((db.state.economy?.balance || 0) < (db.state.economy?.prices?.pack || 500))
      throw Error('Not enough Gems');
    const cards = selectPack(Object.values(state.library), undefined, db.state.economy?.rarities);
    state.reservations = {
      ...state.reservations,
      [id]: { cardIds: cards.map((c) => c.id), cost: db.state.economy?.prices?.pack || 500 },
    };
    db.state.collectibles = state;
    await db.persist();
  }
  const current = db.state.collectibles!,
    reservation = current.reservations![id];
  const texts = await savedStories(reservation.cardIds);
  const missing = reservation.cardIds.filter(
    (key) => !texts.find((card) => card.id === key && card.english && card.urdu),
  );
  if (missing.length) {
    const response = await api('cards/details/' + missing.join(',')).catch(() => {
      throw Error('Connect to save these stories. Your selection is kept and no Gems were spent.');
    });
    if (
      !Array.isArray(response.cards) ||
      response.cards.length !== missing.length ||
      !response.cards.every(
        (c: CollectibleCard) =>
          missing.includes(c.id) && verifiedCard(c) && !!c.english && !!c.urdu,
      )
    )
      throw Error('The complete reviewed stories are unavailable. No Gems were spent.');
    sameOwner();
    if (isNative) {
      await Native.deen({
        op: 'cacheCardDetails',
        owner: owner || '',
        cards: response.cards,
      });
      await db.reloadNative();
    } else {
      for (const card of response.cards) current.library[card.id] = card;
      await db.persist();
    }
  }
  // Artwork is best-effort; owned text is saved before the atomic charge.
  await Promise.all(
    reservation.cardIds.map((key) =>
      cacheCardArt(db.state.collectibles!.library[key]).catch(() => {}),
    ),
  );
  sameOwner();
  if (isNative) {
    await db.flush();
    await Native.deen({ op: 'purchasePack', id, owner: owner || '' });
    await db.reloadNative();
  } else {
    const loadedTexts = await savedStories(reservation.cardIds);
    sameOwner();
    const result = purchaseLocalPack(
      db.state.records,
      db.state.economy!,
      {
        ...db.state.collectibles!,
        library: {
          ...db.state.collectibles!.library,
          ...Object.fromEntries(
            loadedTexts.map((card) => [
              card.id,
              { ...db.state.collectibles!.library[card.id], ...card },
            ]),
          ),
        },
      },
      id,
    );
    db.state.economy = result.economy;
    db.state.collectibles = result.collectibles;
    await db.persist();
  }
  return id;
}
export async function openCardPacket(id: string) {
  if (isNative) {
    await db.flush();
    await Native.deen({ op: 'openPack', id, owner: db.state.owner || '' });
    await db.reloadNative();
  } else {
    const pack = db.state.collectibles?.packs[id];
    if (pack && !pack.opened) {
      pack.opened = true;
      await db.persist();
    }
  }
}
export async function revealCardCopy(copyId: string) {
  if (isNative) {
    await db.flush();
    await Native.deen({ op: 'revealCard', copyId, owner: db.state.owner || '' });
    await db.reloadNative();
  } else {
    const copy = db.state.collectibles?.copies[copyId];
    if (!copy) throw Error('Card copy not found');
    if (!copy.revealed) {
      copy.revealed = true;
      copy.revealSynced = false;
      await db.persist();
    }
  }
}
