import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, SlideInDown } from "react-native-reanimated";
import { useSafeAreaFrame, useSafeAreaInsets } from "react-native-safe-area-context";

import { Cancel20Icon } from "@/components/icons";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { makeThemedStyles, useTheme } from "@/theme";

import { useAccessibilityFocusOnOpen } from "./accessibilityFocus.hook";
import { FrameAwareModal } from "./frameAwareModal";
import { useKeepFocusedInputVisible } from "./keepFocusedInputVisible.hook";
import { KeyboardSpacer } from "./keyboardSpacer";
import { ModalActionStack, type ModalAction } from "./modalActions";
import { buildModalElevation, buildModalPalette, modalMotion, modalRadius, modalSpacing } from "./modalChrome.constant";
import { useSheetDragDismiss } from "./sheetDragDismiss.hook";
import { Text } from "./text";

const SHEET_TOP_GAP = 12;
const FLOATING_GAP = 14;
const MAX_HEIGHT_RATIO = 0.9;

export interface BottomSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly title?: string;
  readonly subtitle?: string;
  readonly titleSize?: number;
  readonly floating?: boolean;
  readonly scrollable?: boolean;
  readonly dismissible?: boolean;
  readonly showHandle?: boolean;
  readonly footer?: ReactNode;
  readonly footerActions?: readonly ModalAction[];
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  titleSize = 17,
  floating = false,
  scrollable = false,
  dismissible = true,
  showHandle = true,
  footer,
  footerActions,
  children,
  style,
}: BottomSheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const reduceMotion = useReducedMotionPreference();
  const keepFocusedInputVisible = useKeepFocusedInputVisible({ enabled: visible && scrollable });
  const tallestSheetHeight = Math.min(frame.height * MAX_HEIGHT_RATIO, frame.height - insets.top - SHEET_TOP_GAP);
  const hasFooter = !!footer || (footerActions?.length ?? 0) > 0;
  const closeIfDismissible = () => {
    if (dismissible) onClose();
  };
  const { panHandlers, dragStyle } = useSheetDragDismiss(visible, dismissible, onClose);
  const titleRef = useAccessibilityFocusOnOpen(visible && !!title);
  return (
    <FrameAwareModal visible={visible} transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={closeIfDismissible} statusBarTranslucent>
      <View style={[styles.flex, { paddingTop: insets.top + SHEET_TOP_GAP }]}>
        <Pressable accessibilityLabel="Close" accessible={dismissible} style={styles.backdrop} onPress={closeIfDismissible} />
        <Animated.View style={[styles.dragArea, dragStyle]}>
          <Animated.View
            entering={reduceMotion ? undefined : SlideInDown.duration(modalMotion.enterMs + 40).easing(Easing.out(Easing.cubic))}
            style={[styles.sheet, { maxHeight: tallestSheetHeight }, floating ? styles.floating : null, style]}
            accessibilityViewIsModal
          >
            <View {...panHandlers}>
              {showHandle ? (
                <View style={styles.handleZone} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <View style={styles.handle} />
                </View>
              ) : null}
              {title ? (
                <View style={[styles.titleRow, showHandle ? styles.titleRowAfterHandle : null]}>
                  <View style={styles.titleText}>
                    <View ref={titleRef} accessible accessibilityRole="header" accessibilityLabel={title}>
                      <Text size={titleSize} weight={600} lineHeight={Math.round(titleSize * 1.3)} maxFontSizeMultiplier={1.6}>
                        {title}
                      </Text>
                    </View>
                    {subtitle ? (
                      <Text size={13} lineHeight={18} color={colors.textMuted} maxFontSizeMultiplier={1.6}>
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                  {dismissible ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={6} onPress={onClose} style={styles.closeButton}>
                      <Cancel20Icon size={18} color={colors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
            {scrollable ? (
              <ScrollView {...keepFocusedInputVisible.scrollProps} style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {children}
              </ScrollView>
            ) : (
              children
            )}
            {hasFooter ? (
              <View style={[styles.footer, floating ? null : { paddingBottom: 12 }]}>
                {footer}
                {footerActions ? <ModalActionStack actions={footerActions} /> : null}
              </View>
            ) : null}
          </Animated.View>
          <KeyboardSpacer
            restingHeight={floating ? Math.max(insets.bottom, 12) + FLOATING_GAP : undefined}
            openedGap={floating ? FLOATING_GAP : 0}
            style={floating ? null : styles.keyboardArea}
          />
        </Animated.View>
      </View>
    </FrameAwareModal>
  );
}

const useStyles = makeThemedStyles((colors, scheme) => {
  const palette = buildModalPalette(colors, scheme);
  return StyleSheet.create({
    flex: { flex: 1, justifyContent: "flex-end" },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: palette.scrim },
    keyboardArea: { backgroundColor: palette.surface },
    sheet: {
      flexShrink: 1,
      backgroundColor: palette.surface,
      borderTopLeftRadius: modalRadius.sheet,
      borderTopRightRadius: modalRadius.sheet,
      overflow: "hidden",
      ...(scheme === "dark" ? { borderWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0, borderColor: palette.border } : null),
    },
    floating: { marginHorizontal: 11, borderRadius: modalRadius.sheet, ...buildModalElevation(scheme, palette) },
    dragArea: { flexShrink: 1 },
    handleZone: { alignItems: "center", paddingTop: 8, paddingBottom: 6 },
    handle: { width: 36, height: 5, borderRadius: 3, backgroundColor: palette.handle },
    titleRow: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    titleRowAfterHandle: { paddingTop: 4 },
    titleText: { flex: 1, gap: 2 },
    closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: palette.inset },
    scroll: { flexShrink: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 16 },
    footer: { paddingHorizontal: modalSpacing.edge - 4, paddingTop: 12, gap: modalSpacing.actionGap, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, backgroundColor: palette.surface },
  });
});
