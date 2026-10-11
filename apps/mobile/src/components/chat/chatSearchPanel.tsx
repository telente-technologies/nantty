import { useQuery } from "@tanstack/react-query";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useContext, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { MagnifyingGlass20Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { KeyboardSpacer } from "@/components/ui/keyboardSpacer";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import { messagesService } from "@/services/chat/messages.service";
import type { UserSummary } from "@/types";

import { SmallTab } from "./smallTab";

export interface ChatSearchPanelProps {
  readonly onOpenConversation: (conversationId: string, name: string) => void;
  readonly onOpenPerson: (person: UserSummary) => void;
}

export function ChatSearchPanel({ onOpenConversation, onOpenPerson }: ChatSearchPanelProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const [query, setQuery] = useState("");
  const results = useQuery({
    queryKey: ["chat-search", query],
    queryFn: () => messagesService.searchConversationsAndPeople(query),
  });
  return (
    <View style={styles.root}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.searchBox}>
          <MagnifyingGlass20Icon />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={colors.textSubtle}
            autoFocus
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Search messages and people"
            selectionColor={colors.primary}
            style={styles.searchInput}
          />
        </View>
        <View style={styles.section}>
          <SmallTab label="Messages" />
          {results.data?.conversations.map((result) => (
            <Pressable
              key={result.id}
              accessibilityRole="button"
              onPress={() => onOpenConversation(result.id, result.peer.name)}
              style={styles.messageResult}
            >
              <Avatar uri={result.peer.avatarUrl} size={40} placeholderColor={colors.primaryTint} />
              <View style={styles.messageText}>
                <Text size={14} weight={500} lineHeight={16.8}>
                  {result.peer.name}
                </Text>
                <Text size={13} lineHeight={16.9} color={colors.textSubtle} numberOfLines={1}>
                  {result.snippet}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
        <View style={styles.divider} />
        <View style={styles.section}>
          <SmallTab label="People" />
          <View style={styles.peopleRow}>
            {results.data?.people.slice(0, 4).map((person) => (
              <Pressable key={person.id} accessibilityRole="button" onPress={() => onOpenPerson(person)} style={styles.person}>
                <Avatar uri={person.avatarUrl} size={84} placeholderColor={colors.placeholder} />
                <Text size={13} weight={500} lineHeight={16.9} align="center" numberOfLines={1}>
                  {person.name.split(" ")[0]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
      <KeyboardSpacer restingHeight={0} offset={tabBarHeight} />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  searchBox: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.textSubtle,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    padding: 0,
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: calculateDefaultLetterSpacing(14),
    color: colors.text,
  },
  section: { marginTop: 8, gap: 12, alignItems: "flex-start", minHeight: 186 },
  messageResult: { flexDirection: "row", alignItems: "center", gap: 12, alignSelf: "stretch" },
  messageText: { flex: 1, gap: 2 },
  divider: { height: 0.5, backgroundColor: colors.divider, marginHorizontal: -16, marginTop: 8 },
  peopleRow: { flexDirection: "row", justifyContent: "space-between", alignSelf: "stretch" },
  person: { width: 84, gap: 4, alignItems: "center" },
}));
