import type { HttpMiddleware } from "@zudojs/http";
import { UnauthorizedError } from "@zudojs/errors";

import { notFound } from "../../../errors/domain.error.js";
import type { EntitlementKey } from "../../../interfaces/entitlements.interface.js";
import type { Principal } from "../../../interfaces/principal.interface.js";
import type { SellerAccessPolicy } from "../../../interfaces/sellerAccess.interface.js";
import type { StoreAccess } from "../../../interfaces/storeAccess.interface.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SellerEntitlementGate = (entitlement: EntitlementKey) => HttpMiddleware;

export function createSellerEntitlementGate(policy: SellerAccessPolicy, storeAccess: StoreAccess): SellerEntitlementGate {
  return (entitlement) => async (context, next) => {
    const principal = context.state.get<Principal>("principal");
    if (principal === undefined) throw new UnauthorizedError("Authentication required.");
    const requested = context.request.query?.["storeId"];
    const requestedStoreId = typeof requested === "string" && UUID_PATTERN.test(requested) ? requested : undefined;
    const storeId = requestedStoreId ?? (await storeAccess.findPrimaryStoreIdForMember(principal.userId));
    if (storeId === undefined) throw notFound("Your store");
    await policy.assertStoreHasActiveSellerAccess(principal.userId, storeId, entitlement);
    return next();
  };
}
