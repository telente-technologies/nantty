"use client";

import { MentionText } from "@/components/mentions/mentionText";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ProfileCelebration } from "@/components/celebrations/profileCelebration";
import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { ProfileContentTabs } from "./profileContentTabs";
import { ProfileVisitorActions } from "./profileVisitorActions";
import { Button } from "@/components/ui/button";
import { Avatar, MediaImage } from "@/components/ui/media";
import { BellIcon, BookmarkIcon, LogOutIcon, OrdersIcon, SettingsIcon } from "@/components/ui/icons";
import { requestConfirmation } from "@/components/ui/confirmDialog";
import { followsService } from "@/services/posts.service";
import { sendRequestToWebappServer } from "@/services/clientApi.service";
import { messagesService } from "@/services/messages.service";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCountWithThousandsSuffix, formatJoinedDate } from "@/utils/formatDate.util";
import type { User } from "@/types";

import styles from "./profileView.module.css";
import { AppIcon } from "@/components/ui/appIcon";

function Stat({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <span className={styles.stat}>
      <strong>{formatCountWithThousandsSuffix(value)}</strong>
      <span>{label}</span>
    </span>
  );
}

interface ProfileViewProps {
  readonly user: User;
  readonly isSelf: boolean;
}

export function ProfileView({ user, isSelf }: ProfileViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isFollowing, setIsFollowing] = useState(user.isFollowing ?? false);

  const followMutation = useMutation({
    mutationFn: (followNow: boolean) => (followNow ? followsService.followUser(user.id) : followsService.unfollowUser(user.id)),
    onMutate: async (followNow) => {
      setIsFollowing(followNow);
      await queryClient.cancelQueries({ queryKey: ["profile", user.id] });
    },
    onError: (_error, followNow) => setIsFollowing(!followNow),
  });

  const startChat = useMutation({
    mutationFn: () => messagesService.startConversationWithUser(user.id),
    onSuccess: (conversation) => router.push(`/chats/${conversation.id}`),
  });

  return (
    <div className={styles.page}>
      <div className={styles.banner}>
        {user.bannerUrl ? <MediaImage src={user.bannerUrl} alt="" sizes="100vw" priority /> : null}
      </div>

      <header className={styles.header}>
        <div className={styles.avatarWrap}>
          <Avatar name={user.name} src={user.avatarUrl} size="xl" ring />
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
              <div className={styles.iconLinks}>
                <Link href="/saved" className={styles.iconLink} aria-label="Saved items">
                  <BookmarkIcon size={18} />
                </Link>
                <Link href="/orders" className={styles.iconLink} aria-label="Your orders">
                  <OrdersIcon size={18} />
                </Link>
                <Link href="/notifications" className={styles.iconLink} aria-label="Notifications">
                  <BellIcon size={18} />
                </Link>
                <Link href="/settings" className={styles.iconLink} aria-label="Settings">
                  <SettingsIcon size={18} />
                </Link>
              </div>
            </>
          ) : (
            <>
              <Button size="sm" busy={followMutation.isPending} onClick={() => requireAuthThen(() => followMutation.mutate(!isFollowing), `Sign in to follow ${user.name}.`)}>
                {isFollowing ? "Following" : "Follow"}
              </Button>
              <Button size="sm" variant="secondary" busy={startChat.isPending} onClick={() => requireAuthThen(() => startChat.mutate(), `Sign in to message ${user.name}.`)}>
                Message
              </Button>
              <ProfileVisitorActions user={user} />
            </>
          )}
        </div>
      </header>

      <div className={styles.stats}>
        <Stat label="Posts" value={user.posts} />
        <Stat label="Followers" value={user.followers} />
        <Stat label="Following" value={user.following} />
      </div>

      <ProfileContentTabs user={user} isSelf={isSelf} />
    </div>
  );
}

export async function signOut(): Promise<void> {
  await sendRequestToWebappServer<void>("/auth/logout", { method: "POST" });
}

export async function confirmThenSignOut(): Promise<boolean> {
  const confirmed = await requestConfirmation({
    title: "Sign out of Zudomart?",
    description: "You'll need to sign in again to message, buy or post.",
    confirmLabel: "Sign out",
    icon: <LogOutIcon size={22} />,
    tone: "brand",
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
