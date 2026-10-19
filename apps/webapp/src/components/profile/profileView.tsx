"use client";

import { MentionText } from "@/components/mentions/mentionText";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ProfileCelebration } from "@/components/celebrations/profileCelebration";
import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { ProfileContentTabs } from "./profileContentTabs";
import { LockedProfileNotice } from "./lockedProfileNotice";
import { ProfileAvatarButton } from "./profileAvatarButton";
import { ProfileVisitorActions } from "./profileVisitorActions";
import { Button } from "@/components/ui/button";
import { MediaImage } from "@/components/ui/media";
import { LogOutIcon } from "@/components/ui/icons";
import { showToast } from "@/components/ui/toast";
import { buildProfilePath } from "@/utils/seoPaths.util";
import { OwnProfileHeaderActions } from "./ownProfileMenu";
import { requestConfirmation } from "@/components/ui/confirmDialog";
import { chatCryptoService } from "@/services/chatCrypto/chatCrypto.service";
import { sendRequestToWebappServer } from "@/services/clientApi.service";
import { messagesService } from "@/services/messages.service";
import { usersService } from "@/services/users.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCountWithThousandsSuffix, formatJoinedDate } from "@/utils/formatDate.util";
import type { PostNotificationLevel, User } from "@/types";
import { PostNotificationsBell } from "@/components/follow/postNotificationsBell";
import { useFollowUser } from "@/components/follow/useFollowUser.hook";
import { useSession } from "@/components/providers/sessionProvider";
import { shouldShowPostNotificationBell } from "@/utils/followToggle.util";
import { followStatusPollIntervalMs, lockedProfileCopyByLock, resolveProfileLock } from "@/utils/profileLock.util";
import { useUnblockFromProfile } from "./unblockFromProfile.hook";

import styles from "./profileView.module.css";
import { AppIcon } from "@/components/ui/appIcon";
import { SearchScopeRegistrar } from "@/components/search/searchScopeRegistrar";

function Stat({ label, value, href }: { readonly label: string; readonly value: number; readonly href?: string }) {
  const content = (
    <>
      <strong>{formatCountWithThousandsSuffix(value)}</strong>
      <span>{label}</span>
    </>
  );
  return href ? <Link href={href} className={styles.stat}>{content}</Link> : <span className={styles.stat}>{content}</span>;
}

async function shareProfileLink(user: User) {
  const url = `${window.location.origin}${buildProfilePath(user.username)}`;
  const text = `Follow ${user.name} on Zudomart`;
  if (typeof navigator.share === "function") {
    await navigator.share({ title: text, text, url }).catch(() => undefined);
    return;
  }
  const copied = await navigator.clipboard?.writeText(url).then(() => true, () => false);
  showToast(copied ? { text: "Profile link copied" } : { text: "Couldn't copy the link", tone: "error" });
}

interface ProfileViewProps {
  readonly user: User;
  readonly isSelf: boolean;
}

