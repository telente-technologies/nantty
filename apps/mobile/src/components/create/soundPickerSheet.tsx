import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";

import { Check16Icon, MagnifyingGlass16Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { BrandLoader } from "@/components/ui/brandLoader";
import { KEYBOARD_DISMISS_ON_DRAG } from "@/components/ui/dismissKeyboardOnEmptyTap.util";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import { describeClipSoundForDisplay, explainWhySoundCannotBeReused, soundsService } from "@/services/clips/sounds.service";
import type { ClipSound } from "@/types";

type SoundListTab = "trending" | "saved";

export interface SoundPickerSheetProps {
  readonly visible: boolean;
  readonly selectedSoundId: string | null;
  readonly onSelectSound: (sound: ClipSound | null) => void;
  readonly onClose: () => void;
  readonly hasOwnAudio?: boolean;
}

const SEARCH_DEBOUNCE_MS = 300;

export function SoundPickerSheet({ visible, selectedSoundId, onSelectSound, onClose, hasOwnAudio = true }: SoundPickerSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [tab, setTab] = useState<SoundListTab>("trending");
  const [typedSearch, setTypedSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(typedSearch.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typedSearch]);

  const sounds = useQuery({
    queryKey: debouncedSearch ? ["sounds", "search", debouncedSearch] : ["sounds", tab],
    queryFn: () =>
      debouncedSearch
        ? soundsService.searchSounds(debouncedSearch)
        : tab === "trending"
          ? soundsService.fetchTrendingSounds()
          : soundsService.fetchSavedSounds(),
    enabled: visible,
  });

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add sound" subtitle="Pick a sound for your clip">
      <View style={styles.body}>
        <View style={styles.searchField}>
          <MagnifyingGlass16Icon />
          <TextInput
            value={typedSearch}
            onChangeText={setTypedSearch}
            placeholder="Search sounds"
            placeholderTextColor={colors.inputPlaceholderText}
            selectionColor={colors.primary}
            accessibilityLabel="Search sounds"
            style={styles.searchInput}
          />
        </View>
        {debouncedSearch ? null : (
          <View style={styles.tabs} accessibilityRole="tablist">
            {(["trending", "saved"] as const).map((value) => (
              <Text
                key={value}
                size={14}
                weight={tab === value ? 600 : 400}
                lineHeight={16.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === value }}
                onPress={() => setTab(value)}
              >
                {value === "trending" ? "Trending" : "Saved"}
              </Text>
            ))}
          </View>
        )}
        <SoundOptionRow
          title={hasOwnAudio ? "Original sound" : "No sound"}
          subtitle={hasOwnAudio ? "Use the audio from your own video" : "Your photo clip plays silently"}
          isSelected={selectedSoundId === null}
          disabledReason={null}
          onPress={() => onSelectSound(null)}
        />
        {sounds.isPending ? (
          <BrandLoader size="md" style={styles.loading} />
        ) : (
          <FlatList
            style={styles.list}
            data={sounds.data ?? []}
            keyExtractor={(sound) => sound.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={KEYBOARD_DISMISS_ON_DRAG}
            ListEmptyComponent={
              <Text size={13} lineHeight={18.2} color={colors.textMuted} align="center" style={styles.loading}>
                {tab === "saved" && !debouncedSearch ? "Sounds you save appear here." : "No sounds found."}
              </Text>
            }
            renderItem={({ item }) => (
              <SoundOptionRow
                title={item.isOriginal ? "Original sound" : item.title}
                subtitle={`${describeClipSoundForDisplay(item)} · ${item.usageCount} clips`}
                isSelected={item.id === selectedSoundId}
                disabledReason={explainWhySoundCannotBeReused(item)}
                onPress={() => onSelectSound(item)}
              />
            )}
          />
        )}
      </View>
    </BottomSheet>
  );
}

function SoundOptionRow(props: { title: string; subtitle: string; isSelected: boolean; disabledReason: string | null; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const isDisabled = !!props.disabledReason;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: props.isSelected, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={props.onPress}
      style={[styles.optionRow, isDisabled ? styles.disabledRow : null]}
    >
      <View style={styles.optionText}>
        <Text size={14} weight={props.isSelected ? 600 : 500} lineHeight={16.8} numberOfLines={1}>
          {props.title}
        </Text>
        <Text size={12} lineHeight={16.8} color={colors.textMuted} numberOfLines={1}>
          {props.disabledReason ?? props.subtitle}
        </Text>
      </View>
      {props.isSelected ? <Check16Icon color={colors.primary} /> : null}
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  body: { flexShrink: 1, paddingHorizontal: 16, paddingBottom: 16, gap: 12, maxHeight: 520 },
  searchField: {
    height: 44,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 22,
    backgroundColor: colors.background,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    padding: 0,
    fontFamily: fontFamily[400],
    fontSize: 14,
    letterSpacing: calculateDefaultLetterSpacing(14),
    color: colors.text,
  },
  tabs: { flexDirection: "row", gap: 16 },
  list: { flexShrink: 1, maxHeight: 320 },
  loading: { marginVertical: 24 },
  optionRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  optionText: { flex: 1, gap: 2 },
  disabledRow: { opacity: 0.5 },
}));
