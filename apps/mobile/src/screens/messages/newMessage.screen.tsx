import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";

import { PersonRow } from "@/components/chat/personRow";
import { Cancel20Icon, MagnifyingGlass20Icon } from "@/components/icons";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { messagesService } from "@/services/messages.service";

export function NewMessageScreen({ navigation }: MainScreenProps<"NewMessage">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [query, setQuery] = useState("");
  const people = useQuery({ queryKey: ["people-to-message", query], queryFn: () => messagesService.fetchPeopleToMessage(query) });

  return (
    <Screen background={colors.surface}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={() => navigation.goBack()}>
          <Cancel20Icon />
        </Pressable>
        <Text size={21} weight={500} lineHeight={25.2} letterSpacing={-0.42} accessibilityRole="header">
          New message
        </Text>
      </View>
      <View style={styles.searchBox}>
        <MagnifyingGlass20Icon />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search people"
          placeholderTextColor={colors.textSubtle}
          autoFocus
          autoCapitalize="none"
          accessibilityLabel="Search people"
          selectionColor={colors.primary}
          style={styles.searchInput}
        />
      </View>
      <FlatList
        data={people.data ?? []}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={
          people.isSuccess ? (
            <Text size={13} lineHeight={16.9} color={colors.textSubtle} align="center">
              No one matches “{query}”.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <PersonRow person={item} onPress={() => navigation.replace("Chat", { userId: item.id, name: item.name })} />
        )}
      />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  header: { height: 49, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 24 },
  searchBox: {
    marginHorizontal: 16,
    marginTop: 8,
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
  list: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40 },
  gap: { height: 8 },
}));
