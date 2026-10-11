import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Cancel20Icon, Check16Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { BrandLoader } from "@/components/ui/brandLoader";
import { Text } from "@/components/ui/text";
import { tagCandidatesService } from "@/services/content/tagCandidates.service";
import { makeThemedStyles, useTheme } from "@/theme";
import { MAXIMUM_TAGGED_PEOPLE, type UserSummary } from "@/types";

import { SearchField, useDebouncedSearchText } from "./searchField";

export interface TagPeopleSheetProps {
  readonly visible: boolean;
  readonly tagged: readonly UserSummary[];
  readonly onChange: (tagged: readonly UserSummary[]) => void;
  readonly onClose: () => void;
}

export function TagPeopleSheet({ visible, tagged, onChange, onClose }: TagPeopleSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const search = useDebouncedSearchText();
  const candidates = useQuery({
    queryKey: ["tagCandidates", search.debounced],
    queryFn: () => tagCandidatesService.searchTagCandidates(search.debounced),
    enabled: visible,
    staleTime: 60_000,
  });
  const isFull = tagged.length >= MAXIMUM_TAGGED_PEOPLE;
  const isTagged = (userId: string) => tagged.some((user) => user.id === userId);
  const toggle = (user: UserSummary) => onChange(isTagged(user.id) ? tagged.filter((item) => item.id !== user.id) : isFull ? tagged : [...tagged, user]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Tag people" subtitle={`Tag up to ${MAXIMUM_TAGGED_PEOPLE} people. Tags apply to the whole post. Tagged people are notified and can remove themselves.`}>
      <View style={styles.body}>
        {tagged.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
            {tagged.map((user) => (
              <Pressable key={user.id} accessibilityRole="button" accessibilityLabel={`Remove tag for ${user.name}`} onPress={() => toggle(user)} style={styles.chip}>
                <Text size={13} weight={500} lineHeight={16.9}>@{user.username}</Text>
                <Cancel20Icon size={12} color={colors.textMuted} />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <Text size={12} lineHeight={16.8} color={isFull ? colors.cautionText : colors.textMuted} accessibilityLiveRegion="polite">
          {isFull ? `You've tagged ${MAXIMUM_TAGGED_PEOPLE} people, the most for one post.` : `${tagged.length} of ${MAXIMUM_TAGGED_PEOPLE} tagged`}
        </Text>
        <SearchField value={search.typed} onChangeText={search.setTyped} label="Search people" />
        {candidates.isPending ? (
          <BrandLoader size="md" style={styles.message} />
        ) : (
          <FlatList
            style={styles.list}
            data={candidates.data ?? []}
            keyExtractor={(candidate) => candidate.user.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text size={13} lineHeight={18.2} color={colors.textMuted} align="center" style={styles.message}>{candidates.isError ? "Search isn't available right now. Try again." : "No people found."}</Text>}
            renderItem={({ item }) => {
              const selected = isTagged(item.user.id);
              const disabled = !item.canTag || (isFull && !selected);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected, disabled }}
                  accessibilityLabel={`${item.user.name}, @${item.user.username}${item.unavailableReason ? `, ${item.unavailableReason}` : ""}`}
                  disabled={disabled}
                  onPress={() => toggle(item.user)}
                  style={[styles.row, disabled ? styles.disabled : null]}
                >
                  <Avatar uri={item.user.avatarUrl} size={36} />
                  <View style={styles.texts}>
                    <Text size={14} weight={500} lineHeight={16.8} numberOfLines={1}>{item.user.name}</Text>
                    <Text size={12} lineHeight={16.8} color={colors.textMuted} numberOfLines={1}>{item.unavailableReason ?? `@${item.user.username}`}</Text>
                  </View>
                  {selected ? <Check16Icon color={colors.primary} /> : null}
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 12, maxHeight: 560 },
  chips: { gap: 8 },
  chip: { minHeight: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.chip, flexDirection: "row", alignItems: "center", gap: 6 },
  list: { maxHeight: 320 },
  message: { marginVertical: 24 },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  texts: { flex: 1, gap: 2 },
  disabled: { opacity: 0.5 },
}));
