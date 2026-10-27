import { type Bytes, bytesEqual, concatBytes, decodeBase64, encodeBase64, utf8Encode } from "./bytes.util";
import type { KeyDirectory } from "./directory";
import { type MessageEnvelope, encodeEnvelope, encryptionProtocol, parseEnvelope } from "./envelope";
import { ChatCryptoError, type ChatCryptoErrorCode, isChatCryptoError } from "./errors";
import { computeSecurityCode, hasUnacknowledgedChange } from "./identityTrust";
import { createAndRegisterDevice, maintainDeviceKeys } from "./deviceRegistration";
import { drainMailbox, shouldUseMailbox } from "./mailbox";
import { type GroupAttributes, createGroupKey, openGroupAttributes, sealGroupAttributes } from "./groupAttributes";
import { assertPayloadMatchesServer } from "./payloadBinding";
import type { DeviceIdentity } from "./keys";
import { openLinkPreview, sealLinkPreview } from "./linkPreviewSeal";
import { type ChatPayload, type ChatPayloadInput, decodePayload, encodePayload } from "./payload";
import { type RandomSource, aeadKeyLength, aeadNonceLength, defaultRandomSource, openAead, sealAead, sha256Digest } from "./primitives";
import { type ChatCryptoStorage, ProtocolStore } from "./protocolStore";
import { RecipientResolver, type ResolvedDevice } from "./recipients";
import { applyDistribution, createOwnSenderKey, decodeDistribution, encodeDistribution, groupDecrypt, groupEncrypt } from "./senderKeys";
import { SessionCipher } from "./sessionCipher";

export interface ChatCryptoClientOptions {
  readonly storage: ChatCryptoStorage;
  readonly directory: KeyDirectory;
  readonly random?: RandomSource;
  readonly now?: () => Date;
  readonly allowMissingRecipients?: boolean;
  readonly lock?: CrossContextLock;
}

export type CrossContextLock = <T>(task: () => Promise<T>) => Promise<T>;

export interface EncryptionTarget {
  readonly kind: "direct" | "group";
  readonly conversationId: string | null;
  readonly memberUserIds: readonly string[];
}

export interface MessageEncryption {
  readonly deviceId: string;
  readonly ciphertext: string;
  readonly protocol: typeof encryptionProtocol;
}

export interface EncryptedOutgoingMessage {
  readonly encryption: MessageEncryption;
  readonly linkPreview: string | null;
  readonly confirmSent: (messageId: string | null, expiresAt?: string | null) => Promise<void>;
}

export interface IncomingMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly createdAt?: string;
  readonly linkPreview?: unknown;
  readonly expiresAt?: string | null;
  readonly sharedContent?: unknown;
  readonly encryption?: { readonly deviceId: string; readonly ciphertext: string | null; readonly protocol?: string } | null;
}

export type DecryptionFailure = ChatCryptoErrorCode | "UNKNOWN" | "SENT_FROM_THIS_DEVICE";
export type DecryptionResult = { readonly status: "decrypted"; readonly payload: ChatPayload } | { readonly status: "failed"; readonly reason: DecryptionFailure } | { readonly status: "unencrypted" };

const payloadEntryTag = 0x05;

function withLinkPreview(result: DecryptionResult, sealed: unknown): DecryptionResult {
  if (result.status !== "decrypted" || result.payload.linkPreview || result.payload.linkPreviewKey === undefined || typeof sealed !== "string") return result;
  return { status: "decrypted", payload: { ...result.payload, linkPreview: openLinkPreview(sealed, result.payload.linkPreviewKey) } };
}
const retryableFailures = new Set<ChatCryptoErrorCode>(["DUPLICATE_MESSAGE", "NO_SENDER_KEY"]);
const readinessRecheckMilliseconds = 10 * 60_000;
const mailboxRecheckMilliseconds = 3_000;
const payloadAssociatedData = (userId: string, deviceId: string) => utf8Encode(`nantty-payload-v1|${userId}|${deviceId}`);
const addressKey = (device: { readonly userId: string; readonly deviceId: string }) => `${device.userId}:${device.deviceId}`;

export class ChatCryptoClient {
  private readonly store: ProtocolStore;
  private readonly random: RandomSource;
  private readonly now: () => Date;
  private readonly recipients: RecipientResolver;
  private identity: DeviceIdentity | null = null;
  private readyCheckedAt = 0;
  private mailboxCheckedAt = 0;
  private queue: Promise<unknown> = Promise.resolve();

