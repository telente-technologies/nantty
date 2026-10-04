import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArrowLeft24Icon, DotsThreeVertical24Icon } from "@/components/icons";
import { LiveTopSupportersList } from "@/components/live/gifts/liveTopSupportersList";
import { LiveTopSupporterCard } from "@/components/live/gifts/liveTopSupporterCard";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { liveService } from "@/services/live.service";
import { webAppLinks } from "@/config/webAppLinks.config";
import { makeThemedStyles, useTheme } from "@/theme";

export function LiveEndedScreen({ navigation, route }: MainScreenProps<"LiveEnded">) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useQuery({ queryKey: ["live", route.params.liveId], queryFn: () => liveService.fetchLiveSessionById(route.params.liveId) });
  const suggested = useQuery({ queryKey: ["suggested-lives"], queryFn: liveService.fetchSuggestedLives });

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={() => navigation.goBack()}>
          <ArrowLeft24Icon />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Share this live" hitSlop={10} onPress={() => Share.share({ message: webAppLinks.live(route.params.liveId) }).catch(() => undefined)}>
          <DotsThreeVertical24Icon />
        </Pressable>
      </View>
      <View style={styles.host}>
        <Avatar uri={session.data?.host.avatarUrl} size={72} />
        <View style={styles.hostText}>
          <Text size={16} weight={600} lineHeight={19.2} align="center">
            {session.data?.host.name ?? ""}
          </Text>
          <Text size={14} lineHeight={16.8} align="center" color={colors.textMuted}>
            Live ended
          </Text>
        </View>
        <LiveTopSupporterCard liveId={route.params.liveId} />
        <LiveTopSupportersList liveId={route.params.liveId} />
      </View>
      {suggested.data && suggested.data.length > 0 ? (
        <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
          <View style={styles.handle} />
          <Text size={16} weight={600} lineHeight={19.2} style={styles.sheetTitle} accessibilityRole="header">
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
  header: { height: 24, paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  host: { marginTop: 72, alignItems: "center", gap: 12 },
  hostText: { gap: 4, alignItems: "center" },
  sheet: {
    flex: 1,
    marginTop: 22,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  handle: { alignSelf: "center", marginTop: 12, width: 46, height: 4, borderRadius: 99, backgroundColor: colors.divider },
  sheetTitle: { marginTop: 24, marginHorizontal: 16 },
  grid: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: 177, height: 254, borderRadius: 12, backgroundColor: colors.placeholder, overflow: "hidden", flexGrow: 1, flexBasis: "45%" },
}));
