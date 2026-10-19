import { Image } from "expo-image";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Image24Icon, Play24Icon, VideoCamera24Icon } from "@/components/icons";
import { LiveAvatarRing } from "@/components/live/liveAvatarRing";
import { ActionSheet, type ActionSheetOption } from "@/components/ui/actionSheet";
import { PreviewableImage, useImagePreview } from "@/components/ui/previewableImage";
import { makeThemedStyles } from "@/theme";
import type { User } from "@/types";
import {
  describeProfileAvatarForAccessibility,
  doesProfileAvatarOpenMenu,
  listProfileAvatarMenuOptions,
  profileAvatarMenuOptionLabels,
  type ProfileAvatarMenuOption,
  type ProfileAvatarRing,
} from "@/utils/profileAvatarPresence.util";

import { useProfileAvatarPresence } from "./profileAvatarPresence.hook";

const AVATAR_SIZE = 64;
const STORY_RING_GAP = 3;
const STORY_RING_WIDTH = 2;
const SHEET_DISMISS_BEFORE_VIEWER_MS = 400;

export interface ProfileAvatarProps {
  readonly profile: User;
  readonly borderRadius: number;
  readonly isProfileHiddenFromViewer: boolean;
}

function StoryAvatarRing({ ring, borderRadius, children }: { readonly ring: Exclude<ProfileAvatarRing, "live" | "none">; readonly borderRadius: number; readonly children: ReactNode }) {
  const styles = useStyles();
  const inset = STORY_RING_GAP + STORY_RING_WIDTH;
  return (
    <View testID={`profileAvatarRing-${ring}`} style={[styles.storyRing, ring === "storyUnseen" ? styles.storyRingUnseen : styles.storyRingSeen, { borderRadius: borderRadius + inset, padding: STORY_RING_GAP }]}>
      {children}
    </View>
  );
}

export function ProfileAvatar({ profile, borderRadius, isProfileHiddenFromViewer }: ProfileAvatarProps) {
  const styles = useStyles();
  const { presence, openStory, openLive } = useProfileAvatarPresence(profile.id, isProfileHiddenFromViewer);
  const { openImagePreview, imagePreviewElement } = useImagePreview();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const avatarImage = profile.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null;
  const avatar = <View style={[styles.avatar, { borderRadius }]}>{avatarImage}</View>;

  if (!doesProfileAvatarOpenMenu(presence)) {
    return (
      <PreviewableImage imageUrl={profile.avatarUrl} accessibilityLabel={describeProfileAvatarForAccessibility(presence, profile.name)}>
        {avatar}
      </PreviewableImage>
    );
  }

  const actionForOption: Record<ProfileAvatarMenuOption, Omit<ActionSheetOption, "label">> = {
    watchLive: { icon: <VideoCamera24Icon />, onPress: () => void openLive() },
    viewStory: { icon: <Play24Icon />, onPress: () => void openStory() },
    viewProfilePicture: { icon: <Image24Icon />, onPress: () => setTimeout(() => openImagePreview([profile.avatarUrl]), SHEET_DISMISS_BEFORE_VIEWER_MS) },
  };
  const options = listProfileAvatarMenuOptions(presence, Boolean(profile.avatarUrl)).map((option) => ({ label: profileAvatarMenuOptionLabels[option], ...actionForOption[option] }));

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={describeProfileAvatarForAccessibility(presence, profile.name)}
        accessibilityHint="Opens options for this profile picture"
        onPress={() => setIsMenuOpen(true)}
        onLongPress={() => openImagePreview([profile.avatarUrl])}
      >
        {presence.ring === "live" ? (
          <LiveAvatarRing size={AVATAR_SIZE} borderRadius={borderRadius}>{avatar}</LiveAvatarRing>
        ) : (
          <StoryAvatarRing ring={presence.ring === "storySeen" ? "storySeen" : "storyUnseen"} borderRadius={borderRadius}>{avatar}</StoryAvatarRing>
        )}
      </Pressable>
      <ActionSheet visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} options={options} title={profile.name} />
      {imagePreviewElement}
    </>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, backgroundColor: colors.placeholder, overflow: "hidden" },
  storyRing: { borderWidth: STORY_RING_WIDTH },
  storyRingUnseen: { borderColor: colors.primary },
  storyRingSeen: { borderColor: colors.textFaint },
}));
