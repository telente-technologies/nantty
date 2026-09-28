import type { ReactNode } from "react";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaFrameContext, SafeAreaInsetsContext } from "react-native-safe-area-context";

const INSETS = { top: 54, bottom: 34, left: 0, right: 0 };
const FRAME = { x: 0, y: 0, width: 393, height: 852 };

export function DeviceFrame({ children }: { children: ReactNode }) {
  const { height } = useWindowDimensions();
  if (Platform.OS !== "web" || !__DEV__) return <>{children}</>;
  const scale = Math.min(1, height / FRAME.height);
  return (
    <View style={styles.page}>
      <View style={[styles.device, { transform: [{ scale }] }]}>
        <SafeAreaFrameContext.Provider value={FRAME}>
          <SafeAreaInsetsContext.Provider value={INSETS}>{children}</SafeAreaInsetsContext.Provider>
        </SafeAreaFrameContext.Provider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#888888", alignItems: "center", justifyContent: "center" },
  device: { width: 393, height: 852, overflow: "hidden", backgroundColor: "#FFFFFF" },
});
