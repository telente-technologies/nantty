import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { followsService } from "@/services/social/follows.service";
import { showDialog } from "@/store/dialog.store";
import { showToast } from "@/store/toast.store";

export function useUnblockFromProfile() {
  const queryClient = useQueryClient();
  return useCallback((user: { readonly id: string; readonly username: string }) => {
    showDialog({
      title: `Unblock @${user.username}?`,
      message: "They'll be able to see your profile and follow you again. They won't be told you unblocked them.",
      actions: [
        {
          label: "Unblock",
          style: "destructive",
          onPress: () => void followsService.unblockUser(user.id)
            .then(() => queryClient.invalidateQueries({ queryKey: ["users", user.id] }))
            .catch(() => showToast(`Couldn't unblock @${user.username}. Try again.`, { tone: "error" })),
        },
        { label: "Cancel", style: "secondary", onPress: () => undefined },
      ],
    });
  }, [queryClient]);
}
