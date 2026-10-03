import { StyleSheet, Switch, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

export function AiGeneratedToggleRow({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <Text size={14} weight={500} lineHeight={16.8}>AI generated</Text>
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>Turn on if this was made or heavily edited with AI. Viewers will see a label.</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel="AI generated"
        trackColor={{ true: colors.primary, false: colors.divider }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  texts: { flex: 1, gap: 2 },
});
