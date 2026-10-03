import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Cancel20Icon } from "@/components/icons";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { makeThemedStyles, useTheme } from "@/theme";

import { FrameAwareModal } from "./frameAwareModal";
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
  const hasFooter = !!footer || (footerActions?.length ?? 0) > 0;
  return (
    <FrameAwareModal visible={visible} animationType={reduceMotion ? "none" : "slide"} onRequestClose={() => dismissible && onClose()} statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top }]} accessibilityViewIsModal>
        <View style={styles.header}>
          {dismissible ? (
            <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} hitSlop={12} onPress={onClose} style={styles.closeButton}>
              <Cancel20Icon size={18} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.closeButtonSpacer} />
          )}
          <Text size={16} weight={600} lineHeight={21} numberOfLines={1} style={styles.title} accessibilityRole="header">
            {title ?? ""}
          </Text>
          <View style={styles.accessory}>{headerAccessory}</View>
        </View>
        {scrollable ? (
          <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
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
    closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: palette.inset },
    closeButtonSpacer: { width: 36 },
    title: { flex: 1, textAlign: "center" },
    accessory: { minWidth: 36, alignItems: "flex-end" },
    content: { padding: 16, paddingBottom: 32 },
    footer: { paddingHorizontal: modalSpacing.edge - 4, paddingTop: 12, gap: modalSpacing.actionGap, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, backgroundColor: colors.background },
    keyboardArea: { backgroundColor: colors.background },
  });
});
