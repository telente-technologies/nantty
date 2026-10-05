import type { Db } from "../../../types/database.type.js";
import type { DeviceKeyStatusView } from "../models/messagingKeys.model.js";
import { deviceKeyRepository } from "../repositories/deviceKey.repository.js";

export async function loadDeviceKeyStatus(db: Db, accountId: string, deviceId: string): Promise<DeviceKeyStatusView | null> {
  const device = await deviceKeyRepository.find(db, accountId, deviceId);
  if (device === null) return null;
  return { deviceId, identityKey: device.identityKey, signedPreKeyId: device.signedPreKeyId, oneTimePreKeyCount: await deviceKeyRepository.countOneTimePreKeys(db, accountId, deviceId) };
}
