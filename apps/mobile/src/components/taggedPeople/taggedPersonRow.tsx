import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { FollowPill } from "@/components/clips/followPill";
import { isActiveFollowState, useFollowUserToggle } from "@/components/profile/confirmedFollowToggle.hook";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { useAuthStore } from "@/store/auth.store";
import { useTheme } from "@/theme";
import type { TaggedUser, Verification, VerificationColor } from "@/types";
import type { FollowState } from "@/types/socialGraph.type";
import { requireAuthAfterClosingModal } from "@/utils/requireAuth.util";

const PROFILE_TYPE_BY_CHECKMARK: Record<VerificationColor, Verification["type"]> = { blue: "personal", gold: "business", black: "government" };

export const verificationForCheckmark = (checkmark: VerificationColor | null): Verification | null =>
  checkmark ? { status: "active", type: PROFILE_TYPE_BY_CHECKMARK[checkmark], color: checkmark, tier: "VERIFIED", badgeVisible: true } : null;

export interface TaggedPersonRowProps {
  readonly person: TaggedUser;
  readonly onPress: () => void;
  readonly closeContainer: () => void;
}

export function TaggedPersonRow({ person, onPress, closeContainer }: TaggedPersonRowProps) {
  const { colors } = useTheme();
  const signedInUserId = useAuthStore((state) => state.user?.id ?? null);
  const [followState, setFollowState] = useState<FollowState>(person.isFollowing ? "accepted" : "none");
  const { toggleUser } = useFollowUserToggle();
  const toggleFollow = () =>
    requireAuthAfterClosingModal(closeContainer, () => toggleUser({ id: person.id, username: person.username, followState }, setFollowState), "follow people");
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${person.displayName}, @${person.username}`}
        accessibilityHint="Opens their profile"
        onPress={onPress}
        style={({ pressed }) => [styles.identity, pressed ? { opacity: 0.6 } : null]}
      >
        <Avatar uri={person.avatarUrl} size={40} />
        <View style={styles.names}>
          <View style={styles.nameLine}>
            <Text size={15} weight={600} lineHeight={20} numberOfLines={1} style={styles.shrink}>
              {person.displayName}
            </Text>
            <VerificationBadge verification={verificationForCheckmark(person.checkmark)} size={16} />
          </View>
          <Text size={13} lineHeight={18} color={colors.textMuted} numberOfLines={1}>
            @{person.username}
          </Text>
        </View>
      </Pressable>
      {person.id !== signedInUserId ? <FollowPill isFollowing={isActiveFollowState(followState)} onPress={toggleFollow} large /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  identity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  names: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  shrink: { flexShrink: 1 },
});
