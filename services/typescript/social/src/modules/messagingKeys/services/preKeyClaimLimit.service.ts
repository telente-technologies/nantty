import { createLogger } from "@nantty/fastify-platform";

import { tooManyRequests } from "../../../errors/social.error.js";
import type { Db } from "../../../types/database.type.js";
import { preKeyClaimRepository } from "../repositories/preKeyClaim.repository.js";

export const preKeyClaimWindowMilliseconds = 3_600_000;
export const maximumClaimsPerTargetPerWindow = 20;
export const maximumClaimsPerRequesterPerWindow = 1500;

export const messagingKeysLogger = createLogger({ name: "social.messagingKeys" });

export async function enforcePreKeyClaimLimits(db: Db, requesterId: string, targetIds: readonly string[], now: Date): Promise<void> {
  const since = new Date(now.getTime() - preKeyClaimWindowMilliseconds);
  const total = await preKeyClaimRepository.countSince(db, requesterId, since);
  if (total + targetIds.length > maximumClaimsPerRequesterPerWindow) {
    messagingKeysLogger.warn("prekey claim rate limit reached", { requesterId, claims: total, scope: "requester" });
    throw tooManyRequests("PREKEY_CLAIMS_RATE_LIMITED", "Too many secure chat key requests. Try again later.");
  }
  const perTarget = new Map<string, number>();
  for (const targetId of targetIds) perTarget.set(targetId, (perTarget.get(targetId) ?? 0) + 1);
  for (const [targetId, requested] of perTarget) {
    const claimed = await preKeyClaimRepository.countSince(db, requesterId, since, targetId);
    if (claimed + requested > maximumClaimsPerTargetPerWindow) {
      messagingKeysLogger.warn("prekey claim rate limit reached", { requesterId, targetId, claims: claimed, scope: "target" });
      throw tooManyRequests("PREKEY_CLAIMS_RATE_LIMITED", "Too many secure chat key requests for this person. Try again later.");
    }
  }
  await preKeyClaimRepository.pruneBefore(db, requesterId, new Date(now.getTime() - 24 * preKeyClaimWindowMilliseconds));
  await preKeyClaimRepository.record(db, requesterId, targetIds, now);
}

export function reportDrainedDevice(requesterId: string, targetId: string, deviceId: string): void {
  messagingKeysLogger.warn("one-time prekeys drained", { requesterId, targetId, deviceId });
}
