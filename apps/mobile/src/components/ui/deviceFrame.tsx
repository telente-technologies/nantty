import { useState, type ReactNode } from "react";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaFrameContext, SafeAreaInsetsContext } from "react-native-safe-area-context";

import { DeviceFrameOverlayRootContext } from "./deviceFrameOverlayRoot";

const INSETS = { top: 54, bottom: 34, left: 0, right: 0 };
const FRAME = { x: 0, y: 0, width: 393, height: 852 };

export function DeviceFrame({ children }: { children: ReactNode }) {
  const { height } = useWindowDimensions();
  const [overlayRootElement, setOverlayRootElement] = useState<HTMLElement | null>(null);
  if (Platform.OS !== "web" || !__DEV__) return <>{children}</>;
  const scale = Math.min(1, height / FRAME.height);
  return (
    <View style={styles.page}>
      <View style={[styles.device, { transform: [{ scale }] }]}>
        <SafeAreaFrameContext.Provider value={FRAME}>
          <SafeAreaInsetsContext.Provider value={INSETS}>
            <DeviceFrameOverlayRootContext.Provider value={overlayRootElement}>{children}</DeviceFrameOverlayRootContext.Provider>
          </SafeAreaInsetsContext.Provider>
        </SafeAreaFrameContext.Provider>
        <View
          ref={(element) => setOverlayRootElement(element as unknown as HTMLElement | null)}
          style={styles.overlayRoot}
          pointerEvents="box-none"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#888888", alignItems: "center", justifyContent: "center" },
  device: { width: 393, height: 852, overflow: "hidden", backgroundColor: "#FFFFFF" },
  overlayRoot: { ...StyleSheet.absoluteFill, zIndex: 1000 },
});
