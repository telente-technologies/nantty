const posDatabaseName = "zudomartDashboardPos";
const posDatabaseVersion = 1;

export const posObjectStoreNames = {
  catalogSnapshots: "catalogSnapshots",
  offlineSales: "offlineSales",
  parkedSales: "parkedSales",
  keyValue: "keyValue",
} as const;

type PosObjectStoreName = (typeof posObjectStoreNames)[keyof typeof posObjectStoreNames];

let openDatabasePromise: Promise<IDBDatabase> | null = null;

function convertRequestToPromise<Result>(request: IDBRequest<Result>): Promise<Result> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

export function isOfflineStorageAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export function openPosOfflineDatabase(): Promise<IDBDatabase> {
  if (!isOfflineStorageAvailable()) return Promise.reject(new Error("Offline storage is not available in this browser."));
  openDatabasePromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const openRequest = indexedDB.open(posDatabaseName, posDatabaseVersion);
    openRequest.onupgradeneeded = () => {
      const database = openRequest.result;
      if (!database.objectStoreNames.contains(posObjectStoreNames.catalogSnapshots)) database.createObjectStore(posObjectStoreNames.catalogSnapshots, { keyPath: "locationId" });
      if (!database.objectStoreNames.contains(posObjectStoreNames.offlineSales)) database.createObjectStore(posObjectStoreNames.offlineSales, { keyPath: "clientSaleId" });
      if (!database.objectStoreNames.contains(posObjectStoreNames.parkedSales)) database.createObjectStore(posObjectStoreNames.parkedSales, { keyPath: "id" });
      if (!database.objectStoreNames.contains(posObjectStoreNames.keyValue)) database.createObjectStore(posObjectStoreNames.keyValue);
    };
    openRequest.onsuccess = () => resolve(openRequest.result);
    openRequest.onerror = () => {
      openDatabasePromise = null;
      reject(openRequest.error ?? new Error("Could not open offline storage."));
    };
  });
  return openDatabasePromise;
}

async function runInObjectStore<Result>(storeName: PosObjectStoreName, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<Result>): Promise<Result> {
  const database = await openPosOfflineDatabase();
  const transaction = database.transaction(storeName, mode);
  const transactionFinished = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
  });
  const result = await convertRequestToPromise(operation(transaction.objectStore(storeName)));
  await transactionFinished;
  return result;
}

export async function readRecordFromOfflineStore<Record>(storeName: PosObjectStoreName, key: IDBValidKey): Promise<Record | null> {
  const record = await runInObjectStore<unknown>(storeName, "readonly", (store) => store.get(key));
  return (record as Record | undefined) ?? null;
}

export async function readEveryRecordFromOfflineStore<Record>(storeName: PosObjectStoreName): Promise<Record[]> {
  return (await runInObjectStore<unknown[]>(storeName, "readonly", (store) => store.getAll())) as Record[];
}

export async function writeRecordToOfflineStore(storeName: PosObjectStoreName, record: unknown, key?: IDBValidKey): Promise<void> {
  await runInObjectStore(storeName, "readwrite", (store) => (key === undefined ? store.put(record) : store.put(record, key)));
}

export async function deleteRecordFromOfflineStore(storeName: PosObjectStoreName, key: IDBValidKey): Promise<void> {
  await runInObjectStore(storeName, "readwrite", (store) => store.delete(key));
}

export async function readKeyValueFromOfflineStore<Value>(key: string): Promise<Value | null> {
  return readRecordFromOfflineStore<Value>(posObjectStoreNames.keyValue, key).catch(() => null);
}

export async function writeKeyValueToOfflineStore(key: string, value: unknown): Promise<void> {
  await writeRecordToOfflineStore(posObjectStoreNames.keyValue, value, key).catch(() => undefined);
}
