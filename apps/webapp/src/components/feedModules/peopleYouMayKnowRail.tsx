"use client";

import Link from "next/link";

import { useFollowUser } from "@/components/follow/useFollowUser.hook";
import { AppIcon } from "@/components/ui/appIcon";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/media";
import { CheckmarkBadge } from "@/components/verification/checkmarkBadge";
import type { FollowSuggestion } from "@/types/explore.type";
import { buildProfilePath } from "@/utils/seoPaths.util";

import styles from "./feedModules.module.css";

function PersonSuggestionCard({ suggestion, onDismiss }: { readonly suggestion: FollowSuggestion; readonly onDismiss: () => void }) {
  const { user } = suggestion;
  const follow = useFollowUser({ userId: user.id, username: user.username, displayName: user.name, initialState: "none", isPrivate: suggestion.isPrivate === true });
  const checkmarkColor = user.verification?.badgeVisible ? user.verification.color : user.verified ? "blue" : null;
  return (
    <li className={styles.personCard}>
      <button type="button" className={[styles.iconButton, styles.personDismiss].join(" ")} aria-label={`Remove ${user.name} from suggestions`} onClick={onDismiss}>
        <AppIcon name="cancel20" size={16} />
      </button>
      <Link href={buildProfilePath(user.username)} className={styles.personLink}>
        <Avatar name={user.name} src={user.avatarUrl} size="xl" />
        <span className={styles.nameRow}>
          <span className={styles.name}>{user.name}</span>
          {checkmarkColor ? <CheckmarkBadge color={checkmarkColor} /> : null}
        </span>
        <p className={styles.reason}>{suggestion.reason.label}</p>
      </Link>
      <Button
        size="sm"
        fullWidth
        variant={follow.isActive ? "secondary" : "primary"}
        busy={follow.isPending}
        onClick={follow.toggle}
        aria-label={follow.state === "requested" ? `Cancel follow request to ${user.name}` : `${follow.isActive ? "Unfollow" : "Follow"} ${user.name}`}
      >
        {follow.label}
      </Button>
    </li>
  );
}

export interface PeopleYouMayKnowRailProps {
  readonly suggestions: readonly FollowSuggestion[];
  readonly onDismiss: (suggestion: FollowSuggestion) => void;
}

export function PeopleYouMayKnowRail({ suggestions, onDismiss }: PeopleYouMayKnowRailProps) {
  return (
    <section className={styles.module} aria-label="People you may know">
      <div className={styles.header}>
        <h2 className={styles.title}>People you may know</h2>
        <Link href="/explore" className={styles.textButton}>See all</Link>
      </div>
      <ul className={styles.slider}>
        {suggestions.map((suggestion) => <PersonSuggestionCard key={suggestion.user.id} suggestion={suggestion} onDismiss={() => onDismiss(suggestion)} />)}
      </ul>
    </section>
  );
}
