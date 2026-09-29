import type { StoreRole } from "../constants/roles.constant.js";
import { notFound } from "../errors/domain.error.js";
import type { StoreAccess } from "../interfaces/storeAccess.interface.js";

export async function resolveSellerStoreIdForUser(
  storeAccess: StoreAccess,
  userId: string,
  requestedStoreId: string | undefined,
  allowedRoles?: readonly StoreRole[],
): Promise<string> {
  const storeId = requestedStoreId ?? (await storeAccess.findPrimaryStoreIdForMember(userId));
  if (storeId === undefined) throw notFound("Your store");
  await storeAccess.assertStoreMember(userId, storeId, allowedRoles);
  return storeId;
}
