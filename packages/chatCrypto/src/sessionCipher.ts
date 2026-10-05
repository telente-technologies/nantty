import { type Bytes, bytesEqual, decodeBase64, encodeBase64 } from "./bytes.util";
import type { PreKeyBundle } from "./directory";
import { type RatchetState, initializeInitiator, initializeResponder, ratchetDecrypt, ratchetEncrypt } from "./doubleRatchet";
import { ChatCryptoError, isChatCryptoError } from "./errors";
import type { DeviceIdentity } from "./keys";
import type { RandomSource } from "./primitives";
import type { ProtocolStore, SessionRecord } from "./protocolStore";
import { type RatchetWireMessage, decodePairwiseMessage, encodePairwiseMessage } from "./wireMessage";
import { initiateX3dh, respondX3dh } from "./x3dh";

const maximumArchivedStates = 5;
const rememberedBaseKeys = 64;

type StoredSessionRecord = SessionRecord & { readonly seenBaseKeys?: readonly string[] };

const withCurrent = (record: StoredSessionRecord, state: RatchetState, seenBaseKey?: Bytes): StoredSessionRecord => ({
  current: state,
  archived: [record.current, ...record.archived].filter((candidate): candidate is RatchetState => candidate !== null && candidate !== state).slice(0, maximumArchivedStates),
  seenBaseKeys: seenBaseKey === undefined ? record.seenBaseKeys : [...(record.seenBaseKeys ?? []), encodeBase64(seenBaseKey)].slice(-rememberedBaseKeys),
});

export class SessionCipher {
  public constructor(private readonly store: ProtocolStore, private readonly identity: DeviceIdentity, private readonly random: RandomSource) {}

  public async hasSession(userId: string, deviceId: string): Promise<boolean> {
    return (await this.store.loadSession(userId, deviceId)).current !== null;
  }

  public async initiateFromBundle(bundle: PreKeyBundle): Promise<void> {
    const keys = {
      identityKey: decodeBase64(bundle.identityKey), signedPreKeyId: bundle.signedPreKey.keyId, signedPreKey: decodeBase64(bundle.signedPreKey.publicKey),
      signedPreKeySignature: decodeBase64(bundle.signedPreKey.signature), oneTimePreKeyId: bundle.oneTimePreKey?.keyId ?? null,
      oneTimePreKey: bundle.oneTimePreKey === null ? null : decodeBase64(bundle.oneTimePreKey.publicKey),
    };
    const x3dh = initiateX3dh(this.identity, keys, this.random);
    const state = initializeInitiator(x3dh, keys.signedPreKey, keys.identityKey, { signedPreKeyId: keys.signedPreKeyId, oneTimePreKeyId: keys.oneTimePreKeyId }, this.random);
    const record = await this.store.loadSession(bundle.userId, bundle.deviceId);
    await this.store.saveSession(bundle.userId, bundle.deviceId, withCurrent(record, state));
  }

  public async encrypt(userId: string, deviceId: string, plaintext: Bytes): Promise<Bytes> {
    const record = await this.store.loadSession(userId, deviceId);
    if (record.current === null) throw new ChatCryptoError("NO_SESSION", "There is no session with this device.");
    const { state, header, ciphertext } = ratchetEncrypt(record.current, plaintext);
    await this.store.saveSession(userId, deviceId, { ...record, current: state });
    const message: RatchetWireMessage = { type: "message", header, ciphertext };
    if (state.pendingPreKey === null) return encodePairwiseMessage(message);
    return encodePairwiseMessage({
      type: "preKey", registrationId: this.identity.registrationId, identityKey: this.identity.signing.publicKey, baseKey: state.baseKey,
      signedPreKeyId: state.pendingPreKey.signedPreKeyId, oneTimePreKeyId: state.pendingPreKey.oneTimePreKeyId, message,
    });
  }

  public async decrypt(userId: string, deviceId: string, bytes: Bytes, isTrustedIdentity: (identityKey: Bytes) => Promise<boolean>): Promise<Bytes> {
    const wire = decodePairwiseMessage(bytes);
    const record: StoredSessionRecord = await this.store.loadSession(userId, deviceId);
    const message = wire.type === "message" ? wire : wire.message;
    if (wire.type === "message" || [record.current, ...record.archived].some((state) => state !== null && bytesEqual(state.baseKey, wire.baseKey))) {
      return this.decryptWithExistingStates(userId, deviceId, record, message);
    }
    if ((record.seenBaseKeys ?? []).includes(encodeBase64(wire.baseKey))) throw new ChatCryptoError("DUPLICATE_MESSAGE", "This message was already received.");
    if (!(await isTrustedIdentity(wire.identityKey))) throw new ChatCryptoError("UNTRUSTED_IDENTITY", "The sender's identity key is not the one on record.");
    const signedPreKey = await this.store.loadSignedPreKey(wire.signedPreKeyId);
    const oneTimePreKey = wire.oneTimePreKeyId === null ? null : await this.store.loadOneTimePreKey(wire.oneTimePreKeyId);
    if (signedPreKey === null || (wire.oneTimePreKeyId !== null && oneTimePreKey === null)) throw new ChatCryptoError("PREKEY_NOT_FOUND", "The prekey for this message is gone.");
    const x3dh = respondX3dh(this.identity, signedPreKey.keyPair, oneTimePreKey?.keyPair ?? null, wire.identityKey, wire.baseKey);
    const responder = initializeResponder(x3dh, signedPreKey.keyPair, wire.identityKey, wire.baseKey);
    const { state, plaintext } = ratchetDecrypt(responder, message.header, message.ciphertext, this.random);
    await this.store.saveSession(userId, deviceId, withCurrent(record, state, wire.baseKey));
    if (oneTimePreKey !== null) await this.store.removeOneTimePreKey(oneTimePreKey.keyId);
    return plaintext;
  }

  private async decryptWithExistingStates(userId: string, deviceId: string, record: StoredSessionRecord, message: RatchetWireMessage): Promise<Bytes> {
    const candidates = [record.current, ...record.archived].filter((state): state is RatchetState => state !== null);
    if (candidates.length === 0) throw new ChatCryptoError("NO_SESSION", "There is no session with this device.");
    const failures: unknown[] = [];
    for (const candidate of candidates) {
      try {
        const { state, plaintext } = ratchetDecrypt(candidate, message.header, message.ciphertext, this.random);
        const promoted = candidate === record.current ? { ...record, current: state } : withCurrent({ ...record, archived: record.archived.filter((entry) => entry !== candidate) }, state);
        await this.store.saveSession(userId, deviceId, promoted);
        return plaintext;
      } catch (error) {
        failures.push(error);
      }
    }
    const duplicate = failures.find((error) => isChatCryptoError(error, "DUPLICATE_MESSAGE"));
    throw duplicate ?? failures.find((error) => isChatCryptoError(error)) ?? new ChatCryptoError("INVALID_MESSAGE", "The message could not be decrypted.");
  }

  public async reset(userId: string, deviceId: string): Promise<void> {
    await this.store.deleteSession(userId, deviceId);
  }
}
