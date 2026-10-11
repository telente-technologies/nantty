import type { ReactNode } from "react";

import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { ApiError } from "@/errors/api.error";
import { useLinkedProfiles } from "@/hooks/useLinkedProfiles.hook";
import { blockedCreateCode } from "@/utils/linkedProfiles.util";

const PROFILE_LIMIT_CODES = new Set(["PROFILE_LIMIT_STORE_OR_BUSINESS", "PROFILE_LIMIT_ONE_BRAND", "PROFILE_ON_HOLD", "BRAND_SELLING_OFF"]);

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
  if (code) return <ErrorState code={code} />;
  return <>{children}</>;
}
