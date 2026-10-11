import * as Haptics from "expo-haptics";
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { makeThemedStyles } from "@/theme";

import { buildModalPalette, modalRadius, modalSpacing } from "./modalChrome.constant";
import { Text } from "./text";

export type ModalActionStyle = "primary" | "secondary" | "destructive" | "plain";

export interface ModalAction {
  readonly label: string;
  readonly onPress?: () => unknown;
  readonly style?: ModalActionStyle;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly accessibilityHint?: string;
}

export function playDestructiveConfirmHaptic(): void {
  if (Platform.OS === "web") return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
}

export function ModalActionButton({ action }: { readonly action: ModalAction }) {
  const styles = useStyles();
  const variant = action.style ?? "secondary";
  const inactive = !!action.disabled || !!action.loading;
  const press = () => {
    if (inactive) return;
    if (variant === "destructive") playDestructiveConfirmHaptic();
    void action.onPress?.();
  };
  const look = styles.looks[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityHint={action.accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: !!action.loading }}
      disabled={inactive}
      onPress={press}
      style={({ pressed }) => [styles.base, look.container, inactive && variant !== "plain" ? styles.inactive : null, pressed && !inactive ? look.pressed : null]}
    >
      {action.loading ? (
        <ActivityIndicator color={look.ink} />
      ) : (
        <Text size={15} weight={600} lineHeight={20} align="center" color={look.ink} maxFontSizeMultiplier={1.8}>
          {action.label}
        </Text>
      )}
    </Pressable>
  );
}

export function ModalActionStack({ actions, style }: { readonly actions: readonly ModalAction[]; readonly style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  if (actions.length === 0) return null;
  return (
    <View style={[styles.stack, style]}>
      {actions.slice(0, 3).map((action) => (
        <ModalActionButton key={action.label} action={action} />
      ))}
    </View>
  );
}

const useStyles = makeThemedStyles((colors, scheme) => {
  const palette = buildModalPalette(colors, scheme);
  const looks: Record<ModalActionStyle, { container: ViewStyle; pressed: ViewStyle; ink: string }> = {
    primary: { container: { backgroundColor: colors.primarySolid }, pressed: { backgroundColor: colors.primaryDark }, ink: colors.onPrimary },
    destructive: { container: { backgroundColor: palette.destructiveSolid }, pressed: { opacity: 0.88 }, ink: "#FFFFFF" },
    secondary: { container: { borderWidth: 1, borderColor: palette.secondaryBorder }, pressed: { backgroundColor: palette.secondaryPressed }, ink: palette.ink },
    plain: { container: {}, pressed: { backgroundColor: palette.secondaryPressed }, ink: palette.inkMuted },
  };
  return {
    looks,
    ...StyleSheet.create({
      base: { minHeight: modalSpacing.actionHeight, paddingHorizontal: 16, paddingVertical: 12, borderRadius: modalRadius.action, alignItems: "center", justifyContent: "center" },
      inactive: { opacity: 0.45 },
      stack: { gap: modalSpacing.actionGap },
    }),
  };
});
