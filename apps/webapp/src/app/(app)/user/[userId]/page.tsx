"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

import { ProfileView } from "@/components/profile/profileView";
import { ErrorState, Spinner } from "@/components/ui/feedback";
import { RetryButton } from "@/components/ui/controls";
import { useSession } from "@/components/providers/sessionProvider";
import { usersService } from "@/services/users.service";
import { useQuery } from "@tanstack/react-query";

export default function UserProfilePage({ params }: { readonly params: Promise<{ readonly userId: string }> }) {
  const { userId } = use(params);
  const router = useRouter();
  const { viewer } = useSession();
  const isSelf = viewer?.id === userId;

  useEffect(() => {
    if (isSelf) router.replace("/me");
  }, [isSelf, router]);

  const userQuery = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => usersService.fetchUserProfileById(userId),
    enabled: !isSelf,
    retry: false,
  });

  if (isSelf) return <Spinner label="Opening your profile" />;
  if (userQuery.isLoading) return <Spinner label="Loading profile" />;
  if (userQuery.isError || !userQuery.data) {
    return <ErrorState title="Profile not found" description="This account may be private or deleted." action={<RetryButton onRetry={() => userQuery.refetch()} />} />;
  }

  return <ProfileView user={userQuery.data} isSelf={false} />;
}
