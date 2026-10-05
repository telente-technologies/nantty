import { forwardRef } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Cancel20Icon, MagnifyingGlass20Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { fontFamily } from "@/constants/typography.constant";

export interface SearchBarScopeChip {
  readonly label: string;
  readonly onClear: () => void;
}

export interface SearchBarProps {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly placeholder?: string;
  readonly scopeChip?: SearchBarScopeChip | null;
  readonly onSubmitEditing?: () => void;
  readonly autoFocus?: boolean;
}

export const SearchBar = forwardRef<TextInput, SearchBarProps>(function SearchBar({ value, onChangeText, placeholder = "Search", scopeChip, onSubmitEditing, autoFocus }, ref) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.box}>
      <MagnifyingGlass20Icon />
      {scopeChip ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${scopeChip.label}. Remove to search everywhere`}
          hitSlop={10}
          onPress={scopeChip.onClear}
          style={styles.chip}
        >
          <Text size={12} weight={500} lineHeight={15.6} color={colors.text} numberOfLines={1} style={styles.chipText}>{scopeChip.label}</Text>
          <Cancel20Icon size={14} color={colors.textMuted} />
        </Pressable>
      ) : null}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        autoFocus={autoFocus}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel={placeholder}
        style={styles.input}
      />
    </View>
  );
});

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  box: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.textSubtle,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chip: { maxWidth: "50%", height: 26, paddingLeft: 10, paddingRight: 6, borderRadius: 13, backgroundColor: colors.chip, flexDirection: "row", alignItems: "center", gap: 4 },
  chipText: { flexShrink: 1 },
  input: { flex: 1, height: "100%", padding: 0, fontFamily: fontFamily[400], fontSize: 13, color: colors.text },
}));
