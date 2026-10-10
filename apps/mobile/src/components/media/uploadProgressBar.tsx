import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { retryFailedUpload } from "@/services/media/mediaUploadQueue.service";
import { useUploadJobProgress } from "@/store/uploadQueue.store";
import type { ID } from "@/types";

const describeUploadJobStatus = (status: string, percent: number) => {
  if (status === "preparing") return "Preparing…";
  if (status === "waitingForNetwork") return "Waiting for connection…";
  if (status === "processing") return "Processing…";
  if (status === "ready") return "Uploaded";
  if (status === "failed") return "Upload failed. Tap to retry";
  return `Uploading ${percent}%`;
};

export function UploadProgressBar({ jobId, showLabel = true }: { jobId: ID | null; showLabel?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { job, uploadedFraction } = useUploadJobProgress(jobId);
  if (!job) return null;
  const percent = Math.round(uploadedFraction * 100);
  const hasFailed = job.status === "failed";
  return (
    <Pressable
      accessibilityRole={hasFailed ? "button" : "progressbar"}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      disabled={!hasFailed}
      onPress={() => retryFailedUpload(job.jobId)}
      style={styles.root}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: hasFailed ? colors.error : colors.primary }]} />
      </View>
      {showLabel ? (
        <Text size={12} lineHeight={16.8} color={hasFailed ? colors.error : colors.textMuted}>
          {describeUploadJobStatus(job.status, percent)}
        </Text>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { gap: 4 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.skeleton, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2 },
}));
