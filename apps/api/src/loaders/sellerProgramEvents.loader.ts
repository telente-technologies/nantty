import { SellerApplicationReviewedEvent } from "../modules/stores/events/sellerApplicationReviewed.event.js";
import { BADGE_HIDE_EVENTS, BADGE_SYNC_EVENTS } from "../modules/subscriptions/events/subscriptionLifecycle.event.js";
import type { ProfileResolver } from "../modules/verifications/services/profileResolver.service.js";
import type { VerificationsService } from "../modules/verifications/services/verifications.service.js";
import type { WalletsService } from "../modules/wallets/services/wallets.service.js";
import type { VerificationTier } from "../interfaces/verificationBadge.interface.js";
import type { Core } from "./core.loader.js";
import { subscribeToEvent } from "./events.loader.js";

export interface SellerProgramEventServices {
  readonly verificationsService: VerificationsService;
  readonly walletsService: WalletsService;
  readonly profiles: ProfileResolver;
}

export function subscribeSellerProgramEvents(core: Core, services: SellerProgramEventServices): void {
  const { verificationsService, walletsService, profiles } = services;
  for (const event of BADGE_SYNC_EVENTS) {
    subscribeToEvent(core.events, event, (payload) => verificationsService.syncTierFromSubscription(payload.profileId, payload.plan as VerificationTier));
  }
  for (const event of BADGE_HIDE_EVENTS) {
    subscribeToEvent(core.events, event, (payload) => verificationsService.hideBadgeForSubscription(payload.profileId, `subscription ${payload.status.toLowerCase()}`));
  }
  subscribeToEvent(core.events, SellerApplicationReviewedEvent, async (payload) => {
    if (payload.decision !== "approve" || payload.storeId === null || payload.onboarding === null) return;
    const storeId = payload.storeId;
    const ownerUserId = (await profiles.findStoreOwnerUserId(storeId)) ?? payload.userId;
    const { verification, payoutAccount } = payload.onboarding;
    if (verification !== null) {
      await verificationsService.submitApplication({ profileId: storeId, profileKind: "store", profileType: "STORE", ownerUserId }, null, verification, payload.userId);
    }
    if (payoutAccount !== null) {
      const [store] = await profiles.storeAccess.findStoreSummaries([storeId]);
      if (store === undefined) return;
      await walletsService.createPayoutAccountForOwner(payload.userId, { kind: "store", storeId }, store.currency, {
        bankCode: payoutAccount.bankCode,
        bankName: payoutAccount.bankName,
        accountNumber: await core.cipher.decryptText(payoutAccount.accountNumberEncrypted),
        accountName: payoutAccount.accountName,
        isDefault: true,
      });
    }
  });
}
