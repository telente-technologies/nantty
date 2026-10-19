"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { useFollowUser } from "@/components/follow/useFollowUser.hook";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Avatar } from "@/components/ui/media";
import { CheckmarkBadge } from "@/components/verification/checkmarkBadge";
import { discoveryService } from "@/services/discovery.service";
import type { FollowSuggestion } from "@/types/explore.type";
import { buildProfilePath } from "@/utils/seoPaths.util";

import styles from "./followingClipsEmptyState.module.css";

const SUGGESTED_CREATORS_TO_SHOW = 5;

function SuggestedCreatorRow({ suggestion, onFollowedCreator }: { readonly suggestion: FollowSuggestion; readonly onFollowedCreator: () => void }) {
  const { user } = suggestion;
  const follow = useFollowUser({
    userId: user.id,
    username: user.username,
    displayName: user.name,
    initialState: "none",
    isPrivate: suggestion.isPrivate === true,
  });
  const refreshedForFollow = useRef(false);
  useEffect(() => {
    if (follow.isPending || follow.state !== "accepted" || refreshedForFollow.current) return;
    refreshedForFollow.current = true;
    onFollowedCreator();
  }, [follow.isPending, follow.state, onFollowedCreator]);
  const checkmarkColor = user.verification?.badgeVisible ? user.verification.color : user.verified ? "blue" : null;
  return (
    <li className={styles.row}>
      <Link href={buildProfilePath(user.username)} className={styles.identity}>
        <Avatar name={user.name} src={user.avatarUrl} size="md" />
        <span className={styles.text}>
          <span className={styles.name}>
            {user.name}
            {checkmarkColor ? <CheckmarkBadge color={checkmarkColor} /> : null}
          </span>
          <span className={styles.reason}>{suggestion.reason.label}</span>
        </span>
      </Link>
      <Button size="sm" variant={follow.isActive ? "secondary" : "primary"} busy={follow.isPending} onClick={follow.toggle} aria-label={`${follow.isActive ? "Unfollow" : "Follow"} ${user.name}`}>
        {follow.label}
      </Button>
    </li>
  );
}

export function FollowingClipsEmptyState({ onFollowedCreator, onWatchForYou }: { readonly onFollowedCreator: () => void; readonly onWatchForYou: () => void }) {
  const suggestions = useQuery({ queryKey: ["clips", "followingEmpty", "creators"], queryFn: () => discoveryService.fetchFollowSuggestions(SUGGESTED_CREATORS_TO_SHOW), staleTime: 300_000 });
  const creators = suggestions.data ?? [];
  return (
    <div className={styles.root}>
      <EmptyState
        kind="clips"
        title="Follow people to see their clips here"
        description="When people you follow post clips, they'll show up here."
        action={<Button variant="secondary" onClick={onWatchForYou}>Watch For You</Button>}
      />
      {creators.length > 0 ? (
        <section aria-labelledby="following-clips-suggested-creators">
          <h2 id="following-clips-suggested-creators" className={styles.heading}>Suggested creators</h2>
          <ul className={styles.list}>
            {creators.map((suggestion) => <SuggestedCreatorRow key={suggestion.user.id} suggestion={suggestion} onFollowedCreator={onFollowedCreator} />)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
