import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Eye24Icon, VideoCamera24Icon } from "@/components/icons";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { ModalActionStack } from "@/components/ui/modalActions";
import { buildModalElevation, buildModalPalette, modalRadius, modalMotion } from "@/components/ui/modalChrome.constant";
import { Text } from "@/components/ui/text";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { makeThemedStyles, useTheme } from "@/theme";
import type { LiveSessionDetails } from "@/types";

import { LiveAvatarRing } from "./liveAvatarRing";
import { LiveBadge } from "./liveBadge";
import { LIVE_CATEGORY_LABELS } from "./liveHeader";

export interface JoinLiveCardProps {
  readonly session: LiveSessionDetails;
  readonly showHost: boolean;
  readonly onWatch: () => void;
  readonly onDismiss?: () => void;
}

const formatViewerCount = (viewers: number) => Intl.NumberFormat("en", { notation: "compact" }).format(viewers);

export function JoinLiveCard({ session, showHost, onWatch, onDismiss }: JoinLiveCardProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotionPreference();
  const coverUrl = session.coverUrl ?? null;
  const othersWatching = `${formatViewerCount(session.viewers)} ${session.viewers === 1 ? "person" : "people"} watching`;
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(modalMotion.enterMs + 60)} style={styles.card} accessibilityRole="summary">
      <View style={styles.preview}>
        {coverUrl ? <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessibilityIgnoresInvertColors /> : null}
        <View style={styles.previewShade} />
        <View style={styles.previewBadge}>
          <LiveBadge viewers={session.viewers} />
        </View>
      </View>
      <View style={styles.body}>
        {showHost ? (
          <View style={styles.hostRow}>
            <LiveAvatarRing size={44}>
              <Avatar uri={session.host.avatarUrl} size={44} />
            </LiveAvatarRing>
            <View style={styles.hostText}>
              <View style={styles.nameRow}>
                <Text size={15} weight={600} lineHeight={20} numberOfLines={1} style={styles.shrink}>
                  {session.host.name}
                </Text>
                <VerificationBadge verification={session.host.verification} legacyVerified={session.host.verified} size={14} />
              </View>
              <View style={styles.viewerRow}>
                <Eye24Icon size={20} color={colors.textMuted} />
                <Text size={13} lineHeight={18} color={colors.textMuted} numberOfLines={1}>
                  @{session.host.username} · {othersWatching}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <Text size={20} weight={600} lineHeight={26} letterSpacing={-0.3} accessibilityRole="header">
            Join {formatViewerCount(session.viewers)} {session.viewers === 1 ? "other" : "others"} watching this live right now
          </Text>
        )}
        {session.title ? (
          <Text size={15} lineHeight={21} numberOfLines={2} accessibilityRole={showHost ? "header" : undefined}>
            {session.title}
          </Text>
        ) : null}
        {session.category ? (
          <View style={styles.chip}>
            <VideoCamera24Icon size={20} color={colors.textMuted} />
            <Text size={12} weight={600} lineHeight={16} color={colors.textMuted}>
              {LIVE_CATEGORY_LABELS[session.category]}
            </Text>
          </View>
        ) : null}
        <ModalActionStack
          style={styles.actions}
          actions={[
            { label: "Join live", style: "primary", onPress: onWatch },
            ...(onDismiss ? [{ label: "Not now", style: "plain" as const, onPress: onDismiss }] : []),
          ]}
        />
      </View>
    </Animated.View>
  );
}

const useStyles = makeThemedStyles((colors, scheme) => {
  const palette = buildModalPalette(colors, scheme);
  return StyleSheet.create({
    card: { marginHorizontal: 12, borderRadius: modalRadius.sheet, backgroundColor: palette.surface, overflow: "hidden", ...buildModalElevation(scheme, palette) },
    preview: { height: 140, backgroundColor: scheme === "dark" ? "#1A1A1D" : "#E4E6F2" },
    previewShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0, 0, 0, 0.18)" },
    previewBadge: { position: "absolute", top: 12, left: 12 },
    body: { padding: 16, gap: 10 },
    hostRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    hostText: { flex: 1, gap: 2 },
    viewerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    shrink: { flexShrink: 1 },
    chip: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: palette.inset },
    actions: { marginTop: 6 },
  });
});
