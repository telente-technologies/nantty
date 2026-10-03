import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { makeThemedStyles, useTheme } from "@/theme";

import { BottomSheet } from "./bottomSheet";
import { buildModalPalette, modalRadius } from "./modalChrome.constant";
import { playDestructiveConfirmHaptic } from "./modalActions";
import { Text } from "./text";

export interface ActionSheetOption {
  readonly label: string;
  readonly onPress: () => void;
  readonly icon?: ReactNode;
  readonly detail?: string;
  readonly destructive?: boolean;
  readonly disabled?: boolean;
}

export interface ActionSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly options: readonly ActionSheetOption[];
  readonly title?: string;
  readonly subtitle?: string;
  readonly cancelLabel?: string;
  readonly closeBeforeSelect?: boolean;
}

export function ActionSheetOptionList({ options }: { readonly options: readonly ActionSheetOption[] }) {
  const styles = useStyles();
  const { colors, scheme } = useTheme();
  const palette = buildModalPalette(colors, scheme);
  return (
    <View style={styles.group}>
      {options.map((option, index) => (
        <Pressable
          key={option.label}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityHint={option.detail}
          accessibilityState={{ disabled: !!option.disabled }}
          disabled={option.disabled}
          onPress={() => {
            if (option.destructive) playDestructiveConfirmHaptic();
            option.onPress();
          }}
          style={({ pressed }) => [styles.row, index > 0 ? styles.rowDivider : null, pressed ? styles.pressed : null, option.disabled ? styles.disabled : null]}
        >
          {option.icon ? <View style={styles.icon}>{option.icon}</View> : null}
          <View style={styles.text}>
            <Text size={15} weight={500} lineHeight={20} color={option.destructive ? palette.destructiveInk : colors.text} maxFontSizeMultiplier={1.8}>
              {option.label}
            </Text>
            {option.detail ? (
              <Text size={12} lineHeight={16} color={colors.textMuted} maxFontSizeMultiplier={1.8}>
                {option.detail}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

export function ActionSheet({ visible, onClose, options, title, subtitle, cancelLabel = "Cancel", closeBeforeSelect = true }: ActionSheetProps) {
  const styles = useStyles();
  const wrapped = options.map((option) => ({
    ...option,
    onPress: () => {
      if (closeBeforeSelect) onClose();
      option.onPress();
    },
  }));
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} subtitle={subtitle} floating footerActions={[{ label: cancelLabel, style: "secondary", onPress: onClose }]}>
      <View style={[styles.body, title ? null : styles.bodyWithoutTitle]}>
        <ActionSheetOptionList options={wrapped} />
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors, scheme) => {
  const palette = buildModalPalette(colors, scheme);
  return StyleSheet.create({
    body: { paddingHorizontal: 16, paddingBottom: 4 },
    bodyWithoutTitle: { paddingTop: 12 },
    group: { borderRadius: modalRadius.card, backgroundColor: palette.inset, overflow: "hidden" },
    row: { minHeight: 52, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
    pressed: { backgroundColor: palette.secondaryPressed },
    disabled: { opacity: 0.45 },
    icon: { width: 24, alignItems: "center" },
    text: { flex: 1, gap: 2 },
  });
});
