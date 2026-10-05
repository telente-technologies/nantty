import { type Bytes, decodeBase64 } from "./bytes.util";
import type { KeyDirectory, MailboxEntryInput } from "./directory";
import { isChatCryptoError } from "./errors";
import type { ProtocolStore } from "./protocolStore";
import { applyDistribution, decodeDistribution } from "./senderKeys";
import type { SessionCipher } from "./sessionCipher";

export const inlineDistributionLimit = 24_000;
const retryableMailboxFailures = new Set(["UNTRUSTED_IDENTITY"]);

export const shouldUseMailbox = (entries: readonly MailboxEntryInput[]) => entries.reduce((total, entry) => total + entry.ciphertext.length + entry.userId.length + entry.deviceId.length + 20, 0) > inlineDistributionLimit;

export async function drainMailbox(options: {
  readonly store: ProtocolStore;
  readonly directory: KeyDirectory;
  readonly cipher: SessionCipher;
  readonly deviceId: string;
  readonly isTrusted: (senderId: string, senderDeviceId: string) => (identityKey: Bytes) => Promise<boolean>;
}): Promise<number> {
  const entries = await options.directory.fetchMailbox(options.deviceId);
  const handled: string[] = [];
  let applied = 0;
  for (const entry of entries) {
    try {
      const distribution = decodeDistribution(await options.cipher.decrypt(entry.senderId, entry.senderDeviceId, decodeBase64(entry.ciphertext), options.isTrusted(entry.senderId, entry.senderDeviceId)));
      if (distribution.conversationId === entry.conversationId) {
        const record = await options.store.loadPeerSenderKey(entry.conversationId, entry.senderId, entry.senderDeviceId);
        await options.store.savePeerSenderKey(entry.conversationId, entry.senderId, entry.senderDeviceId, applyDistribution(record, distribution));
        applied += 1;
      }
      handled.push(entry.id);
    } catch (error) {
      if (!(isChatCryptoError(error) && retryableMailboxFailures.has(error.code))) handled.push(entry.id);
    }
  }
  await options.directory.acknowledgeMailbox(options.deviceId, handled);
  return applied;
}
