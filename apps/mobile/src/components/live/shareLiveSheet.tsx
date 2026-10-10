import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, Share, StyleSheet, TextInput, View } from "react-native";

import { Copy16Icon, MagnifyingGlass16Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import { liveService } from "@/services/live/live.service";
import { makeThemedStyles, useTheme } from "@/theme";
import { webAppLinks } from "@/config/webAppLinks.config";

export interface ShareLiveSheetProps {
  readonly liveId: string;
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onShared?: () => void;
}

export function ShareLiveSheet({ liveId, visible, onClose, onShared }: ShareLiveSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [query, setQuery] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<readonly string[]>([]);
  const people = useQuery({
    queryKey: ["share-live-people", query],
    queryFn: () => liveService.fetchPeopleToShareLiveWith(query),
    enabled: visible,
  });

  const toggleSelectedPerson = (userId: string) =>
    setSelectedUserIds((ids) => (ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]));

  const shareLiveOrCopyLink = async () => {
    if (selectedUserIds.length > 0) {
      await liveService.shareLiveWithPeople(liveId, selectedUserIds).catch(() => undefined);
    } else {
      await Share.share({ message: webAppLinks.live(liveId) }).catch(() => undefined);
    }
    setSelectedUserIds([]);
    onShared?.();
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Share" floating style={styles.sheet}>
      <View style={styles.search}>
        <MagnifyingGlass16Icon />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor={colors.textSubtle}
          accessibilityLabel="Search people"
          style={styles.searchInput}
        />
      </View>
      <FlatList
        data={people.data ?? []}
        keyExtractor={(p) => p.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const selected = selectedUserIds.includes(item.id);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() => toggleSelectedPerson(item.id)}
              style={styles.person}
            >
              <Avatar uri={item.avatarUrl} size={40} />
              <View style={styles.personText}>
                <Text size={14} lineHeight={16.8}>
                  {item.name}
                </Text>
                <Text size={14} weight={500} lineHeight={16.8} color={colors.textSubtle}>
                  @{item.username}
                </Text>
              </View>
              <View style={[styles.check, selected && styles.checkOn]} />
            </Pressable>
          );
        }}
      />
      <View style={styles.action}>
        <Button
          title={selectedUserIds.length > 0 ? `Send to ${selectedUserIds.length}` : "Copy link"}
          icon={selectedUserIds.length > 0 ? undefined : <Copy16Icon />}
          onPress={shareLiveOrCopyLink}
          variant="primary"
        />
      </View>
    </BottomSheet>
  );
}


const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  sheet: { height: 442 },
  search: {
    marginHorizontal: 12,
    height: 33,
    borderWidth: 1,
    borderColor: colors.textSubtle,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchInput: { flex: 1, padding: 0, fontFamily: fontFamily[400], fontSize: 13, letterSpacing: calculateDefaultLetterSpacing(13), color: colors.text },
  list: { flex: 1, marginTop: 12 },
  listContent: { paddingHorizontal: 12, gap: 12 },
  person: { height: 40, flexDirection: "row", alignItems: "center", gap: 8 },
  personText: { flex: 1 },
  check: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.divider },
  checkOn: { borderColor: colors.primarySolid, backgroundColor: colors.primarySolid },
  action: { padding: 16, paddingTop: 8 },
}));