export function ProfileView({ user, isSelf }: ProfileViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { viewer } = useSession();
  const followStatus = useQuery({
    queryKey: ["followStatus", user.id],
    queryFn: () => usersService.fetchFollowStatus(user.id),
    enabled: !isSelf && viewer !== null,
    retry: false,
    refetchInterval: (query) => followStatusPollIntervalMs(query.state.data?.state),
  });
  const viewerPostNotifications = followStatus.data?.viewerPostNotifications ?? user.viewerPostNotifications ?? "off";
  const [postNotificationLevel, setPostNotificationLevel] = useState<PostNotificationLevel>(viewerPostNotifications);
  useEffect(() => setPostNotificationLevel(viewerPostNotifications), [viewerPostNotifications]);
  const follow = useFollowUser({
    userId: user.id, username: user.username, displayName: user.name,
    initialState: followStatus.data?.state ?? user.followState ?? (user.isFollowing ? "accepted" : "none"),
    isPrivate: user.isPrivate === true,
    onStateChange: (state) => {
      if (state !== "accepted") setPostNotificationLevel("off");
      void queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      void queryClient.invalidateQueries({ queryKey: ["followStatus", user.id] });
    },
  });

  const profileLock = resolveProfileLock({ isSelf, isPrivate: user.isPrivate, followState: follow.state });
  const unblock = useUnblockFromProfile(user);

  const startChat = useMutation({
    mutationFn: () => messagesService.startConversationWithUser(user.id),
    onSuccess: (conversation) => router.push(`/chats/${conversation.id}`),
  });

  return (
    <div className={styles.page}>
      <SearchScopeRegistrar scope={`profile:${user.id}`} label={`@${user.username}`} />
      <div className={styles.banner}>
        {user.bannerUrl ? <MediaImage src={user.bannerUrl} alt="" sizes="100vw" priority /> : null}
      </div>

      {isSelf ? <OwnProfileHeaderActions profile={user} /> : null}
      <header className={styles.header}>
        <div className={styles.avatarWrap}>
          <ProfileAvatarButton user={user} isSelf={isSelf} followState={followStatus.data?.state} />
        </div>

        <div className={styles.identity}>
          <div className={styles.nameRow}>
            <h1 className={styles.name}>{user.name}</h1>
            {user.verified ? <span className={styles.verified} aria-label="Verified account"><AppIcon name="check16" size={12} /></span> : null}
          </div>
          <p className={styles.handle}>@{user.username}</p>
          {user.bio ? <p className={styles.bio}><MentionText text={user.bio} /></p> : null}
          <p className={styles.joined}>{formatJoinedDate(user.joinedAt)}</p>
        </div>

        <ProfileCelebration user={user} isSelf={isSelf} />

        <div className={styles.actions}>
          {isSelf ? (
            <>
              <Link href="/me/edit" className={styles.secondaryAction}>Edit profile</Link>
              <button type="button" className={styles.secondaryAction} onClick={() => void shareProfileLink(user)}>Share profile</button>
            </>
          ) : (
            <>
              {profileLock === "blocked" ? (
                <Button size="sm" variant="secondary" busy={unblock.isPending} onClick={unblock.confirmAndUnblock}>Unblock</Button>
              ) : (
                <Button size="sm" variant={follow.isActive ? "secondary" : "primary"} busy={follow.isPending} onClick={follow.toggle}>
                  {follow.label}
                </Button>
              )}
              <Button size="sm" variant="secondary" busy={startChat.isPending} onClick={() => requireAuthThen(() => startChat.mutate(), `Sign in to message ${user.name}.`)}>
                Message
              </Button>
              {shouldShowPostNotificationBell({ isSelf, isSignedIn: viewer !== null, followState: follow.state }) ? (
                <PostNotificationsBell userId={user.id} username={user.username} initialLevel={postNotificationLevel} onLevelChange={setPostNotificationLevel} />
              ) : null}
              <ProfileVisitorActions user={user} />
            </>
          )}
        </div>
      </header>

      <div className={styles.stats}>
        <Stat label="Posts" value={user.posts} />
        <Stat label="Followers" value={followStatus.data?.followersCount ?? user.followers} href={profileLock === "open" ? `/user/${encodeURIComponent(user.id)}/connections?tab=followers` : undefined} />
        <Stat label="Following" value={followStatus.data?.followingCount ?? user.following} href={profileLock === "open" ? `/user/${encodeURIComponent(user.id)}/connections?tab=following` : undefined} />
      </div>

      {profileLock === "open" ? <ProfileContentTabs user={user} isSelf={isSelf} /> : <LockedProfileNotice copy={lockedProfileCopyByLock[profileLock]} />}
    </div>
  );
}

export async function signOut(): Promise<void> {
  await chatCryptoService.signOut();
  await sendRequestToWebappServer<void>("/auth/logout", { method: "POST" });
}

export async function confirmThenSignOut(): Promise<boolean> {
  const confirmed = await requestConfirmation({
    title: "Sign out of Zudomart?",
    description: "You'll need to sign in again to message, buy or post.",
    confirmLabel: "Sign out",
    intent: "signOut",
  });
  if (!confirmed) return false;
  await signOut().catch(() => undefined);
  return true;
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className={styles.signOut}
      onClick={() => {
        void confirmThenSignOut().then((didSignOut) => {
          if (!didSignOut) return;
          router.push("/login");
          router.refresh();
        });
      }}
    >
      <LogOutIcon size={17} /> Sign out
    </button>
  );
}
