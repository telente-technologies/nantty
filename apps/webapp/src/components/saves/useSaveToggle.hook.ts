"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { savesService } from "@/services/saves.service";
import type { SaveTargetType } from "@/types";

export function useSaveToggle(targetType: SaveTargetType, targetId: string, initiallySaved: boolean) {
  const queryClient = useQueryClient();
  const [isSaved, setIsSaved] = useState(initiallySaved);

  useEffect(() => {
    setIsSaved(initiallySaved);
  }, [initiallySaved, targetId]);

  const saveMutation = useMutation({
    mutationFn: async (saveNow: boolean) => {
      if (saveNow) await savesService.saveTarget({ type: targetType, targetId });
      else await savesService.removeSavedTarget(targetType, targetId);
    },
    onMutate: (saveNow) => {
      setIsSaved(saveNow);
      showToast(saveNow ? { text: "Added to Saved", actionLabel: "View", actionHref: "/saved" } : { text: "Removed from Saved" });
    },
    onError: (error, saveNow) => {
      setIsSaved(!saveNow);
      showToast({ text: readErrorMessageForDisplay(error), tone: "error" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["saves"] }),
  });

  return {
    isSaved,
    isPending: saveMutation.isPending,
    toggleSaved: () => requireAuthThen(() => saveMutation.mutate(!isSaved), "Sign in to save this for later."),
  };
}
