import { type Word, WordSchema, SR_DEFAULTS } from './schema';

const DB_NAME = 'chinese-flashcards';
const DB_VERSION = 1;
const STORE = 'words';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'chinese' });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
  return dbPromise;
}

export async function getAllWords(): Promise<Word[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => {
      const words: Word[] = [];
      for (const row of req.result) {
        const parsed = WordSchema.safeParse(row);
        if (parsed.success) {
          words.push(parsed.data);
        } else {
          console.warn('Dropping malformed IDB record:', row, parsed.error);
        }
      }
      resolve(words);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getWord(chinese: string): Promise<Word | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(chinese);
    req.onsuccess = () => {
      if (!req.result) { resolve(undefined); return; }
      const parsed = WordSchema.safeParse(req.result);
      if (parsed.success) {
        resolve(parsed.data);
      } else {
        console.warn('Dropping malformed IDB record:', req.result, parsed.error);
        resolve(undefined);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function putWord(word: Word): Promise<Word> {
  const validated = WordSchema.parse(word);
  const stored: Word = { ...validated, updated_at: new Date().toISOString() };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve(stored);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    tx.objectStore(STORE).put(stored);
  });
}

export async function resetSr(): Promise<Word[]> {
  const words = await getAllWords();
  const now = new Date().toISOString();
  const modified: Word[] = words.map((w) => ({ ...w, ...SR_DEFAULTS, updated_at: now }));
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    tx.oncomplete = () => resolve(modified);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    for (const w of modified) store.put(w);
  });
}

export async function putWordsRaw(words: Word[]): Promise<void> {
  if (words.length === 0) return;
  const validated = words.map((w) => WordSchema.parse(w));
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    for (const w of validated) store.put(w);
  });
}

export async function clearAll(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('deleteDatabase blocked'));
  });
}
