import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Check16Icon, CaretRight24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

export interface GeoPickerOption {
  readonly id: string;
  readonly name: string;
  readonly searchText?: string;
}

export interface GeoPickerFieldProps {
  readonly label: string;
  readonly options: readonly GeoPickerOption[];
  readonly selectedId: string | null;
  readonly onSelect: (option: GeoPickerOption) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
}

export function GeoPickerField({ label, options, selectedId, onSelect, disabled = false, placeholder }: GeoPickerFieldProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((option) => option.id === selectedId);
  const query = search.trim().toLowerCase();
  const visibleOptions = options.filter((option) => `${option.name} ${option.searchText ?? ""}`.toLowerCase().includes(query));
  const close = () => {
    setOpen(false);
    setSearch("");
  };

  return (
    <View style={styles.field}>
      <Text size={14} lineHeight={16.8}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${selected?.name ?? "not selected"}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.box, disabled && styles.disabled]}
      >
        <Text size={14} lineHeight={16.8} color={selected ? colors.text : colors.textSubtle} style={styles.value}>
          {selected?.name ?? placeholder ?? `Select ${label.toLowerCase()}`}
        </Text>
        <CaretRight24Icon />
      </Pressable>
      <BottomSheet visible={open} onClose={close} title={label}>
        <View style={styles.search}>
          <TextField placeholder={`Search ${label.toLowerCase()}`} value={search} onChangeText={setSearch} autoCorrect={false} />
        </View>
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {visibleOptions.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: option.id === selectedId }}
              onPress={() => {
                onSelect(option);
                close();
              }}
              style={styles.row}
            >
              <Text size={14} lineHeight={16.8}>{option.name}</Text>
              {option.id === selectedId ? <Check16Icon color={colors.primary} /> : null}
            </Pressable>
          ))}
          {visibleOptions.length === 0 ? (
            <Text size={13} lineHeight={16.9} color={colors.textMuted} align="center" style={styles.empty}>No matches</Text>
          ) : null}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  field: { gap: 8 },
  box: { minHeight: 48, borderWidth: 1, borderColor: colors.textSubtle, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  disabled: { opacity: 0.5 },
  value: { flex: 1 },
  search: { paddingHorizontal: 16, paddingBottom: 8 },
  list: { flexShrink: 1, maxHeight: 360, paddingHorizontal: 16 },
  row: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.background },
  empty: { paddingVertical: 24 },
}));
