"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppIcon, type AppIconName } from "@/components/ui/appIcon";
import { Dialog } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/media";
import { usePopoverMenu } from "@/components/ui/popoverMenu.hook";
import sheetStyles from "@/components/ui/popoverMenu.module.css";
import { showToast } from "@/components/ui/toast";
import { profileAvatarPresenceService } from "@/services/profileAvatarPresence.service";
import { storiesService } from "@/services/stories.service";
import type { FollowState, User } from "@/types";
import {
  describeProfileAvatarForAccessibility,
  doesProfileAvatarOpenMenu,
  listProfileAvatarMenuOptions,
  openLiveWhenStillOn,
  openStoryWhenStillActive,
  profileAvatarMenuOptionLabels,
  resolveProfileAvatarPresence,
  type ProfileAvatarMenuOption,
} from "@/utils/profileAvatarPresence.util";

import styles from "./profileAvatarButton.module.css";

const menuOptionIcons: Readonly<Record<ProfileAvatarMenuOption, AppIconName>> = {
  watchLive: "videoCamera24",
  viewStory: "play24",
  viewProfilePicture: "imageSquare24",
};

export function isProfileHiddenFromViewer(user: User, isSelf: boolean): boolean {
  if (isSelf) return false;
  const followState = user.followState ?? (user.isFollowing ? "accepted" : "none");
  return followState === "blocked" || (user.isPrivate === true && followState !== "accepted");
}

export function ProfileAvatarButton({ user, isSelf, followState }: { readonly user: User; readonly isSelf: boolean; readonly followState?: FollowState }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hidden = isProfileHiddenFromViewer(followState ? { ...user, followState } : user, isSelf);
  const storyStatus = useQuery({ queryKey: ["users", user.id, "story-status"], queryFn: () => profileAvatarPresenceService.fetchStoryRingStatus(user.id), enabled: !hidden, retry: false });
  const liveStatus = useQuery({ queryKey: ["users", user.id, "live"], queryFn: () => profileAvatarPresenceService.fetchHostLiveStatus(user.id), enabled: !hidden, retry: false });
  const presence = resolveProfileAvatarPresence({ storyStatus: storyStatus.data, liveStatus: liveStatus.data, isProfileHiddenFromViewer: hidden });
  const menu = usePopoverMenu();
  const [isPictureOpen, setIsPictureOpen] = useState(false);
  const label = describeProfileAvatarForAccessibility(presence, user.name);
  const ringClass = presence.ring === "live" ? styles.ringLive : presence.ring === "storyUnseen" ? styles.ringUnseen : presence.ring === "storySeen" ? styles.ringSeen : "";

  const reportUnavailable = (message: string) => {
    showToast({ text: message });
    void queryClient.invalidateQueries({ queryKey: ["users", user.id, "story-status"] });
    void queryClient.invalidateQueries({ queryKey: ["users", user.id, "live"] });
  };
  const runOption = (option: ProfileAvatarMenuOption) => {
    menu.close();
    if (option === "viewProfilePicture") return setIsPictureOpen(true);
    if (option === "viewStory") return void openStoryWhenStillActive(user.id, storiesService.fetchStoriesForUser, { open: (ownerId) => router.push(`/stories/${encodeURIComponent(ownerId)}`), reportUnavailable });
    void openLiveWhenStillOn(user.id, profileAvatarPresenceService.fetchHostLiveStatus, { open: (liveId) => router.push(`/live/${encodeURIComponent(liveId)}`), reportUnavailable });
  };

  const avatar = (
    <span className={[styles.ring, ringClass].filter(Boolean).join(" ")}>
      <Avatar name={user.name} src={user.avatarUrl} size="xl" />
      {presence.ring === "live" ? <span className={styles.livePill} aria-hidden="true">LIVE</span> : null}
    </span>
  );
  const pictureViewer = (
    <Dialog isOpen={isPictureOpen} onClose={() => setIsPictureOpen(false)} title={`${user.name}'s profile picture`} layout="centered" size="large" closeLabel="Close profile picture">
      {user.avatarUrl ? <img className={styles.picture} src={user.avatarUrl} alt={`${user.name}'s profile picture`} /> : null}
    </Dialog>
  );

  if (!doesProfileAvatarOpenMenu(presence)) {
    return (
      <>
        {user.avatarUrl ? (
          <button type="button" className={styles.trigger} aria-label={label} onClick={() => setIsPictureOpen(true)}>{avatar}</button>
        ) : avatar}
        {pictureViewer}
      </>
    );
  }

  return (
    <div className={styles.container} ref={menu.containerRef}>
      <button type="button" className={styles.trigger} aria-label={label} ref={menu.triggerRef} {...menu.triggerProps}>
        {avatar}
      </button>
      {presence.ring === "live" ? <span className={styles.srOnly}>Live now</span> : null}
      {menu.isOpen ? <div className={sheetStyles.scrim} aria-hidden="true" onPointerDown={() => menu.close()} /> : null}
      {menu.isOpen ? (
        <div className={[styles.menu, sheetStyles.sheet].join(" ")} aria-label={`${user.name}'s profile picture options`} ref={menu.menuRef} {...menu.menuProps}>
          {listProfileAvatarMenuOptions(presence, Boolean(user.avatarUrl)).map((option) => (
            <button key={option} type="button" role="menuitem" className={styles.item} onClick={() => runOption(option)}>
              <AppIcon name={menuOptionIcons[option]} size={20} />
              {profileAvatarMenuOptionLabels[option]}
            </button>
          ))}
        </div>
      ) : null}
      {pictureViewer}
    </div>
  );
}
