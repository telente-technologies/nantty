import type { MyStoreSummary } from "@/types/commerce.type";

const ROLES_THAT_CAN_PROMOTE_A_STORE = new Set(["owner", "manager"]);

export function canPromoteStore(input: { readonly storeId: string; readonly storeOwnerUserId: string; readonly signedInUserId: string | undefined; readonly myStores: readonly MyStoreSummary[] | undefined }): boolean {
  if (!input.signedInUserId) return false;
  if (input.storeOwnerUserId === input.signedInUserId) return true;
  return Boolean(input.myStores?.some((store) => store.storeId === input.storeId && ROLES_THAT_CAN_PROMOTE_A_STORE.has(store.role)));
}
