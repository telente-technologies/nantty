import { useQuery } from "@tanstack/react-query";

import { brandsService } from "@/services/sellers/brands.service";
import { useAuthStore } from "@/store/auth.store";

export const linkedProfilesQueryKey = ["users", "me", "linked-profiles"] as const;

export function useLinkedProfiles() {
  const isSignedIn = useAuthStore((state) => state.status === "signedIn");
  return useQuery({ queryKey: linkedProfilesQueryKey, queryFn: brandsService.fetchLinkedProfiles, enabled: isSignedIn });
}