  public constructor(private readonly options: ChatCryptoClientOptions) {
    this.store = new ProtocolStore(options.storage);
    this.random = options.random ?? defaultRandomSource;
    this.now = options.now ?? (() => new Date());
    this.recipients = new RecipientResolver(this.store, options.directory, this.now);
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const lock = this.options.lock;
    const guarded = lock === undefined ? task : () => lock(task);
    const run = this.queue.then(guarded, guarded);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private get context() {
    return { store: this.store, directory: this.options.directory, random: this.random, now: this.now };
  }

  public ensureReady(userId: string): Promise<DeviceIdentity> {
    return this.exclusive(async () => {
      let identity = await this.store.loadIdentity();
      if (identity === null || identity.userId !== userId) {
        identity = await createAndRegisterDevice(this.context, userId);
        this.readyCheckedAt = this.now().getTime();
      } else if (this.now().getTime() - this.readyCheckedAt > readinessRecheckMilliseconds) {
        const maintained = await maintainDeviceKeys(this.context, identity).then(() => true, () => false);
        if (maintained) this.readyCheckedAt = this.now().getTime();
      }
      this.identity = identity;
      return identity;
    });
  }

  private requireIdentity(): DeviceIdentity {
    if (this.identity === null) throw new ChatCryptoError("NOT_REGISTERED", "Secure chat is not set up on this device yet.");
    return this.identity;
  }

  private cipher(identity: DeviceIdentity) {
    return new SessionCipher(this.store, identity, this.random);
  }

  public encryptMessage(target: EncryptionTarget, input: ChatPayloadInput): Promise<EncryptedOutgoingMessage> {
    return this.exclusive(async () => {
      const identity = this.requireIdentity();
      const sealedPreview = input.linkPreview ? sealLinkPreview(input.linkPreview, this.random) : null;
      const groupKey = target.kind === "group" && target.conversationId !== null ? (await this.store.loadGroupKeys(target.conversationId))[0]?.key : undefined;
      const payloadInput = {
        ...input, linkPreview: null, ...(sealedPreview === null ? {} : { linkPreviewKey: sealedPreview.key }), ...(target.conversationId === null ? {} : { conversationId: target.conversationId }),
        ...(groupKey === undefined ? {} : { groupKey }),
      };
      const payload = encodePayload(payloadInput, this.now());
      const resolved = await this.recipients.resolve([...target.memberUserIds, identity.userId]);
      const candidates = resolved.filter((device) => !(device.userId === identity.userId && device.deviceId === identity.deviceId));
      const cipher = this.cipher(identity);
      const devices = await this.recipients.ensureSessions(cipher, candidates);
      if (!this.options.allowMissingRecipients && !devices.some((device) => device.userId !== identity.userId)) {
        throw new ChatCryptoError("NO_RECIPIENT_DEVICES", "Nobody in this chat has set up secure chat yet.");
      }
      const parsedPayload = { ...decodePayload(payload), linkPreview: sealedPreview === null ? null : (input.linkPreview ?? null) };
      const cache = (messageId: string | null, expiresAt?: string | null) => (messageId === null ? Promise.resolve() : this.store.savePlaintext(messageId, { payload: parsedPayload, failure: null, expiresAt: expiresAt ?? null }));
      if (target.kind === "group" && target.conversationId !== null) return { ...(await this.encryptForGroup(identity, cipher, target.conversationId, devices, payload, cache)), linkPreview: sealedPreview?.sealed ?? null };
      const envelope = await this.encryptPairwise(identity, cipher, devices, payload);
      return { encryption: this.toEncryption(identity, envelope), linkPreview: sealedPreview?.sealed ?? null, confirmSent: (messageId, expiresAt) => this.exclusive(() => cache(messageId, expiresAt)) };
    });
  }

  private toEncryption(identity: DeviceIdentity, envelope: MessageEnvelope): MessageEncryption {
    return { deviceId: identity.deviceId, ciphertext: encodeEnvelope(envelope), protocol: encryptionProtocol };
  }

  private async encryptPairwise(identity: DeviceIdentity, cipher: SessionCipher, devices: readonly ResolvedDevice[], payload: Bytes): Promise<MessageEnvelope> {
    const payloadKey = this.random(aeadKeyLength);
    const nonce = this.random(aeadNonceLength);
    const sealed = sealAead(payloadKey, nonce, payload, payloadAssociatedData(identity.userId, identity.deviceId));
    const entryPlaintext = concatBytes(new Uint8Array([payloadEntryTag]), payloadKey, sha256Digest(concatBytes(nonce, sealed)));
    const entries = [];
    for (const device of devices) entries.push({ u: device.userId, d: device.deviceId, b: encodeBase64(await cipher.encrypt(device.userId, device.deviceId, entryPlaintext)) });
    return { v: 1, t: "p", s: identity.deviceId, p: encodeBase64(sealed), n: encodeBase64(nonce), r: entries };
  }

  private async encryptForGroup(identity: DeviceIdentity, cipher: SessionCipher, conversationId: string, devices: readonly ResolvedDevice[], payload: Bytes, cache: (messageId: string | null, expiresAt?: string | null) => Promise<void>): Promise<Omit<EncryptedOutgoingMessage, "linkPreview">> {
    const current = new Set(devices.map(addressKey));
    let own = await this.store.loadOwnSenderKey(conversationId);
    if (own === null || own.distributedTo.some((address) => !current.has(address))) own = createOwnSenderKey(this.random, this.now().getTime());
    const distribution = encodeDistribution(conversationId, own);
    const entries = [];
    const needing = devices.filter((device) => !own.distributedTo.includes(addressKey(device)));
    for (const device of needing) entries.push({ u: device.userId, d: device.deviceId, b: encodeBase64(await cipher.encrypt(device.userId, device.deviceId, distribution)) });
    const mailboxEntries = entries.map((entry) => ({ userId: entry.u, deviceId: entry.d, ciphertext: entry.b }));
    const viaMailbox = shouldUseMailbox(mailboxEntries);
    if (viaMailbox) await this.options.directory.depositMailbox(identity.deviceId, conversationId, mailboxEntries);
    const encrypted = groupEncrypt(own, conversationId, identity.userId, identity.deviceId, payload);
    await this.store.saveOwnSenderKey(conversationId, encrypted.own);
    const envelope: MessageEnvelope = { v: 1, t: "g", s: identity.deviceId, g: encodeBase64(encrypted.message), r: viaMailbox ? [] : entries };
    const keyId = own.keyId;
    const confirmSent = (messageId: string | null, expiresAt?: string | null) => this.exclusive(async () => {
      const latest = await this.store.loadOwnSenderKey(conversationId);
      if (latest !== null && latest.keyId === keyId) {
        await this.store.saveOwnSenderKey(conversationId, { ...latest, distributedTo: [...new Set([...latest.distributedTo, ...needing.map(addressKey)])] });
      }
      await cache(messageId, expiresAt);
    });
    return { encryption: this.toEncryption(identity, envelope), confirmSent };
  }

  public decryptMessage(message: IncomingMessage): Promise<DecryptionResult> {
    return this.exclusive(async () => withLinkPreview(await this.decryptUnlocked(message), message.linkPreview));
  }

  public async decryptMessages(messages: readonly IncomingMessage[]): Promise<Map<string, DecryptionResult>> {
    const ordered = [...messages].sort((left, right) => (left.createdAt ?? "").localeCompare(right.createdAt ?? "") || left.id.localeCompare(right.id));
    const results = new Map<string, DecryptionResult>();
    for (const message of ordered) results.set(message.id, await this.decryptMessage(message));
    return results;
  }

  private async decryptUnlocked(message: IncomingMessage): Promise<DecryptionResult> {
    const cached = await this.loadLivePlaintext(message.id);
    if (cached !== null) return cached.payload === null ? { status: "failed", reason: (cached.failure ?? "UNKNOWN") as DecryptionFailure } : { status: "decrypted", payload: cached.payload };
    const encryption = message.encryption;
    if (encryption === undefined || encryption === null || encryption.ciphertext === null || encryption.ciphertext === "") return { status: "unencrypted" };
    const identity = this.requireIdentity();
    if (message.senderId === identity.userId && encryption.deviceId === identity.deviceId) return { status: "failed", reason: "SENT_FROM_THIS_DEVICE" };
    try {
      const envelope = parseEnvelope(encryption.ciphertext);
      if (envelope.s !== encryption.deviceId) throw new ChatCryptoError("INVALID_MESSAGE", "The envelope sender device does not match.");
      const payloadBytes = await this.openEnvelope(identity, message, envelope).catch(async (error: unknown) => {
        if (!isChatCryptoError(error, "NO_SENDER_KEY") || !(await this.drainMailboxThrottled(identity))) throw error;
        return this.openEnvelope(identity, message, envelope);
      });
      const payload = decodePayload(payloadBytes);
      assertPayloadMatchesServer(payload, message);
      if (envelope.t === "g" && payload.groupKey !== undefined) await this.store.addGroupKey(message.conversationId, { key: payload.groupKey, at: [payload.sentAt, this.now().toISOString()].sort()[0] as string });
      await this.store.savePlaintext(message.id, { payload, failure: null, expiresAt: message.expiresAt ?? null });
      return { status: "decrypted", payload };
    } catch (error) {
      if (!isChatCryptoError(error)) return { status: "failed", reason: "UNKNOWN" };
      if (!retryableFailures.has(error.code)) await this.store.savePlaintext(message.id, { payload: null, failure: error.code, expiresAt: message.expiresAt ?? null });
      return { status: "failed", reason: error.code };
    }
  }

  private trustCheck(senderId: string, senderDeviceId: string) {
    return async (identityKey: Bytes) => {
      const lookup = async (fresh: boolean) => (await this.recipients.resolve([senderId], { fresh })).find((device) => device.deviceId === senderDeviceId);
      const listed = (await lookup(false)) ?? (await lookup(true));
      return listed !== undefined && bytesEqual(decodeBase64(listed.identityKey), identityKey);
    };
  }

  private async drainMailboxThrottled(identity: DeviceIdentity): Promise<boolean> {
    const nowMs = this.now().getTime();
    if (nowMs - this.mailboxCheckedAt < mailboxRecheckMilliseconds) return false;
    this.mailboxCheckedAt = nowMs;
    const applied = await drainMailbox({ store: this.store, directory: this.options.directory, cipher: this.cipher(identity), deviceId: identity.deviceId, isTrusted: (senderId, deviceId) => this.trustCheck(senderId, deviceId) }).catch(() => 0);
    return applied > 0;
  }

  private async loadLivePlaintext(messageId: string) {
    const cached = await this.store.loadPlaintext(messageId);
    if (cached?.expiresAt && cached.expiresAt <= this.now().toISOString()) {
      await this.store.deletePlaintext(messageId);
      return null;
    }
    return cached;
  }

  public purgeExpiredPlaintext(): Promise<number> {
    return this.exclusive(async () => {
      let purged = 0;
      for (const messageId of await this.store.plaintextMessageIds()) if ((await this.store.loadPlaintext(messageId)) !== null && (await this.loadLivePlaintext(messageId)) === null) purged += 1;
      return purged;
    });
  }

  private async openEnvelope(identity: DeviceIdentity, message: IncomingMessage, envelope: MessageEnvelope): Promise<Bytes> {
    const cipher = this.cipher(identity);
    const entry = envelope.r.find((candidate) => candidate.u === identity.userId && candidate.d === identity.deviceId);
    const isTrusted = this.trustCheck(message.senderId, envelope.s);
    const openEntry = async () => {
      if (entry === undefined) throw new ChatCryptoError("NOT_FOR_THIS_DEVICE", "This message was not encrypted for this device.");
      return cipher.decrypt(message.senderId, envelope.s, decodeBase64(entry.b), isTrusted);
    };
    if (envelope.t === "p") {
      const inner = await openEntry();
      if (inner.length !== 65 || inner[0] !== payloadEntryTag) throw new ChatCryptoError("INVALID_MESSAGE", "The payload key entry is malformed.");
      const sealed = decodeBase64(envelope.p);
      const nonce = decodeBase64(envelope.n);
      if (!bytesEqual(inner.slice(33), sha256Digest(concatBytes(nonce, sealed)))) throw new ChatCryptoError("PAYLOAD_MISMATCH", "The payload does not match its key entry.");
      try {
        return openAead(inner.slice(1, 33), nonce, sealed, payloadAssociatedData(message.senderId, envelope.s));
      } catch {
        throw new ChatCryptoError("INVALID_MESSAGE", "The payload could not be authenticated.");
      }
    }
    let record = await this.store.loadPeerSenderKey(message.conversationId, message.senderId, envelope.s);
    if (entry !== undefined) {
      const distribution = decodeDistribution(await openEntry());
      if (distribution.conversationId !== message.conversationId) throw new ChatCryptoError("PAYLOAD_MISMATCH", "The sender key belongs to another conversation.");
      record = applyDistribution(record, distribution);
      await this.store.savePeerSenderKey(message.conversationId, message.senderId, envelope.s, record);
    }
    const decrypted = groupDecrypt(record, message.conversationId, message.senderId, envelope.s, decodeBase64(envelope.g));
    await this.store.savePeerSenderKey(message.conversationId, message.senderId, envelope.s, decrypted.record);
    return decrypted.plaintext;
  }

  public prepareNewGroup(attributes: GroupAttributes): { readonly groupKey: string; readonly encryptedAttributes: string } {
    const groupKey = createGroupKey(this.random);
    return { groupKey, encryptedAttributes: sealGroupAttributes(attributes, groupKey, this.random) };
  }

  public rememberGroupKey(conversationId: string, groupKey: string): Promise<void> {
    return this.exclusive(async () => void (await this.store.addGroupKey(conversationId, { key: groupKey, at: this.now().toISOString() })));
  }

  public hasGroupKey(conversationId: string): Promise<boolean> {
    return this.exclusive(async () => (await this.store.loadGroupKeys(conversationId)).length > 0);
  }

  public sealGroupAttributes(conversationId: string, attributes: GroupAttributes, options: { readonly rotate?: boolean } = {}): Promise<string> {
    return this.exclusive(async () => {
      let key = (await this.store.loadGroupKeys(conversationId))[0]?.key;
      if (key === undefined || options.rotate === true) {
        key = createGroupKey(this.random);
        await this.store.addGroupKey(conversationId, { key, at: this.now().toISOString() });
      }
      return sealGroupAttributes(attributes, key, this.random);
    });
  }

  public openGroupAttributes(conversationId: string, sealed: string | null | undefined): Promise<GroupAttributes | null> {
    return this.exclusive(async () => (sealed ? openGroupAttributes(sealed, (await this.store.loadGroupKeys(conversationId)).map((entry) => entry.key)) : null));
  }

  public rememberPlaintext(messageId: string, payload: ChatPayload): Promise<void> {
    return this.exclusive(() => this.store.savePlaintext(messageId, { payload, failure: null, expiresAt: null }));
  }

  public forgetMessages(messageIds: readonly string[]): Promise<void> {
    return this.exclusive(async () => {
      for (const messageId of messageIds) await this.store.deletePlaintext(messageId);
    });
  }

  public identityChanges(userIds: readonly string[]): Promise<string[]> {
    return this.exclusive(async () => {
      await this.recipients.resolve(userIds);
      const changed: string[] = [];
      for (const userId of new Set(userIds)) if (hasUnacknowledgedChange(await this.store.loadTrust(userId))) changed.push(userId);
      return changed;
    });
  }

  public acknowledgeIdentityChange(userId: string): Promise<void> {
    return this.exclusive(async () => {
      const record = await this.store.loadTrust(userId);
      if (record !== null) await this.store.saveTrust(userId, { ...record, acknowledgedAt: this.now().toISOString() });
    });
  }

  public securityCode(peerUserId: string): Promise<string> {
    return this.exclusive(async () => {
      const identity = this.requireIdentity();
      const devices = await this.recipients.resolve([identity.userId, peerUserId], { fresh: true });
      const keysOf = (userId: string) => devices.filter((device) => device.userId === userId).map((device) => device.identityKey);
      return computeSecurityCode({ userId: identity.userId, identityKeys: keysOf(identity.userId) }, { userId: peerUserId, identityKeys: keysOf(peerUserId) });
    });
  }

  public resetSessions(userId: string): Promise<void> {
    return this.exclusive(async () => {
      for (const deviceId of await this.store.sessionDeviceIds(userId)) await this.store.deleteSession(userId, deviceId);
      this.recipients.forget(userId);
    });
  }

  public hasDeviceIdentity(userId: string): Promise<boolean> {
    return this.exclusive(async () => ((this.identity ?? (await this.store.loadIdentity()))?.userId ?? null) === userId);
  }

  public signOut(options: { readonly removeFromDirectory: boolean }): Promise<void> {
    return this.exclusive(async () => {
      const identity = this.identity ?? (await this.store.loadIdentity());
      if (identity !== null && options.removeFromDirectory) await this.options.directory.removeDevice(identity.deviceId).catch(() => undefined);
      await this.store.clearEverything();
      this.identity = null;
      this.readyCheckedAt = 0;
    });
  }

  public get deviceId(): string | null {
    return this.identity?.deviceId ?? null;
  }
}
