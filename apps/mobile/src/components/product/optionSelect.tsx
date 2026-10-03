import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { CaretDown24Icon, Check16Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

export interface OptionSelectProps {
  readonly label: string;
  readonly placeholder: string;
  readonly options: readonly string[];
  readonly value: string | null;
  readonly onChange: (value: string) => void;
  readonly trailingValue?: string;
}

export function OptionSelect({ label, placeholder, options, value, onChange, trailingValue }: OptionSelectProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <View style={styles.field}>
      <Text size={14} weight={500} lineHeight={16.8}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ?? placeholder}`}
        onPress={() => setPickerOpen(true)}
        style={styles.box}
      >
        <Text size={13} weight={500} lineHeight={16.9} color={value && !trailingValue ? colors.black : colors.textMuted}>
          {trailingValue ? placeholder : value ?? placeholder}
        </Text>
        <View style={styles.trailing}>
          {trailingValue ? (
            <Text size={14} weight={500} lineHeight={16.8} color={colors.textMuted}>
              {trailingValue}
            </Text>
          ) : null}
          <CaretDown24Icon />
        </View>
      </Pressable>
      <BottomSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title={label}>
        <ScrollView style={styles.options}>
          {options.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: option === value }}
              onPress={() => {
                onChange(option);
                setPickerOpen(false);
              }}
              style={styles.option}
            >
              <Text size={14} weight={option === value ? 500 : 400} lineHeight={16.8}>
                {option}
              </Text>
              {option === value ? <Check16Icon color={colors.primary} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  field: { gap: 12 },
  box: {
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.textSubtle,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trailing: { flexDirection: "row", alignItems: "center", gap: 4 },
  options: { maxHeight: 360, paddingHorizontal: 16, marginBottom: 16 },
  option: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
}));
