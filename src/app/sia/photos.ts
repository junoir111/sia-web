// SIA: the provider's photos stay ONLY on this device (IndexedDB). They are re-encrypted with a
// fresh key each time they are sent into a bubble, so the server never holds a key to decrypt them.
// A light compression keeps the uploads small.
const DB_NAME = 'sia';
const STORE = 'photos';
const KEY = 'provider';
export const MAX_PHOTOS = 3;
const MAX_SIDE = 1024;
const JPEG_QUALITY = 0.7;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = run(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      })
  );
}

export async function saveLocalPhotos(blobs: Blob[]): Promise<void> {
  await withStore('readwrite', (s) => s.put(blobs.slice(0, MAX_PHOTOS), KEY)).catch(() => undefined);
}

export async function loadLocalPhotos(): Promise<Blob[]> {
  try {
    const value = await withStore<Blob[] | undefined>('readonly', (s) => s.get(KEY));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export async function clearLocalPhotos(): Promise<void> {
  await withStore('readwrite', (s) => s.delete(KEY)).catch(() => undefined);
}

/** Resize to <= 1024px and re-encode as JPEG to keep uploads small. Falls back to the original. */
export async function compressImage(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY)
    );
    return blob ?? file;
  } catch {
    return file;
  }
}
