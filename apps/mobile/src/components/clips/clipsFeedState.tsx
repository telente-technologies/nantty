import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Flips34Icon } from "@/components/icons";
import { BrandLoader } from "@/components/ui/brandLoader";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { ForcedColorSchemeScope, useTheme } from "@/theme";
import type { ClipsFeedTab } from "@/types";

import { CLIPS_HEADER_HEIGHT } from "./clipPageLayout.util";
import { FollowingClipsSuggestions } from "./followingClipsSuggestions";

export interface ClipsFeedStateProps {
  readonly tab: ClipsFeedTab;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly isRefetching: boolean;
  readonly onRetry: () => void;
  readonly onExploreForYou: () => void;
  readonly onFollowedCreator?: () => void;
}

function ClipsFeedStateBody({ tab, isPending, isError, isRefetching, onRetry, onExploreForYou }: ClipsFeedStateProps) {
  const { colors } = useTheme();
  if (isPending) return <BrandLoader size="lg" accessibilityLabel="Loading clips" />;
  if (isError) return <ErrorState message="Couldn't load clips." onRetry={onRetry} retrying={isRefetching} />;
  const isForYou = tab === "forYou";
  return (
    <EmptyState
      icon={<Flips34Icon size={28} color={colors.textMuted} />}
      title={isForYou ? "No clips yet" : "Follow people to see their clips here"}
      body={isForYou ? "Check back soon for fresh clips." : "When people you follow post clips, they'll show up here."}
      actionLabel={isForYou ? "Refresh" : "Watch For You"}
      onAction={isForYou ? onRetry : onExploreForYou}
    />
  );
}

export function ClipsFeedState(props: ClipsFeedStateProps) {
  const insets = useSafeAreaInsets();
  const showsFollowingSuggestions = props.tab === "following" && !props.isPending && !props.isError && props.onFollowedCreator !== undefined;
  return (
    <ForcedColorSchemeScope scheme="dark">
      {showsFollowingSuggestions ? (
        <ScrollView style={styles.root} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + CLIPS_HEADER_HEIGHT }]}>
          <ClipsFeedStateBody {...props} />
          <FollowingClipsSuggestions onFollowedCreator={props.onFollowedCreator!} />
        </ScrollView>
      ) : (
        <View style={[styles.root, styles.centered]} pointerEvents="box-none">
          <ClipsFeedStateBody {...props} />
        </View>
      )}
    </ForcedColorSchemeScope>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  centered: { alignItems: "center", justifyContent: "center" },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingBottom: 32 },
});
