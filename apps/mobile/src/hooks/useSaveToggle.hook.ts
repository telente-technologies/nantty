import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useCallback } from "react";

import { rootNavigationRef } from "@/navigation/navigationRef";
import { savesService } from "@/services/saves.service";
import { requireAuthThen } from "@/utils/requireAuth.util";
import { showToast } from "@/store/toast.store";
import { saveTargetKey, useSavedItemsStore } from "@/store/savedItems.store";
import type { SaveTarget } from "@/types";

export const savedItemsQueryKeyPrefix = ["saves"] as const;

const playSaveHaptic = (savedNow: boolean) =>
  (savedNow ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) : Haptics.selectionAsync()).catch(() => undefined);

const openSavedScreen = () => {
  if (rootNavigationRef.isReady()) rootNavigationRef.navigate("Saved" as never);
};

export function useSaveToggle(target: SaveTarget, savedAccordingToServer: boolean) {
  const queryClient = useQueryClient();
  const targetKey = saveTargetKey(target);
  const optimisticSavedState = useSavedItemsStore((state) => state.savedStateByTargetKey[targetKey]);
  const isSaved = optimisticSavedState ?? savedAccordingToServer;

  const applySavedToggle = useCallback(async () => {
    const { savedStateByTargetKey, recordSavedState } = useSavedItemsStore.getState();
    const saveNow = !(savedStateByTargetKey[targetKey] ?? savedAccordingToServer);
    recordSavedState(target, saveNow);
    playSaveHaptic(saveNow);
    showToast(saveNow ? "Added to Saved" : "Removed from Saved", saveNow ? { action: { label: "View", onPress: openSavedScreen } } : undefined);
    try {
      await (saveNow ? savesService.saveItem(target) : savesService.unsaveItem(target));
      queryClient.invalidateQueries({ queryKey: savedItemsQueryKeyPrefix });
    } catch {
      useSavedItemsStore.getState().recordSavedState(target, !saveNow);
    }
  }, [queryClient, savedAccordingToServer, target, targetKey]);

  const toggleSaved = useCallback(() => requireAuthThen(applySavedToggle, undefined, "save items"), [applySavedToggle]);

  return { isSaved, savedDelta: isSaved === savedAccordingToServer ? 0 : isSaved ? 1 : -1, toggleSaved };
}
