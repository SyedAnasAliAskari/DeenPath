import type { CollectibleCard } from './collectibles';
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('deenpath-owned-stories', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('stories', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function browserStory(
  id: string,
  card?: CollectibleCard,
): Promise<CollectibleCard | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('stories', card ? 'readwrite' : 'readonly'),
        store = transaction.objectStore('stories');
      let value: CollectibleCard | null = null;
      const request = store.get(id);
      request.onsuccess = () => {
        value = request.result || null;
        if (card && (!value || card.version >= value.version)) {
          store.put(card);
          value = card;
        }
      };
      transaction.oncomplete = () => resolve(value);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
