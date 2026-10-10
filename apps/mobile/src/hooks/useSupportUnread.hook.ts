import { useQuery } from "@tanstack/react-query";

import { supportService } from "@/services/support/support.service";
import { useAuthStore } from "@/store/auth.store";

export const supportUnreadQueryKey = ["support", "unread"] as const;

export function useSupportUnreadCount(): number {
  const isSignedIn = useAuthStore((state) => state.status === "signedIn");
  const unread = useQuery({ queryKey: supportUnreadQueryKey, queryFn: supportService.fetchUnreadSupportReplies, enabled: isSignedIn, refetchInterval: 60_000 });
  return unread.data?.count ?? 0;
}
