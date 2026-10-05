import type { Db } from "../../../types/database.type.js";
import type { WireOneTimePreKey, WireSignedPreKey } from "../models/messagingKeys.model.js";

export const maximumDevicesPerAccount = 5;
export const maximumStoredOneTimePreKeys = 200;
export const maximumOneTimePreKeysPerUpload = 100;
export const maximumDevicesPerQuery = 300;

export const deviceKeyRepository = {
  find: (db: Db, accountId: string, deviceId: string) => db.chatDeviceKey.findUnique({ where: { accountId_deviceId: { accountId, deviceId } } }),

  countDevices: (db: Db, accountId: string) => db.chatDeviceKey.count({ where: { accountId } }),

  upsert: (db: Db, accountId: string, deviceId: string, data: { registrationId: number; identityKey: string; signedPreKey: WireSignedPreKey }) => {
    const fields = { registrationId: data.registrationId, identityKey: data.identityKey, signedPreKeyId: data.signedPreKey.keyId, signedPreKey: data.signedPreKey.publicKey, signedPreKeySignature: data.signedPreKey.signature };
    return db.chatDeviceKey.upsert({ where: { accountId_deviceId: { accountId, deviceId } }, create: { accountId, deviceId, ...fields }, update: fields });
  },

  updateSignedPreKey: (db: Db, accountId: string, deviceId: string, signedPreKey: WireSignedPreKey) =>
    db.chatDeviceKey.update({ where: { accountId_deviceId: { accountId, deviceId } }, data: { signedPreKeyId: signedPreKey.keyId, signedPreKey: signedPreKey.publicKey, signedPreKeySignature: signedPreKey.signature } }),

  remove: (db: Db, accountId: string, deviceId: string) => db.chatDeviceKey.deleteMany({ where: { accountId, deviceId } }),

  replaceOneTimePreKeys: async (db: Db, accountId: string, deviceId: string, keys: readonly WireOneTimePreKey[]) => {
    await db.chatOneTimePreKey.deleteMany({ where: { accountId, deviceId } });
    if (keys.length > 0) await db.chatOneTimePreKey.createMany({ data: keys.map((key) => ({ accountId, deviceId, keyId: key.keyId, publicKey: key.publicKey })), skipDuplicates: true });
  },

  addOneTimePreKeys: (db: Db, accountId: string, deviceId: string, keys: readonly WireOneTimePreKey[]) =>
    db.chatOneTimePreKey.createMany({ data: keys.map((key) => ({ accountId, deviceId, keyId: key.keyId, publicKey: key.publicKey })), skipDuplicates: true }),

  countOneTimePreKeys: (db: Db, accountId: string, deviceId: string) => db.chatOneTimePreKey.count({ where: { accountId, deviceId } }),

  trimOneTimePreKeys: async (db: Db, accountId: string, deviceId: string) => {
    const overflow = await db.chatOneTimePreKey.findMany({ where: { accountId, deviceId }, orderBy: { createdAt: "desc" }, skip: maximumStoredOneTimePreKeys, select: { keyId: true } });
    if (overflow.length > 0) await db.chatOneTimePreKey.deleteMany({ where: { accountId, deviceId, keyId: { in: overflow.map((row) => row.keyId) } } });
  },

  listDevices: (db: Db, accountIds: readonly string[]) =>
    db.chatDeviceKey.findMany({ where: { accountId: { in: [...accountIds] } }, select: { accountId: true, deviceId: true, registrationId: true, identityKey: true }, orderBy: { createdAt: "asc" } }),

  oldestOneTimePreKey: (db: Db, accountId: string, deviceId: string) =>
    db.chatOneTimePreKey.findFirst({ where: { accountId, deviceId }, orderBy: [{ createdAt: "asc" }, { keyId: "asc" }] }),

  deleteOneTimePreKey: (db: Db, accountId: string, deviceId: string, keyId: number) => db.chatOneTimePreKey.deleteMany({ where: { accountId, deviceId, keyId } }),
};
