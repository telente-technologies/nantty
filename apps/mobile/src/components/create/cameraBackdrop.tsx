import { CameraView, useCameraPermissions } from "expo-camera";
import { forwardRef } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

export const CameraBackdrop = forwardRef<CameraView, { active: boolean }>(function CameraBackdrop({ active }, ref) {
  const [permission, requestPermission] = useCameraPermissions();
  if (!active) return <View style={styles.fill} />;
  if (permission?.granted) return <CameraView ref={ref} style={StyleSheet.absoluteFill} facing="back" />;
  return (
    <View style={[styles.fill, styles.center]}>
      {permission && !permission.canAskAgain ? (
        <Text size={13} lineHeight={16.9} color={colors.textMuted} align="center">
          Camera access is off. Turn it on in Settings to take photos and go live.
        </Text>
      ) : (
        <Button title="Allow camera" variant="subtle" onPress={() => requestPermission()} style={styles.allow} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, backgroundColor: colors.white },
  center: { alignItems: "center", justifyContent: "center", paddingHorizontal: 40, paddingBottom: 160 },
  allow: { width: 160 },
});
