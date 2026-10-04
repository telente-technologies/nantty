"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ContentActionsMenu } from "@/components/actions/contentActionsMenu";
import { SubscribeToCreatorDialog } from "@/components/actions/subscribeToCreatorDialog";
import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { Button } from "@/components/ui/button";
import { creatorSubscriptionsService } from "@/services/webActions.service";
import type { User } from "@/types";
import { buildProfilePath } from "@/utils/seoPaths.util";

export function ProfileVisitorActions({ user }: { readonly user: User }) {
  const [isSubscribeOpen, setIsSubscribeOpen] = useState(false);
  const plansQuery = useQuery({ queryKey: ["creatorPlans", user.id], queryFn: () => creatorSubscriptionsService.fetchPlans(user.id), retry: false, staleTime: 5 * 60_000 });
  const hasPlans = (plansQuery.data ?? []).length > 0;
  return (
    <>
      {hasPlans ? (
        <Button size="sm" variant="secondary" onClick={() => requireAuthThen(() => setIsSubscribeOpen(true), `Sign in to subscribe to ${user.name}.`)}>
          Subscribe
        </Button>
      ) : null}
      <ContentActionsMenu shareKind="profile" reportTargetType="user" targetId={user.id} canonicalPath={buildProfilePath(user.username)} />
      {hasPlans ? <SubscribeToCreatorDialog isOpen={isSubscribeOpen} onClose={() => setIsSubscribeOpen(false)} creatorId={user.id} creatorName={user.name} /> : null}
    </>
  );
}
