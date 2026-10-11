import { useActingProfileStore } from "@/store/actingProfile.store";
import { useAuthStore } from "@/store/auth.store";
import { isContentOwnedBy, type OwnableContent } from "@/utils/postOwnership.util";

export function useIsOwnPost(content: OwnableContent): boolean {
  const viewerId = useAuthStore((state) => state.user?.id ?? null);
  const actingProfileId = useActingProfileStore((state) => state.actingProfile?.id ?? null);
  return isContentOwnedBy(content, viewerId, actingProfileId);
}
