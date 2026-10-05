import { conflict, notFound, unprocessable } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { DeviceKeyStatusView, RegisterDeviceCommand, WireOneTimePreKey, WireSignedPreKey } from "../../models/messagingKeys.model.js";
import { deviceKeyRepository, maximumDevicesPerAccount } from "../../repositories/deviceKey.repository.js";
import { loadDeviceKeyStatus } from "../../services/deviceKeyStatus.service.js";
import { isValidAgreementKey, requireValidSignedPreKey } from "../../services/signedPreKey.service.js";

function requireValidOneTimePreKeys(keys: readonly WireOneTimePreKey[]) {
  if (keys.some((key) => !isValidAgreementKey(key.publicKey))) throw unprocessable("PREKEY_INVALID", "A one-time prekey is not a 32-byte key.");
}

export function createRegisterDeviceHandler(context: HandlerContext): Handler<RegisterDeviceCommand, DeviceKeyStatusView> {
  return async (command) => {
    requireValidSignedPreKey(command.identityKey, command.signedPreKey);
    requireValidOneTimePreKeys(command.oneTimePreKeys);
    await context.database.transaction(async (transaction) => {
      const existing = await deviceKeyRepository.find(transaction, command.accountId, command.deviceId);
      if (existing === null && (await deviceKeyRepository.countDevices(transaction, command.accountId)) >= maximumDevicesPerAccount) {
        throw conflict("TOO_MANY_DEVICES", `Secure chat works on up to ${maximumDevicesPerAccount} devices. Sign out on another device first.`);
      }
      await deviceKeyRepository.upsert(transaction, command.accountId, command.deviceId, command);
      await deviceKeyRepository.replaceOneTimePreKeys(transaction, command.accountId, command.deviceId, command.oneTimePreKeys);
    });
    return (await loadDeviceKeyStatus(context.database.client, command.accountId, command.deviceId)) as DeviceKeyStatusView;
  };
}

export function createUploadOneTimePreKeysHandler(context: HandlerContext): Handler<{ readonly accountId: string; readonly deviceId: string; readonly oneTimePreKeys: readonly WireOneTimePreKey[] }, DeviceKeyStatusView> {
  return async ({ accountId, deviceId, oneTimePreKeys }) => {
    requireValidOneTimePreKeys(oneTimePreKeys);
    const db = context.database.client;
    if ((await deviceKeyRepository.find(db, accountId, deviceId)) === null) throw notFound("DEVICE_NOT_FOUND", "This device is not registered for secure chat.");
    await deviceKeyRepository.addOneTimePreKeys(db, accountId, deviceId, oneTimePreKeys);
    await deviceKeyRepository.trimOneTimePreKeys(db, accountId, deviceId);
    return (await loadDeviceKeyStatus(db, accountId, deviceId)) as DeviceKeyStatusView;
  };
}

export function createRotateSignedPreKeyHandler(context: HandlerContext): Handler<{ readonly accountId: string; readonly deviceId: string; readonly signedPreKey: WireSignedPreKey }, DeviceKeyStatusView> {
  return async ({ accountId, deviceId, signedPreKey }) => {
    const db = context.database.client;
    const device = await deviceKeyRepository.find(db, accountId, deviceId);
    if (device === null) throw notFound("DEVICE_NOT_FOUND", "This device is not registered for secure chat.");
    requireValidSignedPreKey(device.identityKey, signedPreKey);
    await deviceKeyRepository.updateSignedPreKey(db, accountId, deviceId, signedPreKey);
    return (await loadDeviceKeyStatus(db, accountId, deviceId)) as DeviceKeyStatusView;
  };
}
