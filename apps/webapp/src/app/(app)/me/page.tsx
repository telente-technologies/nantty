import { ProfileView, SignOutButton } from "@/components/profile/profileView";
import { ErrorState, Spinner } from "@/components/ui/feedback";
import { RetryButton } from "@/components/ui/controls";
import { usersService } from "@/services/users.service";
import { useQuery } from "@tanstack/react-query";

import styles from "./page.module.css";

export default function MePage() {
  const profileQuery = useQuery({ queryKey: ["profile", "me"], queryFn: () => usersService.fetchMyProfile(), retry: false });

  if (profileQuery.isLoading) return <Spinner label="Loading your profile" />;
  if (profileQuery.isError || !profileQuery.data) {
    return <ErrorState description="We couldn't load your profile." action={<RetryButton onRetry={() => profileQuery.refetch()} />} />;
  }

  return (
    <div className={styles.page}>
      <ProfileView user={profileQuery.data} isSelf />
      <div className={styles.footer}>
        <SignOutButton />
      </div>
    </div>
  );
}
