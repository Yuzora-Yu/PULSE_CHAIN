import { type Puzzle } from '../core/model';
import { validateBoard } from '../core/validate';
import { hash } from '../generator/seed';
let database: Promise<IDBDatabase> | undefined;
function db() {
  return (database ??= new Promise((resolve, reject) => {
    const r = indexedDB.open('pulse-chain-cache', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('puzzles', { keyPath: 'code' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}
export async function cachedPuzzle(code: string): Promise<Puzzle | undefined> {
  try {
    const database = await db();
    return await new Promise((resolve) => {
      const r = database.transaction('puzzles').objectStore('puzzles').get(code);
      r.onsuccess = () => {
        try {
          const row = r.result;
          if (!row || row.checksum !== hash(JSON.stringify(row.puzzle))) return resolve(undefined);
          validateBoard(row.puzzle.board);
          resolve(row.puzzle);
        } catch {
          resolve(undefined);
        }
      };
      r.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}
export async function cachePuzzle(p: Puzzle) {
  try {
    const database = await db();
    const tx = database.transaction('puzzles', 'readwrite');
    const store = tx.objectStore('puzzles');
    store.put({ code: p.code, puzzle: p, checksum: hash(JSON.stringify(p)) });
    const keys = store.getAllKeys();
    keys.onsuccess = () => {
      if (keys.result.length > 120)
        for (const k of keys.result.filter((k) => k !== p.code).slice(0, keys.result.length - 120))
          store.delete(k);
    };
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    /* Generation works even with unavailable/quota-limited storage. */
  }
}
