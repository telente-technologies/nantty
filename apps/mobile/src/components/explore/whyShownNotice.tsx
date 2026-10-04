import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Question24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { RankingExplanation } from "@/types/explore.type";

export interface WhyShownNoticeProps {
  readonly explanations: readonly RankingExplanation[];
}

export function WhyShownNotice({ explanations }: WhyShownNoticeProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  if (explanations.length === 0) return null;
  return (
    <View style={styles.root}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((value) => !value)} style={styles.toggle} hitSlop={8}>
        <Question24Icon size={14} />
        <Text size={12} color={colors.textSubtle}>{open ? "Hide why you're seeing this" : "Why am I seeing this?"}</Text>
      </Pressable>
      {open ? (
        <View style={styles.list}>
          {explanations.map((explanation) => (
            <Text key={`${explanation.code}-${explanation.label}`} size={12} lineHeight={17} color={colors.textMuted}>
              {explanation.label}{explanation.detail && explanation.code.endsWith("boost") ? `. ${explanation.detail}.` : ""}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 16, paddingTop: 8, gap: 4 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  list: { gap: 2, paddingLeft: 20 },
});
