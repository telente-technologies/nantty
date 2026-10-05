import { type Bytes, decodeBase64, encodeBase64, utf8Decode, utf8Encode } from "./bytes.util";
import { type RandomSource, aeadNonceLength, openAead, sealAead } from "./primitives";

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}

export interface Sealer {
  seal(plaintext: Bytes, associatedData: Bytes): Promise<Bytes>;
  open(sealed: Bytes, associatedData: Bytes): Promise<Bytes>;
}

export class MemoryKeyValueStore implements KeyValueStore {
  private readonly entries = new Map<string, string>();

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
