"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PostCard } from "@/components/feed/postCard";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";
import { RetryButton } from "@/components/ui/controls";
import { Avatar, MediaImage } from "@/components/ui/media";
import { BellIcon, LogOutIcon, SettingsIcon, StoreIcon } from "@/components/ui/icons";
import { followsService } from "@/services/posts.service";
import { sendRequestToWebappServer } from "@/services/clientApi.service";
import { messagesService } from "@/services/messages.service";
import { usersService } from "@/services/users.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCountWithThousandsSuffix, formatJoinedDate } from "@/utils/formatDate.util";
import type { User } from "@/types";

import styles from "./profileView.module.css";

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

  const postsQuery = useQuery({
    queryKey: ["profile", "posts", user.id],
    queryFn: () => usersService.fetchPostsByUserId(user.id),
    retry: false,
  });

  const followMutation = useMutation({
    mutationFn: (followNow: boolean) => (followNow ? followsService.followUser(user.id) : followsService.unfollowUser(user.id)),
    onMutate: async (followNow) => {
      setIsFollowing(followNow);
      await queryClient.cancelQueries({ queryKey: ["profile", "posts", user.id] });
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
            {user.verified ? <span className={styles.verified} aria-label="Verified account">✓</span> : null}
          </div>
          <p className={styles.handle}>@{user.username}</p>
          {user.bio ? <p className={styles.bio}>{user.bio}</p> : null}
          <p className={styles.joined}>{formatJoinedDate(user.joinedAt)}</p>
        </div>

        <div className={styles.actions}>
          {isSelf ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => router.push("/settings")}>
                Edit profile
              </Button>
              <div className={styles.iconLinks}>
                <Link href="/orders" className={styles.iconLink} aria-label="Your orders">
                  <StoreIcon size={18} />
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
              <Button size="sm" busy={followMutation.isPending} onClick={() => followMutation.mutate(!isFollowing)}>
                {isFollowing ? "Following" : "Follow"}
              </Button>
              <Button size="sm" variant="secondary" busy={startChat.isPending} onClick={() => startChat.mutate()}>
                Message
              </Button>
            </>
          )}
        </div>
      </header>

      <div className={styles.stats}>
        <Stat label="Posts" value={user.posts} />
        <Stat label="Followers" value={user.followers} />
        <Stat label="Following" value={user.following} />
      </div>

      <section className={styles.posts}>
        <h2 className={styles.postsTitle}>Posts</h2>
        {postsQuery.isLoading ? (
          <Spinner label="Loading posts" />
        ) : postsQuery.isError ? (
          <ErrorState description="We couldn't load these posts." action={<RetryButton onRetry={() => postsQuery.refetch()} />} />
        ) : (postsQuery.data?.data ?? []).length === 0 ? (
          <EmptyState icon="📝" title="No posts yet" description={isSelf ? "Share something with your followers." : `${user.name} hasn't posted yet.`} />
        ) : (
          <div className={styles.postList}>
            {postsQuery.data?.data.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export async function signOut(): Promise<void> {
  await sendRequestToWebappServer<void>("/auth/logout", { method: "POST" });
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className={styles.signOut}
      onClick={() => {
        signOut().finally(() => {
          router.push("/login");
          router.refresh();
        });
      }}
    >
      <LogOutIcon size={17} /> Sign out
    </button>
  );
}
