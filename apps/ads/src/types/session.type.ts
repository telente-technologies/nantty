import type { AdAccountMembership, AdsUser } from "@/types/adAccount.type";

export interface AdsSessionView {
  readonly user: AdsUser;
  readonly memberships: readonly AdAccountMembership[];
}
