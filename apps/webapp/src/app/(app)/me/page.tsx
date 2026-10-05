"use client";

import { ProfileView, SignOutButton } from "@/components/profile/profileView";
import { ErrorState } from "@/components/ui/feedback";
import { RetryButton } from "@/components/ui/controls";
import { usersService } from "@/services/users.service";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import styles from "./page.module.css";
import { ProfileSkeleton } from "@/components/ui/pageSkeletons";

export default function MePage() {
  const profileQuery = useQuery({ queryKey: ["profile", "me"], queryFn: () => usersService.fetchMyProfile(), retry: false });

  if (profileQuery.isLoading) return <ProfileSkeleton label="Loading your profile" />;
  if (profileQuery.isError || !profileQuery.data) {
    return <ErrorState description="We couldn't load your profile." action={<RetryButton onRetry={() => profileQuery.refetch()} />} />;
  }

  return (
    <div className={styles.page}>
      <ProfileView user={profileQuery.data} isSelf />
      <div className={styles.footer}>
        <Link href="/creator" className={styles.creatorLink}>
          Creator tools
        </Link>
        <Link href="/store-rewards" className={styles.creatorLink}>
          Store rewards
        </Link>
        <SignOutButton />
      </div>
    </div>
  );
}
