import type { Db } from "../../../../types/database.type.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { PreKeyBundleView, WireOneTimePreKey } from "../../models/messagingKeys.model.js";
import { deviceKeyRepository } from "../../repositories/deviceKey.repository.js";
import { enforcePreKeyClaimLimits, reportDrainedDevice } from "../../services/preKeyClaimLimit.service.js";

const claimAttempts = 3;

async function claimOneTimePreKey(db: Db, accountId: string, deviceId: string): Promise<WireOneTimePreKey | null> {
  for (let attempt = 0; attempt < claimAttempts; attempt++) {
    const candidate = await deviceKeyRepository.oldestOneTimePreKey(db, accountId, deviceId);
    if (candidate === null) return null;
    const { count } = await deviceKeyRepository.deleteOneTimePreKey(db, accountId, deviceId, candidate.keyId);
    if (count === 1) return { keyId: candidate.keyId, publicKey: candidate.publicKey };
  }
  return null;
}

export function createClaimPreKeyBundlesHandler(context: HandlerContext): Handler<{ readonly requesterId: string; readonly devices: readonly { readonly userId: string; readonly deviceId: string }[] }, { readonly data: PreKeyBundleView[] }> {
  return async ({ requesterId, devices }) => {
    const db = context.database.client;
    const unique = [...new Map(devices.map((device) => [`${device.userId}:${device.deviceId}`, device])).values()];
    await enforcePreKeyClaimLimits(db, requesterId, unique.filter((device) => device.userId !== requesterId).map((device) => device.userId), context.clock.now());
    const bundles: PreKeyBundleView[] = [];
    for (const { userId, deviceId } of unique) {
      const device = await deviceKeyRepository.find(db, userId, deviceId);
      if (device === null) continue;
      const oneTimePreKey = await claimOneTimePreKey(db, userId, deviceId);
      if (oneTimePreKey === null) reportDrainedDevice(requesterId, userId, deviceId);
      bundles.push({
        userId, deviceId, registrationId: device.registrationId, identityKey: device.identityKey,
        signedPreKey: { keyId: device.signedPreKeyId, publicKey: device.signedPreKey, signature: device.signedPreKeySignature },
        oneTimePreKey,
      });
    }
    return { data: bundles };
  };
}
