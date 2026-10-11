import { useMutation, useQueryClient } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { chatSafetyService } from "@/services/chat/chatSafety.service";
import type { ChatStreak } from "@/types";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { Flame24Icon, HeartBroken24Icon, Hourglass24Icon } from "@/components/icons";
import { IconRow } from "@/components/ui/iconRow";

export interface StreakSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly conversationId: string;
  readonly streak: ChatStreak;
  readonly peerName: string;
}

const formatHoursAndMinutes = (seconds: number) => `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;

export function StreakSheet({ visible, onClose, conversationId, streak, peerName }: StreakSheetProps) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const restore = useMutation({
    mutationFn: () => chatSafetyService.restoreStreak(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onClose();
    },
    onError: (error) => showAlertWithButtons("Couldn't restore streak", error instanceof Error ? error.message : undefined, undefined, { intent: "streak" }),
  });
  const canRestore = streak.state === "broken" && !!streak.restorableUntil && streak.restoresRemaining > 0;
  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Streak with ${peerName}`}>
      <View style={styles.body}>
        <View style={styles.heroIcon}>{streak.state === "broken" ? <HeartBroken24Icon size={48} color={colors.textMuted} /> : <Flame24Icon size={48} color="#F97316" />}</View>
        <Text size={18} weight={600} lineHeight={24} align="center">
          {streak.state === "broken" ? "Streak lost" : `${streak.count} day streak`}
        </Text>
        <Text size={13} lineHeight={18} color={colors.textMuted} align="center">
          {streak.state === "broken"
            ? streak.restorableUntil
              ? `You can bring back your ${streak.countBeforeBreak} day streak for both of you until it expires.`
              : "The 48 hour restore window has passed."
            : `Both of you need to send a message on your own day. ${streak.sentToday.me ? "You sent today." : "You haven't sent today."} ${streak.sentToday.peer ? `${peerName} sent today.` : `${peerName} hasn't sent today.`}`}
        </Text>
        {streak.hourglass ? (
          <IconRow icon={<Hourglass24Icon size={16} color={colors.error} />} justify="center"><Text size={13} weight={500} lineHeight={18} color={colors.error} align="center">Your day ends in {formatHoursAndMinutes(streak.secondsUntilMyDayEnds)}</Text></IconRow>
        ) : null}
        <Text size={12} lineHeight={16} color={colors.textMuted} align="center">
          {streak.restoresRemaining} of {streak.restoresPerMonth} restores left this month. Premium members get 6 a month.
        </Text>
        {streak.state === "broken" ? (
          <Button title="Restore streak" onPress={() => restore.mutate()} disabled={!canRestore} loading={restore.isPending} />
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ body: { gap: 12, paddingHorizontal: 20, paddingBottom: 20 }, heroIcon: { alignItems: "center" } });
