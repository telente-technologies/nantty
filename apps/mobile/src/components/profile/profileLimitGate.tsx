import type { ReactNode } from "react";

import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { ApiError } from "@/errors/api.error";
import { useLinkedProfiles } from "@/hooks/useLinkedProfiles.hook";
import { describePremiumNeeded } from "@/utils/businessProfileAllowance.util";
import { blockedCreateCode } from "@/utils/linkedProfiles.util";

import { BluePremiumProfilesUpsell } from "./bluePremiumProfilesUpsell";

const PROFILE_LIMIT_CODES = new Set(["PROFILE_LIMIT_STORE_OR_BUSINESS", "PROFILE_LIMIT_ONE_BRAND", "PROFILE_ON_HOLD", "BRAND_SELLING_OFF", "STORE_LIMIT_ONE", "BUSINESS_PROFILE_LIMIT"]);
const PREMIUM_UNLOCKS_CODES = new Set(["PROFILE_LIMIT_STORE_OR_BUSINESS", "PROFILE_LIMIT_ONE_BRAND"]);

export function isProfileLimitError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.code !== undefined && PROFILE_LIMIT_CODES.has(error.code);
}

export interface ProfileLimitGateProps {
  readonly kind: "store" | "business" | "brand";
  readonly failure?: unknown;
  readonly children: ReactNode;
}

export function ProfileLimitGate({ kind, failure, children }: ProfileLimitGateProps) {
  const linked = useLinkedProfiles();
  if (linked.isPending) return <ListSkeleton rows={4} />;
  const code = isProfileLimitError(failure) ? failure.code : blockedCreateCode(linked.data, kind);
  if (!code) return <>{children}</>;
  const allowance = linked.data?.businessProfiles;
  const offerPremium = allowance !== undefined && !allowance.premium && PREMIUM_UNLOCKS_CODES.has(code);
  return (
    <ErrorState code={code}>
      {offerPremium ? <BluePremiumProfilesUpsell note={describePremiumNeeded(allowance)} /> : null}
    </ErrorState>
  );
}
