import { Pressable, StyleSheet, View } from "react-native";

import { Check16Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

export interface RoundCheckboxProps {
  readonly checked: boolean;
  readonly onToggle: () => void;
  readonly label: string;
}

export function RoundCheckbox({ checked, onToggle, label }: RoundCheckboxProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onToggle} style={styles.row}>
      <View style={[styles.circle, checked ? styles.checkedCircle : styles.uncheckedCircle]}>
        {checked ? <Check16Icon size={12} color={colors.white} /> : null}
      </View>
      <Text size={13} weight={500} lineHeight={16.9} color={colors.textSubtle} style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 5 },
  circle: { width: 20, height: 20, borderRadius: 10, marginTop: 1, alignItems: "center", justifyContent: "center" },
  uncheckedCircle: { borderWidth: 2, borderColor: colors.black },
  checkedCircle: { backgroundColor: colors.primarySolid },
  label: { flex: 1 },
}));
