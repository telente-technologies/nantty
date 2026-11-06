import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, StyleSheet, TextInput, View } from "react-native";

import { Check16Icon, MagnifyingGlass20Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import { messagesService } from "@/services/chat/messages.service";
import type { UserSummary } from "@/types";

import { PersonRow } from "./personRow";

export interface GroupMemberPickerProps {
  readonly selectedPeople: readonly UserSummary[];
  readonly onToggleSelectedPerson: (person: UserSummary) => void;
  readonly excludedUserIds?: readonly string[];
  readonly isInsideScrollView?: boolean;
  readonly searchPurpose?: "add" | "invite";
}

export function GroupMemberPicker({ selectedPeople, onToggleSelectedPerson, excludedUserIds = [], isInsideScrollView = false, searchPurpose = "add" }: GroupMemberPickerProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [searchQuery, setSearchQuery] = useState("");
  const people = useQuery({ queryKey: ["people-to-message", searchQuery], queryFn: () => messagesService.fetchPeopleToMessage(searchQuery) });
  const selectablePeople = (people.data ?? []).filter((person) => !excludedUserIds.includes(person.id));
  const isSelected = (person: UserSummary) => selectedPeople.some((selected) => selected.id === person.id);

  const renderSelectablePerson = (person: UserSummary) => (
    <PersonRow
      key={person.id}
      person={person}
      avatarSize={40}
      onPress={() => onToggleSelectedPerson(person)}
      right={
        <View style={[styles.checkbox, isSelected(person) && styles.checkboxSelected]} accessibilityRole="checkbox" accessibilityState={{ checked: isSelected(person) }}>
          {isSelected(person) ? <Check16Icon color={colors.white} /> : null}
        </View>
      }
    />
  );

  return (
    <View style={isInsideScrollView ? styles.rootInsideScrollView : styles.root}>
      <View style={styles.searchBox}>
        <MagnifyingGlass20Icon />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={searchPurpose === "invite" ? "Search people to invite" : "Search people to add"}
          placeholderTextColor={colors.textSubtle}
          autoCapitalize="none"
          accessibilityLabel={searchPurpose === "invite" ? "Search people to invite" : "Search people to add"}
          selectionColor={colors.primary}
          style={styles.searchInput}
        />
      </View>
      {selectedPeople.length > 0 ? (
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>
          {selectedPeople.length} selected: {selectedPeople.map((person) => person.name.split(" ")[0]).join(", ")}
        </Text>
      ) : null}
      {isInsideScrollView ? (
        <View style={styles.plainList}>{selectablePeople.map(renderSelectablePerson)}</View>
      ) : (
        <FlatList
          data={selectablePeople}
          keyExtractor={(person) => person.id}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          renderItem={({ item }) => renderSelectablePerson(item)}
        />
      )}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, gap: 12 },
  rootInsideScrollView: { gap: 12 },
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
  gap: { height: 8 },
  plainList: { gap: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.textSubtle, alignItems: "center", justifyContent: "center" },
  checkboxSelected: { backgroundColor: colors.primarySolid, borderColor: colors.primary },
}));
