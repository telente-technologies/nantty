import { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { MagnifyingGlass16Icon } from "@/components/icons";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import { makeThemedStyles, useTheme } from "@/theme";

const SEARCH_DEBOUNCE_MS = 250;

export function useDebouncedSearchText() {
  const [typed, setTyped] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(typed.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typed]);
  return { typed, setTyped, debounced };
}

export function SearchField({ value, onChangeText, label }: { readonly value: string; readonly onChangeText: (text: string) => void; readonly label: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <MagnifyingGlass16Icon />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={colors.inputPlaceholderText}
        selectionColor={colors.primary}
        accessibilityLabel={label}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        style={styles.input}
      />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  field: { height: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.divider, borderRadius: 22, backgroundColor: colors.background, flexDirection: "row", alignItems: "center", gap: 8 },
  input: { flex: 1, height: "100%", padding: 0, fontFamily: fontFamily[400], fontSize: 14, letterSpacing: calculateDefaultLetterSpacing(14), color: colors.text },
}));
