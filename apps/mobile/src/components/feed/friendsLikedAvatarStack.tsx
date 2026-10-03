import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { makeThemedStyles, useTheme } from "@/theme";

const MAXIMUM_VISIBLE_FRIEND_AVATARS = 3;

export interface FriendsLikedAvatarStackProps {
  readonly avatarUrls: readonly (string | null)[];
  readonly avatarSize: number;
  readonly overlapOffset: number;
  readonly fallbackIcon: ReactNode;
}

export function FriendsLikedAvatarStack({ avatarUrls, avatarSize, overlapOffset, fallbackIcon }: FriendsLikedAvatarStackProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const visibleAvatarUrls = avatarUrls.slice(0, MAXIMUM_VISIBLE_FRIEND_AVATARS);
  if (visibleAvatarUrls.length === 0) return <>{fallbackIcon}</>;
  const stackWidth = avatarSize + overlapOffset * (visibleAvatarUrls.length - 1);
  return (
    <View style={{ width: stackWidth, height: avatarSize }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {visibleAvatarUrls.map((avatarUrl, index) => (
        <Avatar
          key={index}
          uri={avatarUrl}
          size={avatarSize}
          placeholderColor={colors.placeholder}
          style={[styles.stackedAvatar, { left: index * overlapOffset, zIndex: index }]}
        />
      ))}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  stackedAvatar: { position: "absolute", top: 0, borderWidth: 1, borderColor: colors.surface },
}));
