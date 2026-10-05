import { encodeBase64 } from "./bytes.util";
import type { DeviceKeyStatus, KeyDirectory, WireOneTimePreKey, WireSignedPreKey } from "./directory";
import { type DeviceIdentity, type OneTimePreKey, type SignedPreKey, createDeviceIdentity, createOneTimePreKeys, createSignedPreKey, nextRandomKeyId } from "./keys";
import type { RandomSource } from "./primitives";
import type { PreKeyCounters, ProtocolStore } from "./protocolStore";

export const oneTimePreKeyBatchSize = 100;
export const oneTimePreKeyLowWater = 25;
export const signedPreKeyRotationMilliseconds = 7 * 86_400_000;
const keptPreviousSignedPreKeys = 2;

const toWireSignedPreKey = (key: SignedPreKey): WireSignedPreKey => ({ keyId: key.keyId, publicKey: encodeBase64(key.keyPair.publicKey), signature: encodeBase64(key.signature) });
const toWireOneTimePreKey = (key: OneTimePreKey): WireOneTimePreKey => ({ keyId: key.keyId, publicKey: encodeBase64(key.keyPair.publicKey) });

export interface RegistrationContext {
  readonly store: ProtocolStore;
  readonly directory: KeyDirectory;
  readonly random: RandomSource;
  readonly now: () => Date;
}

async function generateOneTimePreKeys(context: RegistrationContext, counters: PreKeyCounters, count: number): Promise<{ keys: OneTimePreKey[]; counters: PreKeyCounters }> {
  const keys = createOneTimePreKeys(counters.nextOneTimePreKeyId, count, context.random);
  for (const key of keys) await context.store.saveOneTimePreKey(key);
  const updated = { ...counters, nextOneTimePreKeyId: (((keys.at(-1)?.keyId ?? counters.nextOneTimePreKeyId) % 0x7fffffff) + 1) };
  await context.store.saveCounters(updated);
  return { keys, counters: updated };
}

async function registerWithDirectory(context: RegistrationContext, identity: DeviceIdentity, counters: PreKeyCounters): Promise<DeviceKeyStatus> {
  const signedPreKey = await context.store.loadSignedPreKey(counters.currentSignedPreKeyId);
  if (signedPreKey === null) throw new Error("The current signed prekey is missing.");
  const { keys } = await generateOneTimePreKeys(context, counters, oneTimePreKeyBatchSize);
  return context.directory.registerDevice(identity.deviceId, {
    registrationId: identity.registrationId, identityKey: encodeBase64(identity.signing.publicKey),
    signedPreKey: toWireSignedPreKey(signedPreKey), oneTimePreKeys: keys.map(toWireOneTimePreKey),
  });
}

export async function createAndRegisterDevice(context: RegistrationContext, userId: string): Promise<DeviceIdentity> {
  await context.store.clearEverything();
  const identity = createDeviceIdentity(userId, context.random);
  const signedPreKey = createSignedPreKey(identity, nextRandomKeyId(context.random), context.random, context.now().getTime());
  const counters: PreKeyCounters = { nextOneTimePreKeyId: nextRandomKeyId(context.random), currentSignedPreKeyId: signedPreKey.keyId, previousSignedPreKeyIds: [] };
  await context.store.saveSignedPreKey(signedPreKey);
  await context.store.saveCounters(counters);
  await context.store.saveIdentity(identity);
  await registerWithDirectory(context, identity, counters);
  return identity;
}

async function rotateSignedPreKey(context: RegistrationContext, identity: DeviceIdentity, counters: PreKeyCounters): Promise<PreKeyCounters> {
  const signedPreKey = createSignedPreKey(identity, nextRandomKeyId(context.random), context.random, context.now().getTime());
  await context.store.saveSignedPreKey(signedPreKey);
  const previous = [counters.currentSignedPreKeyId, ...counters.previousSignedPreKeyIds];
  for (const expiredKeyId of previous.slice(keptPreviousSignedPreKeys)) await context.store.removeSignedPreKey(expiredKeyId);
  const updated = { ...counters, currentSignedPreKeyId: signedPreKey.keyId, previousSignedPreKeyIds: previous.slice(0, keptPreviousSignedPreKeys) };
  await context.store.saveCounters(updated);
  await context.directory.rotateSignedPreKey(identity.deviceId, toWireSignedPreKey(signedPreKey));
  return updated;
}

export async function maintainDeviceKeys(context: RegistrationContext, identity: DeviceIdentity): Promise<void> {
  let counters = await context.store.loadCounters();
  if (counters === null) throw new Error("Prekey counters are missing.");
  const status = await context.directory.fetchDeviceStatus(identity.deviceId);
  if (status === null || status.identityKey !== encodeBase64(identity.signing.publicKey)) {
    await registerWithDirectory(context, identity, counters);
    return;
  }
  const current = await context.store.loadSignedPreKey(counters.currentSignedPreKeyId);
  if (current === null || context.now().getTime() - current.createdAt > signedPreKeyRotationMilliseconds) counters = await rotateSignedPreKey(context, identity, counters);
  if (status.oneTimePreKeyCount < oneTimePreKeyLowWater) {
    const { keys } = await generateOneTimePreKeys(context, counters, oneTimePreKeyBatchSize - status.oneTimePreKeyCount);
    await context.directory.uploadOneTimePreKeys(identity.deviceId, keys.map(toWireOneTimePreKey));
  }
}
