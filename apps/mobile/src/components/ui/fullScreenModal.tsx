import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Cancel20Icon } from "@/components/icons";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { makeThemedStyles, useTheme } from "@/theme";

import { useAccessibilityFocusOnOpen } from "./accessibilityFocus.hook";
import { dismissKeyboardIfVisible, KEYBOARD_DISMISS_ON_DRAG } from "./dismissKeyboardOnEmptyTap.util";
import { FrameAwareModal } from "./frameAwareModal";
import { useKeepFocusedInputVisible } from "./keepFocusedInputVisible.hook";
import { KeyboardSpacer } from "./keyboardSpacer";
import { ModalActionStack, type ModalAction } from "./modalActions";
import { buildModalPalette, modalSpacing } from "./modalChrome.constant";
import { Text } from "./text";

export interface FullScreenModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly title?: string;
  readonly closeLabel?: string;
  readonly dismissible?: boolean;
  readonly headerAccessory?: ReactNode;
  readonly footer?: ReactNode;
  readonly footerActions?: readonly ModalAction[];
  readonly scrollable?: boolean;
  readonly children: ReactNode;
}

export function FullScreenModal({
  visible,
  onClose,
  title,
  closeLabel = "Close",
  dismissible = true,
  headerAccessory,
  footer,
  footerActions,
  scrollable = true,
  children,
}: FullScreenModalProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotionPreference();
  const keepFocusedInputVisible = useKeepFocusedInputVisible({ enabled: visible && scrollable });
  const hasFooter = !!footer || (footerActions?.length ?? 0) > 0;
  const titleRef = useAccessibilityFocusOnOpen(visible && !!title);
  return (
    <FrameAwareModal visible={visible} animationType={reduceMotion ? "none" : "slide"} onRequestClose={() => dismissible && onClose()} statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top }]} accessibilityViewIsModal>
        <View style={styles.header}>
          {dismissible ? (
            <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} style={styles.closeButton}>
              <Cancel20Icon size={18} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.closeButtonSpacer} />
          )}
          <View ref={titleRef} style={styles.titleBox} accessible={!!title} accessibilityRole="header" accessibilityLabel={title}>
            <Text size={16} weight={600} lineHeight={21} numberOfLines={1} style={styles.title}>
              {title ?? ""}
            </Text>
          </View>
          <View style={styles.accessory}>{headerAccessory}</View>
        </View>
        {scrollable ? (
          <ScrollView {...keepFocusedInputVisible.scrollProps} style={styles.flex} contentContainerStyle={styles.grow} keyboardDismissMode={KEYBOARD_DISMISS_ON_DRAG} keyboardShouldPersistTaps="handled">
            <Pressable accessible={false} onPress={dismissKeyboardIfVisible} style={styles.content}>
              {children}
            </Pressable>
          </ScrollView>
        ) : (
          <View style={styles.flex}>{children}</View>
        )}
        {hasFooter ? (
          <View style={styles.footer}>
            {footer}
            {footerActions ? <ModalActionStack actions={footerActions} /> : null}
          </View>
        ) : null}
        <KeyboardSpacer restingHeight={Math.max(insets.bottom, hasFooter ? 12 : 0)} style={styles.keyboardArea} />
      </View>
    </FrameAwareModal>
  );
}

const useStyles = makeThemedStyles((colors, scheme) => {
  const palette = buildModalPalette(colors, scheme);
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    header: { minHeight: 52, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
    closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: palette.inset },
    closeButtonSpacer: { width: 44 },
    titleBox: { flex: 1 },
    title: { textAlign: "center" },
    accessory: { minWidth: 44, alignItems: "flex-end" },
    grow: { flexGrow: 1 },
    content: { flexGrow: 1, padding: 16, paddingBottom: 32 },
    footer: { paddingHorizontal: modalSpacing.edge - 4, paddingTop: 12, gap: modalSpacing.actionGap, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, backgroundColor: colors.background },
    keyboardArea: { backgroundColor: colors.background },
  });
});
