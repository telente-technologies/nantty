import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { useTheme } from "@/theme";
import { useUploadJobProgress } from "@/store/uploadQueue.store";
import type { ID } from "@/types";

const RING_SIZE = 36;
const RING_STROKE = 3;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function UploadProgressRing({ jobId }: { jobId: ID }) {
  const { colors } = useTheme();
  const { job, uploadedFraction } = useUploadJobProgress(jobId);
  if (!job || job.status === "ready" || job.status === "processing") return null;
  const fraction = job.status === "failed" ? 1 : uploadedFraction;
  const ringColor = job.status === "failed" ? colors.error : colors.white;
  return (
    <View style={styles.center} pointerEvents="none" accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}>
      <Svg width={RING_SIZE} height={RING_SIZE} style={styles.rotated}>
        <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} stroke={colors.overlay} strokeWidth={RING_STROKE} fill="none" />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={ringColor}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  rotated: { transform: [{ rotate: "-90deg" }] },
});
