import { ActivityIndicator, FlatList, StyleSheet, View, useWindowDimensions } from "react-native";

import { SoundClipThumbnail } from "@/components/sounds/soundClipThumbnail";
import { useSoundDetails } from "@/components/sounds/soundDetails.hook";
import { SoundHeaderCard } from "@/components/sounds/soundHeaderCard";
import { openUserProfileOrMyProfile } from "@/components/sounds/soundNavigation.util";
import { SoundOwnerControls } from "@/components/sounds/soundOwnerControls";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { useAuthStore } from "@/store/auth.store";

const GRID_COLUMNS = 3;
const GRID_GAP = 2;
const MAXIMUM_CONTENT_WIDTH = 393;

export function SoundScreen({ navigation, route }: MainScreenProps<"Sound">) {
  const { soundId } = route.params;
  const { width } = useWindowDimensions();
  const signedInUserId = useAuthStore((state) => state.user?.id ?? null);
  const { sound, clipsUsingSound, clips, toggleSavedSound, updateSoundAsOwner } = useSoundDetails(soundId);
  const tileWidth = Math.floor((Math.min(width, MAXIMUM_CONTENT_WIDTH) - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
  const soundData = sound.data;
  const isViewerTheOwner = !!soundData && !!signedInUserId && soundData.owner.id === signedInUserId;

  return (
    <Screen background={colors.white}>
      <Header title="Sound" />
      {sound.isPending ? (
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      ) : !soundData ? (
        <Text size={14} lineHeight={19.6} color={colors.textMuted} align="center" style={styles.loading}>
          This sound isn't available right now.
        </Text>
      ) : (
        <FlatList
          data={clips}
          keyExtractor={(clip) => clip.id}
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={styles.gridRow}
          ItemSeparatorComponent={() => <View style={styles.gridGap} />}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (clipsUsingSound.hasNextPage && !clipsUsingSound.isFetchingNextPage) clipsUsingSound.fetchNextPage().catch(() => undefined);
          }}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <SoundHeaderCard
                sound={soundData}
                onPressOwner={() => openUserProfileOrMyProfile(navigation, soundData.owner.id, signedInUserId)}
                onToggleSaved={() => toggleSavedSound.mutate(!!soundData.savedByViewer)}
                onUseSound={() => navigation.navigate("CreatePost", { mode: "post", soundId: soundData.id })}
              />
              {isViewerTheOwner ? (
                <SoundOwnerControls
                  sound={soundData}
                  isSaving={updateSoundAsOwner.isPending}
                  errorMessage={updateSoundAsOwner.error ? updateSoundAsOwner.error.message : null}
                  onUpdate={(input) => updateSoundAsOwner.mutate(input)}
                />
              ) : null}
              <Text size={14} weight={600} lineHeight={16.8} style={styles.gridTitle}>
                Clips using this sound
              </Text>
            </View>
          }
          ListEmptyComponent={
            clipsUsingSound.isPending ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text size={13} lineHeight={18.2} color={colors.textMuted} align="center">
                No clips use this sound yet.
              </Text>
            )
          }
          ListFooterComponent={clipsUsingSound.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={styles.footer} /> : null}
          renderItem={({ item }) => (
            <SoundClipThumbnail clip={item} width={tileWidth} onPress={() => navigation.navigate("Tabs", { screen: "Clips" })} />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 48 },
  headerBlock: { gap: 12, paddingBottom: 12 },
  gridTitle: { paddingHorizontal: 16, paddingTop: 8 },
  gridRow: { gap: GRID_GAP },
  gridGap: { height: GRID_GAP },
  footer: { marginVertical: 16 },
});
