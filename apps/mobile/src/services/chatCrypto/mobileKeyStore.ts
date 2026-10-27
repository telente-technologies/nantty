import { type ChatCryptoStorage, type KeyValueStore, SealedKeyValueStore, createAeadSealer, decodeBase64, encodeBase64 } from "@nantty/chat-crypto";
import { getRandomBytes } from "expo-crypto";
import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

import { secureStorage } from "@/utils/secureStorage.util";

const secureKeyPrefix = "nantty.chatCrypto.";
const secureIndexKey = `${secureKeyPrefix}index`;
const storageKeyName = `${secureKeyPrefix}storageKey`;

export const randomBytesFromDevice = (length: number) => getRandomBytes(length);

const toSecureStoreKey = (key: string) => `${secureKeyPrefix}${key.replace(/[^A-Za-z0-9._-]/g, "_")}`;

class SecureStoreKeyValueStore implements KeyValueStore {
  private async readIndex(): Promise<string[]> {
    const text = await secureStorage.get(secureIndexKey);
    return text === null ? [] : (JSON.parse(text) as string[]);
  }

  public get(key: string) {
    return secureStorage.get(toSecureStoreKey(key));
  }

  public async set(key: string, value: string) {
    await secureStorage.set(toSecureStoreKey(key), value);
    const index = await this.readIndex();
    if (!index.includes(key)) await secureStorage.set(secureIndexKey, JSON.stringify([...index, key]));
  }

  public async delete(key: string) {
    await secureStorage.remove(toSecureStoreKey(key));
    await secureStorage.set(secureIndexKey, JSON.stringify((await this.readIndex()).filter((candidate) => candidate !== key)));
  }

  public async keys(prefix: string) {
    return (await this.readIndex()).filter((key) => key.startsWith(prefix));
  }
}

let database: SQLiteDatabase | null = null;

function openRecordsDatabase(): SQLiteDatabase {
  if (database) return database;
  database = openDatabaseSync("nanttyChatCrypto.db");
  database.execSync("PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS records (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);");
  return database;
}

class SqliteKeyValueStore implements KeyValueStore {
  public async get(key: string) {
    return openRecordsDatabase().getFirstSync<{ value: string }>("SELECT value FROM records WHERE key = ?", [key])?.value ?? null;
  }

  public async set(key: string, value: string) {
    openRecordsDatabase().runSync("INSERT OR REPLACE INTO records (key, value) VALUES (?, ?)", [key, value]);
  }

  public async delete(key: string) {
    openRecordsDatabase().runSync("DELETE FROM records WHERE key = ?", [key]);
  }

  public async keys(prefix: string) {
    return openRecordsDatabase().getAllSync<{ key: string }>("SELECT key FROM records WHERE substr(key, 1, ?) = ?", [prefix.length, prefix]).map((row) => row.key);
  }
}

async function loadStorageKey(): Promise<Uint8Array> {
  const saved = await secureStorage.get(storageKeyName);
  if (saved !== null) return decodeBase64(saved);
  const created = randomBytesFromDevice(32);
  await secureStorage.set(storageKeyName, encodeBase64(created));
  return created;
}

class LazySealedStore implements KeyValueStore {
  private readonly ready = loadStorageKey().then((key) => new SealedKeyValueStore(new SqliteKeyValueStore(), createAeadSealer(key, randomBytesFromDevice)));

  public async get(key: string) {
    return (await this.ready).get(key);
  }

  public async set(key: string, value: string) {
    await (await this.ready).set(key, value);
  }

  public async delete(key: string) {
    await (await this.ready).delete(key);
  }

  public async keys(prefix: string) {
    return (await this.ready).keys(prefix);
  }
}

export const createMobileChatCryptoStorage = (): ChatCryptoStorage => ({ secrets: new SecureStoreKeyValueStore(), records: new LazySealedStore() });
