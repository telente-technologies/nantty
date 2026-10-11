import { useEffect, type ReactNode } from "react";
import { Modal, Platform, StyleSheet, View, type ModalProps } from "react-native";

import { useTheme } from "@/theme";

import { dismissKeyboardOnEmptyTap } from "./dismissKeyboardOnEmptyTap.util";
import { useDeviceFrameOverlayRootElement } from "./deviceFrameOverlayRoot";
import { renderIntoDeviceFrameOverlay } from "./renderIntoDeviceFrameOverlay";

export interface FrameAwareModalProps extends Pick<ModalProps, "animationType" | "transparent" | "statusBarTranslucent" | "supportedOrientations"> {
  readonly visible: boolean;
  readonly onRequestClose: () => void;
  readonly children: ReactNode;
}

function CloseOnEscapeKey({ onRequestClose }: { onRequestClose: () => void }) {
  useEffect(() => {
    const closeWhenEscapeIsPressed = (event: KeyboardEvent) => {
      if (event.key === "Escape") onRequestClose();
    };
    window.addEventListener("keydown", closeWhenEscapeIsPressed);
    return () => window.removeEventListener("keydown", closeWhenEscapeIsPressed);
  }, [onRequestClose]);
  return null;
}

export function FrameAwareModal({ visible, onRequestClose, children, transparent, ...modalProps }: FrameAwareModalProps) {
  const overlayRootElement = useDeviceFrameOverlayRootElement();
  const { colors } = useTheme();
  if (Platform.OS !== "web" || !overlayRootElement) {
    return (
      <Modal visible={visible} transparent={transparent} onRequestClose={onRequestClose} {...modalProps}>
        <View style={styles.fill} onStartShouldSetResponder={dismissKeyboardOnEmptyTap}>
          {children}
        </View>
      </Modal>
    );
  }
  if (!visible) return null;
  return renderIntoDeviceFrameOverlay(
    <View style={[styles.overlay, transparent ? null : { backgroundColor: colors.surface }]} accessibilityViewIsModal>
      <CloseOnEscapeKey onRequestClose={onRequestClose} />
      {children}
    </View>,
    overlayRootElement,
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill },
  fill: { flex: 1 },
});
