import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { buildModalPalette } from "@/components/ui/modalChrome.constant";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { UserSummary } from "@/types";

export type LiveSheetActionTone = "neutral" | "primary" | "danger";

export function LiveSheetActionButton({ label, onPress, tone = "neutral", disabled }: { label: string; onPress: () => void; tone?: LiveSheetActionTone; disabled?: boolean }) {
  const styles = useStyles();
  const { colors, scheme } = useTheme();
  const palette = buildModalPalette(colors, scheme);
  const ink = tone === "primary" ? colors.onPrimary : tone === "danger" ? palette.destructiveInk : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.action, tone === "primary" ? styles.actionPrimary : tone === "danger" ? styles.actionDanger : null, disabled ? styles.actionDisabled : null, pressed ? styles.pressed : null]}
    >
      <Text size={12} weight={600} lineHeight={16} color={ink}>
        {label}
      </Text>
    </Pressable>
  );
}

export function LiveSheetPersonRow({ user, caption, children }: { user: UserSummary; caption?: string; children?: ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Avatar uri={user.avatarUrl} size={40} />
      <View style={styles.flex}>
        <Text size={14} weight={500} lineHeight={19} numberOfLines={1}>
          {user.name}
        </Text>
        <Text size={12} lineHeight={16} color={colors.textMuted} numberOfLines={1}>
          {caption ?? `@${user.username}`}
        </Text>
      </View>
      <View style={styles.actions}>{children}</View>
    </View>
  );
}

export function LiveSheetSectionTitle({ children, icon }: { children: string; icon?: ReactNode }) {
  const { colors } = useTheme();
  if (!icon) {
    return (
      <Text size={12} weight={600} lineHeight={16} letterSpacing={0.4} color={colors.textMuted} style={sectionTitleStyle.title} accessibilityRole="header">
        {children.toUpperCase()}
      </Text>
    );
  }
  return (
    <View style={sectionTitleStyle.row}>
      {icon}
      <Text size={12} weight={600} lineHeight={16} letterSpacing={0.4} color={colors.textMuted} accessibilityRole="header">
        {children.toUpperCase()}
      </Text>
    </View>
  );
}

const sectionTitleStyle = StyleSheet.create({ title: { marginTop: 10 }, row: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 } });

const useStyles = makeThemedStyles((colors, scheme) => {
  const palette = buildModalPalette(colors, scheme);
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 },
    flex: { flex: 1 },
    actions: { flexDirection: "row", gap: 6 },
    action: { minHeight: 32, borderRadius: 16, borderWidth: 1, borderColor: palette.secondaryBorder, paddingHorizontal: 12, justifyContent: "center" },
    actionPrimary: { backgroundColor: colors.primarySolid, borderColor: colors.primarySolid },
    actionDanger: { borderColor: palette.destructiveInk },
    actionDisabled: { opacity: 0.45 },
    pressed: { opacity: 0.8 },
  });
});
