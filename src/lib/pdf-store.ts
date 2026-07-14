/**
 * Lightweight IndexedDB wrapper to persist uploaded PDF files on the client-side.
 * This ensures that users can download the exact files they imported during registration
 * even after reloading the page.
 */

const DB_NAME = 'pcp_documents_db';
const DB_VERSION = 1;
const STORE_NAME = 'pdf_cache';

let dbInstance: IDBDatabase | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event: any) => {
      dbInstance = event.target.result;
      resolve(dbInstance!);
    };

    request.onerror = (event: any) => {
      reject(new Error('Failed to open IndexedDB: ' + event.target.error?.message));
    };
  });
}

export async function savePdfToStorage(fileName: string, base64Data: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(base64Data, fileName);

      request.onsuccess = () => resolve();
      request.onerror = (event: any) => reject(event.target.error);
    });
  } catch (error) {
    console.error('Error saving PDF to IndexedDB:', error);
  }
}

export async function getPdfFromStorage(fileName: string): Promise<string | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(fileName);

      request.onsuccess = (event: any) => resolve(event.target.result || null);
      request.onerror = (event: any) => reject(event.target.error);
    });
  } catch (error) {
    console.error('Error reading PDF from IndexedDB:', error);
    return null;
  }
}
