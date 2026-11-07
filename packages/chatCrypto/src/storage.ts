import { type Bytes, decodeBase64, encodeBase64, utf8Decode, utf8Encode } from "./bytes.util";
import { type RandomSource, aeadNonceLength, openAead, sealAead } from "./primitives";

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
  /** Applies all operations atomically within this store's namespace. */
  batch?(operations: readonly KeyValueOperation[]): Promise<void>;
}

export type KeyValueOperation = { readonly type: "set"; readonly key: string; readonly value: string } | { readonly type: "delete"; readonly key: string };

export interface Sealer {
  seal(plaintext: Bytes, associatedData: Bytes): Promise<Bytes>;
  open(sealed: Bytes, associatedData: Bytes): Promise<Bytes>;
}

export class MemoryKeyValueStore implements KeyValueStore {
  private entries = new Map<string, string>();

  public async get(key: string) {
    return this.entries.get(key) ?? null;
  }

  public async set(key: string, value: string) {
    this.entries.set(key, value);
  }

  public async delete(key: string) {
    this.entries.delete(key);
  }

  public async keys(prefix: string) {
    return [...this.entries.keys()].filter((key) => key.startsWith(prefix));
  }

  public async batch(operations: readonly KeyValueOperation[]) {
    const next = new Map(this.entries);
    for (const operation of operations) {
      if (operation.type === "set") next.set(operation.key, operation.value);
      else next.delete(operation.key);
    }
    this.entries = next;
  }

  public snapshot(): ReadonlyMap<string, string> {
    return new Map(this.entries);
  }
}

export function createAeadSealer(storageKey: Bytes, random: RandomSource): Sealer {
  if (storageKey.length !== 32) throw new RangeError("The storage key must be 32 bytes.");
  return {
    seal: async (plaintext, associatedData) => {
      const nonce = random(aeadNonceLength);
      const sealed = sealAead(storageKey, nonce, plaintext, associatedData);
      const output = new Uint8Array(nonce.length + sealed.length);
      output.set(nonce);
      output.set(sealed, nonce.length);
      return output;
    },
    open: async (sealed, associatedData) => openAead(storageKey, sealed.slice(0, aeadNonceLength), sealed.slice(aeadNonceLength), associatedData),
  };
}

export class SealedKeyValueStore implements KeyValueStore {
  public constructor(private readonly inner: KeyValueStore, private readonly sealer: Sealer) {}

  public async get(key: string) {
    const stored = await this.inner.get(key);
    if (stored === null) return null;
    return utf8Decode(await this.sealer.open(decodeBase64(stored), utf8Encode(key)));
  }

  public async set(key: string, value: string) {
    await this.inner.set(key, encodeBase64(await this.sealer.seal(utf8Encode(value), utf8Encode(key))));
  }

  public delete(key: string) {
    return this.inner.delete(key);
  }

  public async batch(operations: readonly KeyValueOperation[]) {
    if (this.inner.batch === undefined) throw new Error("The underlying key-value store does not support atomic batches.");
    const sealed: KeyValueOperation[] = await Promise.all(operations.map(async (operation) =>
      operation.type === "delete"
        ? operation
        : { type: "set", key: operation.key, value: encodeBase64(await this.sealer.seal(utf8Encode(operation.value), utf8Encode(operation.key))) },
    ));
    await this.inner.batch(sealed);
  }

  public keys(prefix: string) {
    return this.inner.keys(prefix);
  }
}

export function serializeRecord(value: unknown): string {
  return JSON.stringify(value, (_, candidate: unknown) => (candidate instanceof Uint8Array ? { $b64: encodeBase64(candidate) } : candidate));
}

export function deserializeRecord<T>(text: string): T {
  return JSON.parse(text, (_, candidate: unknown) => {
    if (candidate !== null && typeof candidate === "object" && "$b64" in candidate && typeof (candidate as { $b64: unknown }).$b64 === "string") {
      return decodeBase64((candidate as { $b64: string }).$b64);
    }
    return candidate;
  }) as T;
}

const sealedStringPrefix = "z1:";

export function sealString(key: Bytes, plaintext: string, associatedData: string, random: RandomSource): string {
  const nonce = random(aeadNonceLength);
  const sealed = sealAead(key, nonce, utf8Encode(plaintext), utf8Encode(associatedData));
  const output = new Uint8Array(nonce.length + sealed.length);
  output.set(nonce);
  output.set(sealed, nonce.length);
  return `${sealedStringPrefix}${encodeBase64(output)}`;
}

export const isSealedString = (stored: string): boolean => stored.startsWith(sealedStringPrefix);

export function openString(key: Bytes, stored: string, associatedData: string): string {
  if (!isSealedString(stored)) return stored;
  const bytes = decodeBase64(stored.slice(sealedStringPrefix.length));
  return utf8Decode(openAead(key, bytes.slice(0, aeadNonceLength), bytes.slice(aeadNonceLength), utf8Encode(associatedData)));
}
