import { type ChatCryptoStorage, type KeyValueStore, type Sealer, SealedKeyValueStore } from "@zudomart/chat-crypto";

const databaseName = "zudomart-seller-chat-crypto";
const storeNames = ["secrets", "records", "previews", "wrapping"] as const;
type StoreName = (typeof storeNames)[number];

let databasePromise: Promise<IDBDatabase> | null = null;
let sealer: Sealer | null = null;

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

function openDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => storeNames.forEach((name) => request.result.objectStoreNames.contains(name) || request.result.createObjectStore(name));
    request.onsuccess = () => {
      request.result.onversionchange = () => void closeSellerChatCryptoDatabase();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
  return databasePromise;
}

async function withStore<T>(name: StoreName, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return requestToPromise(run(database.transaction(name, mode).objectStore(name)));
}

class IndexedDbKeyValueStore implements KeyValueStore {
  public constructor(private readonly name: StoreName) {}

  public async get(key: string) {
    const value = await withStore<unknown>(this.name, "readonly", (store) => store.get(key));
    return typeof value === "string" ? value : null;
  }

  public async set(key: string, value: string) {
    await withStore(this.name, "readwrite", (store) => store.put(value, key));
  }

  public async delete(key: string) {
    await withStore(this.name, "readwrite", (store) => store.delete(key));
  }

  public async keys(prefix: string) {
    const range = prefix === "" ? undefined : IDBKeyRange.bound(prefix, `${prefix}￿`);
    return (await withStore(this.name, "readonly", (store) => store.getAllKeys(range))).map(String);
  }
}

async function loadWrappingKey(): Promise<CryptoKey> {
  const existing = await withStore<unknown>("wrapping", "readonly", (store) => store.get("storage"));
  if (existing instanceof CryptoKey) return existing;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await withStore("wrapping", "readwrite", (store) => store.put(key, "storage"));
  return key;
}

function browserSealer(): Sealer {
  if (sealer !== null) return sealer;
  const keyPromise = loadWrappingKey();
  sealer = {
    seal: async (plaintext, associatedData) => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: associatedData as BufferSource }, await keyPromise, plaintext as BufferSource));
      const output = new Uint8Array(iv.length + sealed.length);
      output.set(iv);
      output.set(sealed, iv.length);
      return output;
    },
    open: async (sealed, associatedData) =>
      new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: sealed.slice(0, 12), additionalData: associatedData as BufferSource }, await keyPromise, sealed.slice(12) as BufferSource)),
  };
  return sealer;
}

export function createSellerChatCryptoStorage(): ChatCryptoStorage {
  return { secrets: new SealedKeyValueStore(new IndexedDbKeyValueStore("secrets"), browserSealer()), records: new SealedKeyValueStore(new IndexedDbKeyValueStore("records"), browserSealer()) };
}

export function createSealedPreviewStore(): KeyValueStore {
  return new SealedKeyValueStore(new IndexedDbKeyValueStore("previews"), browserSealer());
}

export async function closeSellerChatCryptoDatabase(): Promise<void> {
  const open = databasePromise;
  databasePromise = null;
  sealer = null;
  (await open?.catch(() => null))?.close();
}

export async function deleteSellerChatCryptoDatabase(): Promise<void> {
  await closeSellerChatCryptoDatabase();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}
