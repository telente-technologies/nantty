import { StyleSheet, Switch, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

export interface SettingToggleRowProps {
  readonly label: string;
  readonly description?: string;
  readonly value: boolean;
  readonly disabled?: boolean;
  readonly onValueChange: (value: boolean) => void;
}

export function SettingToggleRow({ label, description, value, disabled, onValueChange }: SettingToggleRowProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text size={14} lineHeight={16.8}>{label}</Text>
        {description ? <Text size={12} lineHeight={16} color={colors.textMuted}>{description}</Text> : null}
      </View>
      <Switch accessibilityLabel={label} value={value} disabled={disabled} onValueChange={onValueChange} trackColor={{ true: colors.primary }} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 52 },
  text: { flex: 1, gap: 2 },
});
