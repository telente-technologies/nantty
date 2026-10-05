import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Flips34Icon } from "@/components/icons";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { ForcedColorSchemeScope, useTheme } from "@/theme";
import type { ClipsFeedTab } from "@/types";

export interface ClipsFeedStateProps {
  readonly tab: ClipsFeedTab;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly isRefetching: boolean;
  readonly onRetry: () => void;
  readonly onExploreForYou: () => void;
}

function ClipsFeedStateBody({ tab, isPending, isError, isRefetching, onRetry, onExploreForYou }: ClipsFeedStateProps) {
  const { colors } = useTheme();
  if (isPending) return <ActivityIndicator color={colors.white} accessibilityLabel="Loading clips" />;
  if (isError) return <ErrorState message="Couldn't load clips." onRetry={onRetry} retrying={isRefetching} />;
  const isForYou = tab === "forYou";
  return (
    <EmptyState
      icon={<Flips34Icon size={28} color={colors.textMuted} />}
      title={isForYou ? "No clips yet" : "Nothing new from people you follow"}
      body={isForYou ? "Check back soon for fresh clips." : "Follow more creators to fill this feed."}
      actionLabel={isForYou ? "Refresh" : "Watch For You"}
      onAction={isForYou ? onRetry : onExploreForYou}
    />
  );
}

export function ClipsFeedState(props: ClipsFeedStateProps) {
  return (
    <ForcedColorSchemeScope scheme="dark">
      <View style={styles.root} pointerEvents="box-none">
        <ClipsFeedStateBody {...props} />
      </View>
    </ForcedColorSchemeScope>
  );
}

const styles = StyleSheet.create({ root: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" } });
