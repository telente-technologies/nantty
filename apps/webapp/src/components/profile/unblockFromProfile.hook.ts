"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { requestConfirmation } from "@/components/ui/confirmDialog";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { followsService } from "@/services/posts.service";

export function useUnblockFromProfile(user: { readonly id: string; readonly username: string }) {
  const queryClient = useQueryClient();
  const unblock = useMutation({
    mutationFn: () => followsService.unblockUser(user.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["followStatus", user.id] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });
  const confirmAndUnblock = async () => {
    const confirmed = await requestConfirmation({
      title: `Unblock @${user.username}?`,
      description: "They'll be able to see your profile and follow you again. They won't be told you unblocked them.",
      confirmLabel: "Unblock",
    });
    if (confirmed) unblock.mutate();
  };
  return { confirmAndUnblock, isPending: unblock.isPending };
}
