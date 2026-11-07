import type { RatchetState } from "./doubleRatchet";
import type { DeviceIdentity, OneTimePreKey, SignedPreKey } from "./keys";
import type { ChatPayload } from "./payload";
import type { OwnSenderKey, PeerSenderKeyRecord } from "./senderKeys";
import { type KeyValueOperation, type KeyValueStore, deserializeRecord, serializeRecord } from "./storage";
import type { TrustRecord } from "./identityTrust";

export interface SessionRecord {
  readonly current: RatchetState | null;
  readonly archived: readonly RatchetState[];
}

export interface PreKeyCounters {
  readonly nextOneTimePreKeyId: number;
  readonly currentSignedPreKeyId: number;
  readonly previousSignedPreKeyIds: readonly number[];
}

export interface CachedPlaintext {
  readonly payload: ChatPayload | null;
  readonly failure: string | null;
  readonly expiresAt?: string | null;
}

export interface StoredGroupKey {
  readonly key: string;
  readonly at: string;
}

export interface ChatCryptoStorage {
  readonly secrets: KeyValueStore;
  readonly records: KeyValueStore;
}

const address = (userId: string, deviceId: string) => `${userId}:${deviceId}`;

export class ProtocolStore {
  public constructor(private readonly storage: ChatCryptoStorage) {}

  private async read<T>(store: KeyValueStore, key: string): Promise<T | null> {
    const text = await store.get(key);
    return text === null ? null : deserializeRecord<T>(text);
  }

  private write(store: KeyValueStore, key: string, value: unknown) {
    return store.set(key, serializeRecord(value));
  }

  public loadIdentity = () => this.read<DeviceIdentity>(this.storage.secrets, "identity");
  public saveIdentity = (identity: DeviceIdentity) => this.write(this.storage.secrets, "identity", identity);

  public loadCounters = () => this.read<PreKeyCounters>(this.storage.records, "prekeys:counters");
  public saveCounters = (counters: PreKeyCounters) => this.write(this.storage.records, "prekeys:counters", counters);
  public loadSignedPreKey = (keyId: number) => this.read<SignedPreKey>(this.storage.secrets, `spk:${keyId}`);
  public saveSignedPreKey = (key: SignedPreKey) => this.write(this.storage.secrets, `spk:${key.keyId}`, key);
  public removeSignedPreKey = (keyId: number) => this.storage.secrets.delete(`spk:${keyId}`);
  public loadOneTimePreKey = (keyId: number) => this.read<OneTimePreKey>(this.storage.records, `opk:${keyId}`);
  public saveOneTimePreKey = (key: OneTimePreKey) => this.write(this.storage.records, `opk:${key.keyId}`, key);
  public removeOneTimePreKey = (keyId: number) => this.storage.records.delete(`opk:${keyId}`);

  public loadSession = async (userId: string, deviceId: string): Promise<SessionRecord> =>
    (await this.read<SessionRecord>(this.storage.records, `session:${address(userId, deviceId)}`)) ?? { current: null, archived: [] };
  public saveSession = (userId: string, deviceId: string, record: SessionRecord) => this.write(this.storage.records, `session:${address(userId, deviceId)}`, record);
  public async saveSessionAndConsumeOneTimePreKey(userId: string, deviceId: string, record: SessionRecord, preKeyId: number): Promise<void> {
    const batch = this.storage.records.batch;
    if (batch === undefined) throw new Error("Atomic session and one-time prekey storage is required.");
    const operations: KeyValueOperation[] = [
      { type: "set", key: `session:${address(userId, deviceId)}`, value: serializeRecord(record) },
      { type: "delete", key: `opk:${preKeyId}` },
    ];
    await batch.call(this.storage.records, operations);
  }
  public deleteSession = (userId: string, deviceId: string) => this.storage.records.delete(`session:${address(userId, deviceId)}`);
  public async sessionDeviceIds(userId: string): Promise<string[]> {
    const prefix = `session:${userId}:`;
    return (await this.storage.records.keys(prefix)).map((key) => key.slice(prefix.length));
  }

  public loadOwnSenderKey = (conversationId: string) => this.read<OwnSenderKey>(this.storage.records, `senderKey:own:${conversationId}`);
  public saveOwnSenderKey = (conversationId: string, key: OwnSenderKey) => this.write(this.storage.records, `senderKey:own:${conversationId}`, key);
  public deleteOwnSenderKey = (conversationId: string) => this.storage.records.delete(`senderKey:own:${conversationId}`);
  public loadPeerSenderKey = (conversationId: string, userId: string, deviceId: string) =>
    this.read<PeerSenderKeyRecord>(this.storage.records, `senderKey:peer:${conversationId}:${address(userId, deviceId)}`);
  public savePeerSenderKey = (conversationId: string, userId: string, deviceId: string, record: PeerSenderKeyRecord) =>
    this.write(this.storage.records, `senderKey:peer:${conversationId}:${address(userId, deviceId)}`, record);

  public loadTrust = (userId: string) => this.read<TrustRecord>(this.storage.records, `trust:${userId}`);
  public saveTrust = (userId: string, record: TrustRecord) => this.write(this.storage.records, `trust:${userId}`, record);

  public loadGroupKeys = async (conversationId: string) => (await this.read<StoredGroupKey[]>(this.storage.secrets, `groupKeys:${conversationId}`)) ?? [];
  public async addGroupKey(conversationId: string, entry: StoredGroupKey): Promise<boolean> {
    const current = await this.loadGroupKeys(conversationId);
    if (current.some((candidate) => candidate.key === entry.key)) return false;
    const next = [...current, entry].sort((left, right) => right.at.localeCompare(left.at)).slice(0, 8);
    await this.write(this.storage.secrets, `groupKeys:${conversationId}`, next);
    return true;
  }

  public loadPlaintext = (messageId: string) => this.read<CachedPlaintext>(this.storage.records, `plain:${messageId}`);
  public savePlaintext = (messageId: string, cached: CachedPlaintext) => this.write(this.storage.records, `plain:${messageId}`, cached);
  public deletePlaintext = (messageId: string) => this.storage.records.delete(`plain:${messageId}`);
  public plaintextMessageIds = async () => (await this.storage.records.keys("plain:")).map((key) => key.slice("plain:".length));

  public async clearEverything(): Promise<void> {
    for (const store of [this.storage.secrets, this.storage.records]) {
      for (const key of await store.keys("")) await store.delete(key);
    }
  }
}
