import { StoreRole } from "../../../constants/roles.constant.js";
import { notFound } from "../../../errors/domain.error.js";
import type { Principal } from "../../../interfaces/principal.interface.js";
import type { StoreAccess } from "../../../interfaces/storeAccess.interface.js";
import type { ProfileType } from "../../../interfaces/verificationBadge.interface.js";
import { resolveSellerStoreIdForUser } from "../../../utils/sellerStore.util.js";
import type { ResolvedProfile } from "../models/verifications.model.js";

export const STORE_PROFILE_MANAGERS = [StoreRole.OWNER];
export const STORE_PROFILE_VIEWERS = [StoreRole.OWNER, StoreRole.MANAGER, StoreRole.STAFF];

export class ProfileResolver {
  public constructor(public readonly storeAccess: StoreAccess) {}

  public async resolveProfileForPrincipal(principal: Principal, profileType: ProfileType, storeId: string | undefined): Promise<ResolvedProfile> {
    if (profileType === "PERSONAL" || profileType === "GOVERNMENT") {
      return { profileId: principal.userId, profileKind: "user", profileType, ownerUserId: principal.userId };
    }
    return this.resolveStoreProfile(principal, storeId, STORE_PROFILE_MANAGERS, profileType);
  }

  public async resolveStoreProfile(principal: Principal, requestedStoreId: string | undefined, roles: readonly StoreRole[], profileType: ProfileType = "STORE"): Promise<ResolvedProfile> {
    const storeId = await resolveSellerStoreIdForUser(this.storeAccess, principal.userId, requestedStoreId, roles);
    const [store] = await this.storeAccess.findStoreSummaries([storeId]);
    if (store === undefined) throw notFound("Store");
    return { profileId: storeId, profileKind: "store", profileType, ownerUserId: store.ownerId };
  }

  public async resolveOwnedProfileById(principal: Principal, profileId: string): Promise<ResolvedProfile> {
    if (profileId === principal.userId) return { profileId, profileKind: "user", profileType: "PERSONAL", ownerUserId: principal.userId };
    return this.resolveStoreProfile(principal, profileId, STORE_PROFILE_MANAGERS);
  }

  public async findStoreOwnerUserId(storeId: string): Promise<string | undefined> {
    return (await this.storeAccess.findStoreSummaries([storeId]))[0]?.ownerId;
  }
}
