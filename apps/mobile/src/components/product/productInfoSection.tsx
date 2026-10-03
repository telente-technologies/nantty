import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { CaretDown24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

export interface ProductInfoSectionProps {
  readonly title: string;
  readonly body: string;
  readonly collapsible?: boolean;
}

export function ProductInfoSection({ title, body, collapsible = false }: ProductInfoSectionProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(true);
  const heading = (
    <Text size={16} weight={600} lineHeight={19.2} accessibilityRole="header">
      {title}
    </Text>
  );
  return (
    <View style={styles.section}>
      {collapsible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((open) => !open)}
          style={styles.titleRow}
        >
          {heading}
          <CaretDown24Icon style={expanded ? undefined : styles.caretCollapsed} />
        </Pressable>
      ) : (
        <View style={styles.titleRow}>{heading}</View>
      )}
      {expanded ? (
        <Text size={13} lineHeight={16.9} color={colors.textMuted}>
          {body}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  titleRow: { minHeight: 19, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  caretCollapsed: { transform: [{ rotate: "-90deg" }] },
});
