import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Cancel20Icon } from "@/components/icons";
import { colors } from "@/constants/colors.constant";

import { Text } from "./text";

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
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            floating ? [styles.floating, { marginBottom: Math.max(insets.bottom, 12) + 14 }] : { paddingBottom: insets.bottom },
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
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: "hidden" },
  floating: { marginHorizontal: 11, borderRadius: 16 },
  titleRow: { paddingHorizontal: 13, paddingTop: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
