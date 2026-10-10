import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

import { usersService } from "@/services/account/users.service";
import { showToast } from "@/store/toast.store";

import { useOpenUserProfile } from "./useOpenUserProfile.hook";

const USER_NOT_FOUND_MESSAGE = "User not found";
const USERNAME_LOOKUP_STALE_MS = 5 * 60_000;

export function useOpenUserByUsername() {
  const queryClient = useQueryClient();
  const openUserProfile = useOpenUserProfile();
  const isOpeningRef = useRef(false);
  return useCallback(
    async (username: string) => {
      if (isOpeningRef.current) return;
      isOpeningRef.current = true;
      try {
        const { id } = await queryClient.fetchQuery({
          queryKey: ["user-id-by-username", username.toLowerCase()],
          queryFn: () => usersService.fetchUserIdByUsername(username),
          staleTime: USERNAME_LOOKUP_STALE_MS,
        });
        openUserProfile(id);
      } catch {
        showToast(USER_NOT_FOUND_MESSAGE);
      } finally {
        isOpeningRef.current = false;
      }
    },
    [queryClient, openUserProfile],
  );
}
