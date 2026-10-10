import { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View, useWindowDimensions } from "react-native";

import { Warning20Icon } from "@/components/icons";
import { ReportSheet, type ReportTarget } from "@/components/moderation/reportSheet";

import { SoundClipThumbnail } from "@/components/sounds/soundClipThumbnail";
import { useSoundDetails } from "@/components/sounds/soundDetails.hook";
import { SoundHeaderCard } from "@/components/sounds/soundHeaderCard";
import { openUserProfileOrMyProfile } from "@/components/sounds/soundNavigation.util";
import { SoundOwnerControls } from "@/components/sounds/soundOwnerControls";
import { Header, HeaderAction } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { useAuthStore } from "@/store/auth.store";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { requireAuthThen } from "@/utils/requireAuth.util";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

const GRID_COLUMNS = 3;
const GRID_GAP = 2;
const MAXIMUM_CONTENT_WIDTH = 393;

export function SoundScreen({ navigation, route }: MainScreenProps<"Sound">) {
  const { colors } = useTheme();
  const { soundId } = route.params;
  const { width } = useWindowDimensions();
  const signedInUserId = useAuthStore((state) => state.user?.id ?? null);
  const { sound, clipsUsingSound, clips, toggleSavedSound, updateSoundAsOwner } = useSoundDetails(soundId);
  const tileWidth = Math.floor((Math.min(width, MAXIMUM_CONTENT_WIDTH) - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
  const soundData = sound.data;
  const refreshControl = usePullToRefresh(sound.refetch, clipsUsingSound.refetch);
  const isViewerTheOwner = !!soundData && !!signedInUserId && soundData.owner.id === signedInUserId;
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const openCopyrightReport = () =>
    requireAuthThen(() => setReportTarget({ targetType: "sound", targetId: soundId, initialReason: "intellectual_property" }), undefined, "report");

  return (
    <Screen background={colors.surface}>
      <Header
        title="Sound"
        right={soundData && !isViewerTheOwner ? (
          <HeaderAction label="Report this sound" onPress={openCopyrightReport}>
            <Warning20Icon />
          </HeaderAction>
        ) : undefined}
      />
      {sound.isPending ? (
        <ListSkeleton />
      ) : !soundData ? (
        <ErrorState message="This sound isn't available right now." onRetry={() => sound.refetch()} retrying={sound.isRefetching} />
      ) : (
        <FlatList
          data={clips}
          keyExtractor={(clip) => clip.id}
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={styles.gridRow}
          ItemSeparatorComponent={() => <View style={styles.gridGap} />}
          onEndReachedThreshold={0.6}
          refreshControl={refreshControl}
          onEndReached={() => {
            if (clipsUsingSound.hasNextPage && !clipsUsingSound.isFetchingNextPage) clipsUsingSound.fetchNextPage().catch(() => undefined);
          }}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <SoundHeaderCard
                sound={soundData}
                onPressOwner={() => openUserProfileOrMyProfile(navigation, soundData.owner.id, signedInUserId)}
                onToggleSaved={() => requireAuthThen(() => toggleSavedSound.mutate(!!soundData.savedByViewer), undefined, "save sounds")}
                onUseSound={() => requireAuthThen(() => navigation.navigate("CreatePost", { mode: "clip", soundId: soundData.id }), undefined, "create clips")}
              />
              {isViewerTheOwner ? (
                <SoundOwnerControls
                  sound={soundData}
                  isSaving={updateSoundAsOwner.isPending}
                  errorMessage={updateSoundAsOwner.error ? updateSoundAsOwner.error.message : null}
                  onUpdate={(input) => updateSoundAsOwner.mutate(input)}
                />
              ) : null}
              <Text size={typeScale.md} weight={600} lineHeight={16.8} style={styles.gridTitle}>
                Clips using this sound
              </Text>
            </View>
          }
          ListEmptyComponent={
            clipsUsingSound.isPending ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <EmptyState compact title="No clips use this sound yet" body="Be the first. Tap Use sound to make a clip with it." />
            )
          }
          ListFooterComponent={clipsUsingSound.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={styles.footer} /> : null}
          renderItem={({ item }) => (
            <SoundClipThumbnail clip={item} width={tileWidth} onPress={() => navigation.navigate("Tabs", { screen: "Clips", params: { startId: item.id } })} />
          )}
        />
      )}
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBlock: { gap: spacing[3], paddingBottom: spacing[3] },
  gridTitle: { paddingHorizontal: spacing[4], paddingTop: spacing[2] },
  gridRow: { gap: GRID_GAP },
  gridGap: { height: GRID_GAP },
  footer: { marginVertical: spacing[4] },
});
