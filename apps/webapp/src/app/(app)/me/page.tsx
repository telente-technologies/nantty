"use client";

import { ProfileView } from "@/components/profile/profileView";
import { ErrorState } from "@/components/ui/feedback";
import { usersService } from "@/services/users.service";
import { useQuery } from "@tanstack/react-query";

import styles from "./page.module.css";
import { ProfileSkeleton } from "@/components/ui/pageSkeletons";

export default function MePage() {
  const profileQuery = useQuery({ queryKey: ["profile", "me"], queryFn: () => usersService.fetchMyProfile(), retry: false });

  if (profileQuery.isLoading) return <ProfileSkeleton label="Loading your profile" />;
  if (profileQuery.isError || !profileQuery.data) {
    return <ErrorState description="Couldn't load your profile." error={profileQuery.error} onRetry={() => void profileQuery.refetch()} />;
  }

  return (
    <div className={styles.page}>
      <ProfileView user={profileQuery.data} isSelf />
    </div>
  );
}
