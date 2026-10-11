import { CameraView, useCameraPermissions } from "expo-camera";
import { forwardRef } from "react";
import { Linking, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

export const CameraBackdrop = forwardRef<CameraView, { active: boolean }>(function CameraBackdrop({ active }, ref) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [permission, requestPermission] = useCameraPermissions();
  if (!active) return <View style={styles.fill} />;
  if (permission?.granted) return <CameraView ref={ref} style={StyleSheet.absoluteFill} facing="back" />;
  return (
    <View style={[styles.fill, styles.center]}>
      {permission && !permission.canAskAgain ? (
        <>
          <Text size={13} lineHeight={16.9} color={colors.textMuted} align="center">
            Camera access is off. Turn it on in Settings to take photos and go live.
          </Text>
          <Button title="Open Settings" variant="subtle" onPress={() => void Linking.openSettings().catch(() => undefined)} style={styles.allow} />
        </>
      ) : (
        <Button title="Allow camera" variant="subtle" onPress={() => requestPermission()} style={styles.allow} />
      )}
    </View>
  );
});

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40, paddingBottom: 160 },
  allow: { width: 160 },
}));
