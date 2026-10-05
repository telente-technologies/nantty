import { ChatCryptoClient } from "./chatCryptoClient";
import type { DeviceAddress, DeviceRegistrationRequest, MailboxEntryInput, WireOneTimePreKey, WireSignedPreKey } from "./directory";
import { InMemoryKeyDirectory } from "./memoryKeyDirectory";
import type { RandomSource } from "./primitives";
import { MemoryKeyValueStore } from "./storage";

export function createMockKeyDirectoryBackend(options: { readonly shouldProvisionPeer: (userId: string) => boolean; readonly random?: RandomSource }) {
  const directory = new InMemoryKeyDirectory();
  const peers = new Map<string, Promise<unknown>>();
  const provision = (userId: string) => {
    if (!options.shouldProvisionPeer(userId) || directory.list([userId])[0]?.devices.length) return Promise.resolve();
    let pending = peers.get(userId);
    if (pending === undefined) {
      const client = new ChatCryptoClient({ storage: { secrets: new MemoryKeyValueStore(), records: new MemoryKeyValueStore() }, directory: directory.forUser(userId), ...(options.random === undefined ? {} : { random: options.random }) });
      pending = client.ensureReady(userId);
      peers.set(userId, pending);
    }
    return pending;
  };
  const failWith = (error: unknown): never => {
    const message = error instanceof Error ? error.message : "INVALID";
    throw Object.assign(new Error(message), { code: message });
  };
  return {
    register: (userId: string, deviceId: string, request: DeviceRegistrationRequest) => {
      try {
        return directory.register(userId, deviceId, request);
      } catch (error) {
        return failWith(error);
      }
    },
    status: (userId: string, deviceId: string) => directory.status(userId, deviceId),
    uploadOneTimePreKeys: (userId: string, deviceId: string, keys: readonly WireOneTimePreKey[]) => directory.forUser(userId).uploadOneTimePreKeys(deviceId, keys).catch(failWith),
    rotateSignedPreKey: (userId: string, deviceId: string, signedPreKey: WireSignedPreKey) => directory.forUser(userId).rotateSignedPreKey(deviceId, signedPreKey).catch(failWith),
    remove: (userId: string, deviceId: string) => directory.forUser(userId).removeDevice(deviceId),
    listDevices: async (userIds: readonly string[]) => {
      await Promise.all(userIds.map(provision));
      return { data: directory.list(userIds) };
    },
    claimBundles: async (devices: readonly DeviceAddress[]) => ({ data: directory.claim(devices) }),
    depositMailbox: (userId: string, senderDeviceId: string, conversationId: string, entries: readonly MailboxEntryInput[]) => directory.deposit(userId, senderDeviceId, conversationId, entries),
    fetchMailbox: (userId: string, deviceId: string) => ({ data: directory.mailbox(userId, deviceId) }),
    acknowledgeMailbox: (userId: string, deviceId: string, ids: readonly string[]) => directory.acknowledge(userId, deviceId, ids),
  };
}
