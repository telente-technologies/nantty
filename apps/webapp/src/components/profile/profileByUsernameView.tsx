"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSession } from "@/components/providers/sessionProvider";
import { Spinner } from "@/components/ui/feedback";
import { usersService } from "@/services/users.service";
import type { User } from "@/types";

import { ProfileView } from "./profileView";

export function ProfileByUsernameView({ initialUser }: { readonly initialUser: User }) {
  const router = useRouter();
  const { viewer } = useSession();
  const isSelf = viewer?.id === initialUser.id;

  useEffect(() => {
    if (isSelf) router.replace("/me");
  }, [isSelf, router]);

  const userQuery = useQuery({
    queryKey: ["profile", initialUser.id],
    queryFn: () => usersService.fetchUserProfileById(initialUser.id),
    initialData: initialUser,
    initialDataUpdatedAt: 0,
    enabled: !isSelf && !!viewer,
    retry: false,
  });

  if (isSelf) return <Spinner label="Opening your profile" />;
  return <ProfileView user={userQuery.data ?? initialUser} isSelf={false} />;
}
