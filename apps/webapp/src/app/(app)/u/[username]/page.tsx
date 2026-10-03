"use client";

import { use, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { showToast } from "@/components/ui/toast";
import { ErrorState, Spinner } from "@/components/ui/feedback";
import { usersService } from "@/services/users.service";

export default function UserByUsernamePage({ params }: { readonly params: Promise<{ readonly username: string }> }) {
  const { username } = use(params);
  const router = useRouter();
  const userQuery = useQuery({
    queryKey: ["userByUsername", username],
    queryFn: () => usersService.fetchUserIdByUsername(username),
    staleTime: 5 * 60_000,
    retry: false,
  });

  useEffect(() => {
    if (userQuery.data) router.replace(`/user/${userQuery.data.id}`);
  }, [userQuery.data, router]);

  useEffect(() => {
    if (userQuery.isError) showToast({ text: "User not found" });
  }, [userQuery.isError]);

  if (userQuery.isError) return <ErrorState title="User not found" description="This account may have been deleted or renamed." />;
  return <Spinner label="Opening profile" />;
}
