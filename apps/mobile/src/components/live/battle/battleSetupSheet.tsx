import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { LiveStageStreamer, CreateLiveBattleInput } from "@/types/liveStage.type";

const BATTLE_DURATION_OPTIONS = [
  { seconds: 60, label: "1 min" },
  { seconds: 180, label: "3 min" },
  { seconds: 300, label: "5 min" },
] as const;

export interface BattleSetupSheetProps {
  readonly visible: boolean;
  readonly streamers: readonly LiveStageStreamer[];
  readonly isStarting: boolean;
  readonly errorMessage: string | null;
  readonly onStartBattle: (input: CreateLiveBattleInput) => void;
  readonly onClose: () => void;
}

export function BattleSetupSheet(props: BattleSetupSheetProps) {
  const [durationSeconds, setDurationSeconds] = useState<number>(BATTLE_DURATION_OPTIONS[0].seconds);
  const [isWinnerTakesAll, setIsWinnerTakesAll] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<readonly string[]>([]);

  useEffect(() => {
    if (props.visible) setSelectedUserIds(props.streamers.map((streamer) => streamer.user.id));
  }, [props.visible, props.streamers]);

  const toggleParticipant = (userId: string) =>
    setSelectedUserIds((current) => (current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]));

  return (
    <BottomSheet visible={props.visible} onClose={props.onClose} title="Start a battle">
      <ScrollView contentContainerStyle={styles.body}>
        <Text size={13} lineHeight={18} color={colors.textMuted}>
          Viewers tap a streamer on stage to send them gifts. Every coin gifted adds to that streamer's score. Highest score when the timer ends wins.
        </Text>
        <Text size={14} weight={600} lineHeight={17}>
          Who's battling ({selectedUserIds.length})
        </Text>
        {props.streamers.map((streamer) => {
          const isSelected = selectedUserIds.includes(streamer.user.id);
          return (
            <Pressable
              key={streamer.user.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              onPress={() => toggleParticipant(streamer.user.id)}
              style={styles.participantRow}
            >
              <Avatar uri={streamer.user.avatarUrl} size={32} />
              <Text size={14} lineHeight={17} style={styles.flex} numberOfLines={1}>
                {streamer.user.name}
                {streamer.role === "host" ? " (you)" : ""}
              </Text>
              <View style={[styles.checkbox, isSelected ? styles.checkboxChecked : null]}>
                {isSelected ? (
                  <Text size={12} weight={700} lineHeight={14} color={colors.white}>
                    ✓
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
        <Text size={14} weight={600} lineHeight={17}>
          Duration
        </Text>
        <View style={styles.chips}>
          {BATTLE_DURATION_OPTIONS.map((option) => (
            <Chip key={option.seconds} label={option.label} selected={durationSeconds === option.seconds} onPress={() => setDurationSeconds(option.seconds)} />
          ))}
        </View>
        <View style={styles.ruleRow}>
          <View style={styles.flex}>
            <Text size={14} weight={600} lineHeight={17}>
              Winner takes all
            </Text>
            <Text size={12} lineHeight={17} color={colors.textMuted}>
              {isWinnerTakesAll
                ? "On: when the battle ends, every coin gifted to the other streamers during the battle goes to the winner. Every guest must accept first; if anyone declines, you can run a normal battle or cancel. A draw means everyone keeps their own coins."
                : "Off (default): every streamer keeps the coins gifted to them, win or lose."}
            </Text>
          </View>
          <Switch
            accessibilityLabel="Winner takes all"
            value={isWinnerTakesAll}
            onValueChange={setIsWinnerTakesAll}
            trackColor={{ true: colors.primary, false: colors.disabled }}
          />
        </View>
        <Text size={12} lineHeight={17} color={colors.textMuted}>
          Anyone who leaves mid-battle forfeits and can't win. They keep their coins unless winner takes all is on. Guests outside the Creator Program can battle, but their coins are paid to you.
        </Text>
        {props.errorMessage ? (
          <Text size={12} lineHeight={16} color={colors.error} accessibilityLiveRegion="polite">
            {props.errorMessage}
          </Text>
        ) : null}
        <Button
          title={selectedUserIds.length < 2 ? "Pick at least 2 streamers" : "Start battle"}
          disabled={selectedUserIds.length < 2}
          loading={props.isStarting}
          onPress={() =>
            props.onStartBattle({ durationSeconds, winnerTakesAll: isWinnerTakesAll, participantUserIds: selectedUserIds })
          }
        />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  flex: { flex: 1 },
  participantRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.divider, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  chips: { flexDirection: "row", gap: 8 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
});
