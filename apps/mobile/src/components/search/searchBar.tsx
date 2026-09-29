import { forwardRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { MagnifyingGlass20Icon } from "@/components/icons";
import { colors } from "@/constants/colors.constant";
import { fontFamily } from "@/constants/typography.constant";

export interface SearchBarProps {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly placeholder?: string;
}

export const SearchBar = forwardRef<TextInput, SearchBarProps>(function SearchBar({ value, onChangeText, placeholder = "Search" }, ref) {
  return (
    <View style={styles.box}>
      <MagnifyingGlass20Icon />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
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

const styles = StyleSheet.create({
  box: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.textSubtle,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: { flex: 1, height: "100%", padding: 0, fontFamily: fontFamily[400], fontSize: 13, color: colors.text },
});
