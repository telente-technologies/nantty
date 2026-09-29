import { StoreRole } from "../../../constants/roles.constant.js";
import { forbidden, notFound } from "../../../errors/domain.error.js";
import type { EntitlementKey, EntitlementSet } from "../../../interfaces/entitlements.interface.js";
import type { Principal } from "../../../interfaces/principal.interface.js";
import type { SellerAccessPolicy } from "../../../interfaces/sellerAccess.interface.js";
import type { StoreAccess } from "../../../interfaces/storeAccess.interface.js";
import { UNVERIFIED_STORE_BADGE, type VerificationBadge, type VerificationTier } from "../../../interfaces/verificationBadge.interface.js";
import { resolveSellerStoreIdForUser } from "../../../utils/sellerStore.util.js";
import type { VerificationsRepository } from "../../verifications/repositories/verifications.repository.js";
import { convertVerificationToBadge } from "../../verifications/services/verificationBadgeLookup.service.js";
import type { SubscriptionStatus } from "../models/subscriptions.model.js";
import type { SubscriptionsRepository } from "../repositories/subscriptions.repository.js";
import type { SubscriptionEntitlements } from "./entitlements.service.js";

export const DEFAULT_SELLER_ENTITLEMENT: EntitlementKey = "seller.dashboard";

export interface SellerAccessSummary {
  readonly storeId: string;
  readonly storeName: string;
  readonly role: StoreRole;
  readonly verificationStatus: VerificationBadge["status"];
  readonly verification: VerificationBadge;
  readonly subscription: { readonly status: SubscriptionStatus; readonly plan: VerificationTier; readonly currentPeriodEnd: string | null; readonly autoRenew: boolean } | null;
  readonly entitlements: EntitlementSet;
  readonly hasSellerToolsAccess: boolean;
}

function entitlementIsGranted(entitlements: EntitlementSet, key: EntitlementKey): boolean {
  const value = entitlements[key];
  return value === true || (typeof value === "number" && value !== 0) || (typeof value === "string" && value !== "");
}

export class SellerAccessService implements SellerAccessPolicy {
  public constructor(
    private readonly storeAccess: StoreAccess,
    private readonly verifications: VerificationsRepository,
    private readonly subscriptions: SubscriptionsRepository,
    private readonly entitlements: SubscriptionEntitlements,
  ) {}

  public async assertStoreHasActiveSellerAccess(userId: string, storeId: string, entitlement: EntitlementKey = DEFAULT_SELLER_ENTITLEMENT): Promise<void> {
    await this.storeAccess.assertStoreMember(userId, storeId);
    const verification = await this.verifications.findByProfileId(storeId);
    if (verification?.status !== "VERIFIED" || verification.color !== "GOLD") throw forbidden("Your store needs Gold verification to use this.");
    const granted = await this.entitlements.findEntitlementsForStore(storeId);
    if (granted.tier === null) throw forbidden("Your store needs an active Gold subscription to use this.");
    if (!entitlementIsGranted(granted.entitlements, entitlement)) throw forbidden("Your Gold plan does not include this feature.");
  }

  public async buildAccessSummary(principal: Principal, requestedStoreId: string | undefined): Promise<SellerAccessSummary> {
    const storeId = await resolveSellerStoreIdForUser(this.storeAccess, principal.userId, requestedStoreId);
    const [store] = await this.storeAccess.findStoreSummaries([storeId]);
    if (store === undefined) throw notFound("Store");
    const verificationRecord = await this.verifications.findByProfileId(storeId);
    const verification = verificationRecord === undefined ? UNVERIFIED_STORE_BADGE : convertVerificationToBadge(verificationRecord);
    const subscription = await this.subscriptions.findByProfileId(storeId);
    const granted = await this.entitlements.findEntitlementsForStore(storeId);
    const hasSellerToolsAccess = verification.status === "VERIFIED" && verification.color === "GOLD" && granted.tier !== null && entitlementIsGranted(granted.entitlements, DEFAULT_SELLER_ENTITLEMENT);
    return {
      storeId,
      storeName: store.name,
      role: await this.findStoreRole(principal.userId, storeId, store.ownerId),
      verificationStatus: verification.status,
      verification,
      subscription: subscription === undefined
        ? null
        : { status: subscription.status, plan: subscription.plan, currentPeriodEnd: subscription.endsAt?.toISOString() ?? null, autoRenew: subscription.autoRenew },
      entitlements: granted.entitlements,
      hasSellerToolsAccess,
    };
  }

  private async findStoreRole(userId: string, storeId: string, ownerId: string): Promise<StoreRole> {
    if (userId === ownerId) return StoreRole.OWNER;
    for (const role of [StoreRole.OWNER, StoreRole.MANAGER]) {
      try {
        await this.storeAccess.assertStoreMember(userId, storeId, [role]);
        return role;
      } catch {
        continue;
      }
    }
    return StoreRole.STAFF;
  }
}
