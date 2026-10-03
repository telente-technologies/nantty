import { Pressable, StyleSheet, View } from "react-native";

import { Check16Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import type { ThemePreference } from "@/store/themePreference.store";
import { makeThemedStyles, useTheme } from "@/theme";

interface ThemePreferenceOption {
  readonly value: ThemePreference;
  readonly label: string;
  readonly description: string;
  readonly isBeta?: boolean;
}

const THEME_PREFERENCE_OPTIONS: readonly ThemePreferenceOption[] = [
  { value: "light", label: "Light Mode", description: "The default Zudomart look" },
  { value: "dark", label: "Dark Mode", description: "Easier on the eyes at night", isBeta: true },
  { value: "system", label: "System", description: "Match your phone's appearance setting" },
];

export const describeThemePreference = (preference: ThemePreference) => THEME_PREFERENCE_OPTIONS.find((option) => option.value === preference)?.label ?? "Light Mode";

export interface ThemePreferenceSheetProps {
  readonly visible: boolean;
  readonly selectedPreference: ThemePreference;
  readonly onSelect: (preference: ThemePreference) => void;
  readonly onClose: () => void;
}

export function ThemePreferenceSheet({ visible, selectedPreference, onSelect, onClose }: ThemePreferenceSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Theme">
      <View style={styles.content} accessibilityRole="radiogroup">
        {THEME_PREFERENCE_OPTIONS.map((option) => {
          const selected = option.value === selectedPreference;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={option.isBeta ? `${option.label}, beta. ${option.description}` : `${option.label}. ${option.description}`}
              onPress={() => onSelect(option.value)}
              style={styles.row}
            >
              <View style={styles.text}>
                <View style={styles.labelRow}>
                  <Text size={14} lineHeight={16.8}>
                    {option.label}
                  </Text>
                  {option.isBeta ? (
                    <View style={styles.betaPill}>
                      <Text size={11} weight={500} lineHeight={14} color={colors.primary}>
                        Beta
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text size={12} lineHeight={16.8} color={colors.textMuted}>
                  {option.description}
                </Text>
              </View>
              {selected ? <Check16Icon color={colors.primary} /> : null}
            </Pressable>
          );
        })}
        <Text size={12} lineHeight={16.8} color={colors.textSubtle} style={styles.note}>
          Dark mode is in beta. Live and Clips always stay dark.
        </Text>
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    content: { paddingHorizontal: 16, paddingBottom: 16 },
    row: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.background },
    text: { gap: 2, flexShrink: 1 },
    labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    betaPill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: colors.primaryTint },
    note: { marginTop: 12 },
  }),
);
