import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArrowLeft24Icon, Share24Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/errorState";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { liveService } from "@/services/live/live.service";
import { webAppLinks } from "@/config/webAppLinks.config";
import { makeThemedStyles, useTheme } from "@/theme";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

export function LiveEndedScreen({ navigation, route }: MainScreenProps<"LiveEnded">) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useQuery({ queryKey: ["live", route.params.liveId], queryFn: () => liveService.fetchLiveSessionById(route.params.liveId) });
  const hostId = session.data?.host.id;
  const suggested = useQuery({ queryKey: ["suggested-lives"], queryFn: liveService.fetchSuggestedLives });

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" style={styles.iconButton} onPress={() => navigation.goBack()}>
          <ArrowLeft24Icon />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Share this live" style={styles.iconButton} onPress={() => Share.share({ message: webAppLinks.live(route.params.liveId) }).catch(() => undefined)}>
          <Share24Icon />
        </Pressable>
      </View>
      {session.isError && !session.data ? (
        <ErrorState error={session.error} compact message="Couldn't load this live." onRetry={() => session.refetch()} retrying={session.isRefetching} />
      ) : null}
      <View style={styles.host}>
        <Avatar uri={session.data?.host.avatarUrl} size={72} />
        <View style={styles.hostText}>
          {session.data ? (
            <Text size={typeScale.base} weight={600} lineHeight={19.2} align="center">
              {session.data.host.name}
            </Text>
          ) : session.isPending ? (
            <Skeleton width={140} height={18} />
          ) : null}
          <Text size={typeScale.md} lineHeight={16.8} align="center" color={colors.textMuted}>
            Live ended
          </Text>
        </View>
        {hostId ? (
          <Button title="View profile" variant="outline" height={36} style={styles.profileButton} onPress={() => navigation.replace("UserProfile", { userId: hostId })} />
        ) : null}
      </View>
      {suggested.data && suggested.data.length > 0 ? (
        <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
          <View style={styles.handle} />
          <Text size={typeScale.base} weight={600} lineHeight={19.2} style={styles.sheetTitle} accessibilityRole="header">
            Suggested lives
          </Text>
          <ScrollView contentContainerStyle={styles.grid}>
            {suggested.data.map((live) => (
              <Pressable
                key={live.id}
                accessibilityRole="button"
                accessibilityLabel={`Watch ${live.host.name}'s live`}
                onPress={() => navigation.replace("Live", { liveId: live.id })}
                style={styles.tile}
              >
                {live.coverUrl ? <Image source={{ uri: live.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  profileButton: { paddingHorizontal: spacing[5] },
  header: { height: 44, paddingHorizontal: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  host: { marginTop: spacing[9], alignItems: "center", gap: spacing[3] },
  hostText: { gap: spacing[1], alignItems: "center" },
  sheet: {
    flex: 1,
    marginTop: spacing[6],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  handle: { alignSelf: "center", marginTop: spacing[3], width: 46, height: 4, borderRadius: 99, backgroundColor: colors.divider },
  sheetTitle: { marginTop: spacing[6], marginHorizontal: spacing[4] },
  grid: { paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[6], flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  tile: { width: 177, height: 254, borderRadius: 12, backgroundColor: colors.placeholder, overflow: "hidden", flexGrow: 1, flexBasis: "45%" },
}));
