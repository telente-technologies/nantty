import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { CaretRight24Icon, SpeakerHigh24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { describeClipSoundForDisplay, soundsService } from "@/services/sounds.service";
import type { ID } from "@/types";

import { SoundPickerSheet } from "./soundPickerSheet";

export interface SoundPickerRowProps {
  readonly selectedSoundId: ID | null;
  readonly onChangeSelectedSoundId: (soundId: ID | null) => void;
}

export function SoundPickerRow({ selectedSoundId, onChangeSelectedSoundId }: SoundPickerRowProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const selectedSound = useQuery({
    queryKey: ["sound", selectedSoundId],
    queryFn: () => soundsService.fetchSoundById(selectedSoundId!),
    enabled: !!selectedSoundId,
  });
  const label = !selectedSoundId
    ? "Original sound"
    : selectedSound.data
      ? describeClipSoundForDisplay(selectedSound.data)
      : "Loading sound…";

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sound: ${label}. Tap to change`}
        onPress={() => setIsPickerOpen(true)}
        style={styles.row}
      >
        <SpeakerHigh24Icon size={18} />
        <View style={styles.text}>
          <Text size={14} weight={500} lineHeight={16.8} numberOfLines={1}>
            {label}
          </Text>
          {selectedSoundId && selectedSound.data ? (
            <Text size={12} lineHeight={16.8} color={colors.textMuted} numberOfLines={1}>
              Credit: {selectedSound.data.owner.name} (@{selectedSound.data.owner.username})
            </Text>
          ) : null}
        </View>
        <CaretRight24Icon size={18} />
      </Pressable>
      <SoundPickerSheet
        visible={isPickerOpen}
        selectedSoundId={selectedSoundId}
        onSelectSound={(sound) => {
          onChangeSelectedSoundId(sound?.id ?? null);
          setIsPickerOpen(false);
        }}
        onClose={() => setIsPickerOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  text: { flex: 1, gap: 2 },
});
