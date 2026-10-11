import { Linking, StyleSheet, View } from "react-native";

import { useDataExportQuery, useRequestDataExportMutation } from "@/components/settings/privacyQueries.hook";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { DataExportStatus } from "@/types";

const STATUS_COPY: Record<DataExportStatus, string> = {
  none: "Get a copy of the personal information we hold about you.",
  requested: "Request received. We're getting your data ready.",
  processing: "Preparing your data. This can take a few minutes.",
  ready: "Your data is ready to download.",
};

export function DataExportSection() {
  const { colors } = useTheme();
  const exportRequest = useDataExportQuery();
  const requestExport = useRequestDataExportMutation();

  if (exportRequest.isLoading) return <ListSkeleton />;
  if (exportRequest.isError || !exportRequest.data) return <ErrorState error={exportRequest.error} message="Couldn't load your data export." onRetry={() => exportRequest.refetch()} />;

  const { status, downloadUrl, expiresAt } = exportRequest.data;
  const isInProgress = status === "requested" || status === "processing";
  return (
    <View style={styles.block}>
      <Text size={14} weight={600} lineHeight={16.8} accessibilityRole="header">Download my data</Text>
      <Text size={12} lineHeight={16.8} color={colors.textMuted} accessibilityLiveRegion="polite">{STATUS_COPY[status]}</Text>
      {status === "ready" && expiresAt ? (
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>Link expires {new Date(expiresAt).toLocaleDateString()}.</Text>
      ) : null}
      {requestExport.isError ? <Text size={12} lineHeight={14.4} color={colors.error}>{requestExport.error.message}</Text> : null}
      {status === "ready" && downloadUrl ? <Button title="Download" onPress={() => Linking.openURL(downloadUrl)} /> : null}
      <Button
        variant="subtle"
        title={status === "none" ? "Request my data" : "Request a new export"}
        disabled={isInProgress}
        loading={requestExport.isPending}
        onPress={() => requestExport.mutate()}
      />
    </View>
  );
}

const styles = StyleSheet.create({ block: { gap: 12 } });
