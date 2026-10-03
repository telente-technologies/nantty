import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { CalendarDots16Icon } from "@/components/icons";
import { LiveAvatarRing } from "@/components/live/liveAvatarRing";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainStackParamList } from "@/navigation/navigation.types";
import type { User } from "@/types";
import { formatCountWithThousandsSuffix, formatJoinedDate } from "@/utils/formatDate.util";

import { VerificationBadge } from "./verificationBadge";

export interface ProfileAction {
  readonly label: string;
  readonly onPress: () => void;
  readonly highlighted?: boolean;
}

export interface ProfileSummaryProps {
  readonly profile: User;
  readonly variant: "own" | "other";
  readonly actions: readonly ProfileAction[];
  readonly identityAction?: ProfileAction;
  readonly onPressFollowers: () => void;
  readonly onPressFollowing: () => void;
}

function ProfileAvatar({ profile, borderRadius }: { readonly profile: User; readonly borderRadius: number }) {
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();
  const avatarImage = profile.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null;
  if (!profile.live) return <View style={[styles.avatar, { borderRadius }]}>{avatarImage}</View>;
  const liveId = profile.live.liveId;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${profile.name} is live, open livestream`}
      onPress={() => navigation.navigate("Live", { liveId })}
    >
      <LiveAvatarRing size={64} borderRadius={borderRadius}>
        <View style={[styles.avatar, { borderRadius }]}>{avatarImage}</View>
      </LiveAvatarRing>
    </Pressable>
  );
}

const formatJoinedMonthAndYear = (isoDate: string) => formatJoinedDate(isoDate).replace(/ (\d{4})$/, ", $1");

export function ProfileSummary({ profile, variant, actions, identityAction, onPressFollowers, onPressFollowing }: ProfileSummaryProps) {
  const isOwn = variant === "own";
  return (
    <View style={styles.root}>
      <View style={[styles.banner, { backgroundColor: isOwn ? "#C4C4C4" : colors.placeholder }]}>
        {profile.bannerUrl ? <Image source={{ uri: profile.bannerUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      </View>

      <View style={styles.identity}>
        <ProfileAvatar profile={profile} borderRadius={isOwn ? 32 : 8} />
        <View style={styles.names}>
          <View style={styles.nameRow}>
            <Text size={16} weight={500} lineHeight={19.2} accessibilityRole="header" numberOfLines={1}>
              {profile.name}
            </Text>
            <VerificationBadge verification={profile.verification} legacyVerified={profile.verified} size={20} />
          </View>
          <Text size={14} weight={400} lineHeight={16.8} color={colors.textSubtle} numberOfLines={1}>
            @{profile.username}
          </Text>
          <View style={styles.stats}>
            <Stat count={profile.followers} label="followers" onPress={onPressFollowers} />
            <Stat count={profile.following} label="following" onPress={onPressFollowing} />
          </View>
        </View>
        {identityAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={identityAction.label}
            onPress={identityAction.onPress}
            style={({ pressed }) => [
              styles.identityAction,
              identityAction.highlighted && styles.highlightedAction,
              pressed && styles.pressed,
            ]}
          >
            <Text size={14} weight={500} lineHeight={16.8} color={identityAction.highlighted ? colors.white : colors.primary}>
              {identityAction.label}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {profile.bio ? (
        <Text size={13} lineHeight={16.9} style={styles.bio}>
          {profile.bio}
        </Text>
      ) : null}

      <View style={styles.joined}>
        <CalendarDots16Icon />
        <Text size={13} lineHeight={16.9}>
          {formatJoinedMonthAndYear(profile.joinedAt)}
        </Text>
      </View>

      <View style={styles.actions}>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.action,
              { borderRadius: isOwn ? 8 : 4 },
              action.highlighted && styles.highlightedAction,
              pressed && styles.pressed,
            ]}
          >
            <Text size={14} lineHeight={16.8} color={action.highlighted ? colors.white : colors.text}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Stat({ count, label, onPress }: { count: number; label: string; onPress: () => void }) {
  return (
    <Text size={14} weight={500} lineHeight={16.8} onPress={onPress} accessibilityRole="link">
      {formatCountWithThousandsSuffix(count)}{" "}
      <Text size={14} weight={400} lineHeight={16.8}>
        {label}
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 12 },
  banner: { height: 100, borderRadius: 8, marginTop: 4, overflow: "hidden" },
  identity: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  identityAction: {
    height: 34,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  avatar: { width: 64, height: 64, backgroundColor: colors.placeholder, overflow: "hidden" },
  names: { flex: 1, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  stats: { flexDirection: "row", alignItems: "center", gap: 8 },
  bio: { marginTop: 14 },
  joined: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  actions: { marginTop: 19, flexDirection: "row", gap: 8 },
  action: {
    flex: 1,
    height: 37,
    borderWidth: 1,
    borderColor: colors.textSubtle,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  highlightedAction: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.7 },
});
