import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaFrame, useSafeAreaInsets } from "react-native-safe-area-context";

import { Cancel20Icon } from "@/components/icons";
import { makeThemedStyles } from "@/theme";

import { KeyboardSpacer } from "./keyboardSpacer";
import { Text } from "./text";
import { FrameAwareModal } from "./frameAwareModal";

const SHEET_TOP_GAP = 12;
const FLOATING_GAP = 14;

export interface BottomSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly title?: string;
  readonly titleSize?: number;
  readonly floating?: boolean;
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

export function BottomSheet({ visible, onClose, title, titleSize = 16, floating = false, children, style }: BottomSheetProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const tallestSheetHeight = frame.height - insets.top - SHEET_TOP_GAP;
  return (
    <FrameAwareModal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.flex, { paddingTop: insets.top + SHEET_TOP_GAP }]}>
        <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { maxHeight: tallestSheetHeight },
            floating ? styles.floating : null,
            style,
          ]}
          accessibilityViewIsModal
        >
          {title ? (
            <View style={styles.titleRow}>
              <Text size={titleSize} weight={600} lineHeight={titleSize * 1.2} accessibilityRole="header">
                {title}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={onClose}>
                <Cancel20Icon />
              </Pressable>
            </View>
          ) : null}
          {children}
        </View>
        <KeyboardSpacer
          restingHeight={floating ? Math.max(insets.bottom, 12) + FLOATING_GAP : undefined}
          openedGap={floating ? FLOATING_GAP : 0}
          style={floating ? null : styles.keyboardArea}
        />
      </View>
    </FrameAwareModal>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  keyboardArea: { backgroundColor: colors.elevated },
  sheet: { flexShrink: 1, backgroundColor: colors.elevated, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: "hidden" },
  floating: { marginHorizontal: 11, borderRadius: 16 },
  titleRow: { paddingHorizontal: 13, paddingTop: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
}));
