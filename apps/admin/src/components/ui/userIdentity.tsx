import type { PlatformUserSummary } from "@/types/platformUser.type";

import styles from "./userIdentity.module.css";
import { VerificationBadge } from "./verificationBadge";

type IdentityUser = Pick<PlatformUserSummary, "displayName" | "username" | "avatarUrl"> & { readonly verification?: PlatformUserSummary["verification"] };

export function UserAvatar({ user, size = 28 }: { readonly user: Pick<IdentityUser, "displayName" | "avatarUrl">; readonly size?: number }) {
  const initials = user.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return user.avatarUrl ? (
    <img src={user.avatarUrl} alt="" width={size} height={size} className={styles.avatar} referrerPolicy="no-referrer" loading="lazy" />
  ) : (
    <span className={styles.initials} style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden>
      {initials}
    </span>
  );
}

export function UserIdentity({ user, size = 28 }: { readonly user: IdentityUser; readonly size?: number }) {
  return (
    <span className={styles.identity}>
      <UserAvatar user={user} size={size} />
      <span className={styles.names}>
        <span className={styles.displayName}>
          {user.displayName}
          {user.verification ? <VerificationBadge verification={user.verification} /> : null}
        </span>
        <span className={styles.username}>@{user.username}</span>
      </span>
    </span>
  );
}
