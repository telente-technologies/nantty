import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";

import { PersonRow } from "@/components/chat/personRow";
import { useDebouncedSearchText } from "@/components/create/settings/searchField";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Cancel20Icon, MagnifyingGlass20Icon } from "@/components/icons";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { messagesService } from "@/services/chat/messages.service";
import { spacing } from "@/constants/spacing.constant";

export function NewMessageScreen({ navigation }: MainScreenProps<"NewMessage">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { typed: query, setTyped: setQuery, debounced } = useDebouncedSearchText();
  const people = useQuery({ queryKey: ["people-to-message", debounced], queryFn: () => messagesService.fetchPeopleToMessage(debounced), placeholderData: (previous) => previous });

  return (
    <Screen background={colors.surface}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={styles.close} onPress={() => navigation.goBack()}>
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
          people.isPending ? (
            <ListSkeleton padding={0} />
          ) : people.isError ? (
            <ErrorState error={people.error} compact message="Couldn't load people." onRetry={() => people.refetch()} retrying={people.isRefetching} />
          ) : (
            <EmptyState compact title={debounced ? `No one matches “${debounced}”` : "No one to message yet"} body={debounced ? "Check the spelling or try their username." : "Follow people to start a conversation."} />
          )
        }
        renderItem={({ item }) => (
          <PersonRow person={item} onPress={() => navigation.replace("Chat", { userId: item.id, name: item.name })} />
        )}
      />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  header: { height: 49, paddingHorizontal: spacing[1], flexDirection: "row", alignItems: "center", gap: spacing[3] },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  searchBox: {
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    height: 44,
    borderWidth: 1,
    borderColor: colors.textSubtle,
    borderRadius: 8,
    paddingHorizontal: spacing[2],
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
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
  list: { paddingHorizontal: spacing[4], paddingTop: spacing[6], paddingBottom: spacing[8] },
  gap: { height: 8 },
}));
