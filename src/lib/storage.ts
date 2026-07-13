const DB_NAME = "DanceGrid";
const DB_VERSION = 1;
const STORE_NAME = "kv";

type StoredEntry<T> = {
  key: string;
  value: T;
  updatedAt: number;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onerror = () => reject(request.error ?? new Error("Failed to open local database"));
    request.onsuccess = () => resolve(request.result);
  });
}

async function readEntry<T>(key: string): Promise<T | null> {
  const database = await openDatabase();
  try {
    return await new Promise<T | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => reject(request.error ?? new Error(`Failed to read ${key}`));
      request.onsuccess = () => {
        const entry = request.result as StoredEntry<T> | undefined;
        resolve(entry ? entry.value : null);
      };
    });
  } finally {
    database.close();
  }
}

async function writeEntry<T>(key: string, value: T): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ key, value, updatedAt: Date.now() } satisfies StoredEntry<T>);

      request.onerror = () => reject(request.error ?? new Error(`Failed to write ${key}`));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error(`Failed to write ${key}`));
    });
  } finally {
    database.close();
  }
}

export async function readJson<T>(key: string): Promise<T | null> {
  return readEntry<T>(key);
}

export async function writeJson<T>(key: string, value: T): Promise<void> {
  await writeEntry(key, value);
}

export async function removeJson(key: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onerror = () => reject(request.error ?? new Error(`Failed to delete ${key}`));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error(`Failed to delete ${key}`));
    });
  } finally {
    database.close();
  }
}

export async function sha256Base64(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const array = Array.from(new Uint8Array(digest));
  return btoa(String.fromCharCode(...array));
}

