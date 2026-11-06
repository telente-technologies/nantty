import { StyleSheet, Switch, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

export interface ConsentToggleRowProps {
  readonly label: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly disabled?: boolean;
  readonly onChange: (enabled: boolean) => void;
}

export function ConsentToggleRow({ label, description, enabled, disabled = false, onChange }: ConsentToggleRowProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text size={14} weight={500} lineHeight={16.8}>{label}</Text>
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        value={enabled}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.divider }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 12 },
  text: { flex: 1, gap: 4 },
});
