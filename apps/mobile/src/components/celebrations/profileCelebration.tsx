import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { useEffect } from "react";

import { Text } from "@/components/ui/text";
import { useSurfaceCelebration } from "@/hooks/useSurfaceCelebration.hook";
import { makeThemedStyles, useTheme } from "@/theme";
import type { User } from "@/types";

import { FloatingBalloons } from "./floatingBalloons";

const HEADER_HEIGHT = 260;

export interface ProfileCelebrationProps {
  readonly profile: User;
  readonly variant: "own" | "other";
}

function OwnProfileCelebration({ profile }: { profile: User }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { celebration } = useSurfaceCelebration("profile", true, { posts: profile.posts });
  useEffect(() => {
    if (celebration) AccessibilityInfo.announceForAccessibility(celebration.message);
  }, [celebration]);
  if (!celebration) return null;
  return (
    <>
      <View style={styles.banner} accessibilityRole="alert" accessibilityLabel={celebration.message}>
        <Text size={15} weight={700} lineHeight={20} align="center" color={colors.primary} accessible={false}>{celebration.title}</Text>
        <Text size={13} lineHeight={18} align="center" color={colors.textMuted} accessible={false}>{celebration.message.slice(celebration.title.length).trim()}</Text>
      </View>
      <FloatingBalloons height={HEADER_HEIGHT} style={styles.layer} />
    </>
  );
}

function VisitorCelebration({ profile }: { profile: User }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <>
      {profile.anniversaryToday ? (
        <View style={styles.badge} accessible accessibilityLabel={`${profile.name} is celebrating a Nanttyversary today`}>
          <Text size={12} weight={600} lineHeight={16} color={colors.primary} accessible={false}>Nanttyversary</Text>
        </View>
      ) : null}
      {profile.birthdayToday ? <FloatingBalloons height={HEADER_HEIGHT} style={styles.layer} /> : null}
    </>
  );
}

export function ProfileCelebration({ profile, variant }: ProfileCelebrationProps) {
  if (variant === "own") return <OwnProfileCelebration profile={profile} />;
  if (!profile.birthdayToday && !profile.anniversaryToday) return null;
  return <VisitorCelebration profile={profile} />;
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  layer: { top: 0 },
  banner: { marginHorizontal: 16, padding: 12, gap: 4, borderRadius: 12, backgroundColor: colors.primaryTint },
  badge: { alignSelf: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.primaryTint },
}));
