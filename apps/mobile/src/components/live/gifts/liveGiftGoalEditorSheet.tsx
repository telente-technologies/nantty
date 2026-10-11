import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Trophy24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { ApiError } from "@/services/core/apiClient.service";
import type { LiveGiftGoal } from "@/types";
import { makeThemedStyles, useTheme } from "@/theme";

import { useSaveLiveGiftGoal } from "./liveGiftStats.hook";

export function LiveGiftGoalEditorSheet({ liveId, goal, visible, onClose }: { liveId: string; goal: LiveGiftGoal | null; visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [title, setTitle] = useState("");
  const [targetText, setTargetText] = useState("");
  const saveGoal = useSaveLiveGiftGoal(liveId);
  const editableGoal = goal?.status === "active" ? goal : null;

  useEffect(() => {
    if (!visible) return;
    setTitle(editableGoal?.title ?? "");
    setTargetText(editableGoal ? String(editableGoal.targetCoins) : "");
  }, [visible, editableGoal]);

  const targetCoins = Number.parseInt(targetText, 10);
  const canSave = title.trim().length > 0 && Number.isInteger(targetCoins) && targetCoins >= 10;
  const saveGoalAndClose = () =>
    saveGoal.mutate({ goalId: editableGoal?.id ?? null, input: { title: title.trim(), targetCoins } }, { onSuccess: onClose });

  return (
    <BottomSheet visible={visible} onClose={onClose} title={editableGoal ? "Edit gift goal" : "Set a gift goal"} floating scrollable>
      <View style={styles.body}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
          <Trophy24Icon size={22} color={colors.textMuted} />
        </View>
        <Text size={13} lineHeight={18} color={colors.textMuted}>
          Viewers see a progress bar and everyone celebrates when you reach it.
        </Text>
        <TextField label="What's the goal for?" placeholder="e.g. New ring light" value={title} onChangeText={setTitle} maxLength={40} />
        <TextField label="Target (coins)" placeholder="2000" value={targetText} onChangeText={(text) => setTargetText(text.replace(/\D/g, ""))} keyboardType="number-pad" />
        {saveGoal.isError ? (
          <Text size={12} lineHeight={16} color={colors.error} accessibilityLiveRegion="polite">
            {saveGoal.error instanceof ApiError ? saveGoal.error.message : "We couldn't save your goal. Try again."}
          </Text>
        ) : null}
        <Button title="Save goal" disabled={!canSave} loading={saveGoal.isPending} onPress={saveGoalAndClose} />
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({ body: { paddingBottom: 4, gap: 14 } }));
