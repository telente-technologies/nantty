"use client";

import { FloatingBalloons } from "./floatingBalloons";
import styles from "./celebrations.module.css";
import { useSurfaceCelebration } from "./useSurfaceCelebration.hook";
import type { User } from "@/types";

function OwnProfileCelebration({ user }: { readonly user: User }) {
  const { celebration } = useSurfaceCelebration("profile", true, { posts: user.posts });
  if (!celebration) return null;
  return (
    <>
      <div className={styles.note} role="status" aria-live="polite">
        <p className={styles.noteTitle}>{celebration.title}</p>
        <p className={styles.noteText}>{celebration.message.slice(celebration.title.length).trim()}</p>
      </div>
      <FloatingBalloons height={260} />
    </>
  );
}

export function ProfileCelebration({ user, isSelf }: { readonly user: User; readonly isSelf: boolean }) {
  if (isSelf) return <OwnProfileCelebration user={user} />;
  if (!user.birthdayToday && !user.anniversaryToday) return null;
  return (
    <>
      {user.anniversaryToday ? <span className={styles.badge}>Nanttyversary</span> : null}
      {user.birthdayToday ? <FloatingBalloons height={260} /> : null}
    </>
  );
}
