"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ContentActionsMenu } from "@/components/actions/contentActionsMenu";
import { SubscribeToCreatorDialog } from "@/components/actions/subscribeToCreatorDialog";
import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { useSession } from "@/components/providers/sessionProvider";
import { Button } from "@/components/ui/button";
import { requestConfirmation } from "@/components/ui/confirmDialog";
import { ProhibitIcon } from "@/components/ui/icons";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { followsService } from "@/services/posts.service";
import { creatorSubscriptionsService } from "@/services/webActions.service";
import type { User } from "@/types";
import { buildProfilePath } from "@/utils/seoPaths.util";

export function ProfileVisitorActions({ user }: { readonly user: User }) {
  const [isSubscribeOpen, setIsSubscribeOpen] = useState(false);
  const plansQuery = useQuery({ queryKey: ["creatorPlans", user.id], queryFn: () => creatorSubscriptionsService.fetchPlans(user.id), retry: false, staleTime: 5 * 60_000 });
  const { viewer } = useSession();
  const mySubscriptionsQuery = useQuery({ queryKey: ["creatorSubscriptions", "mine"], queryFn: creatorSubscriptionsService.fetchMySubscriptions, enabled: viewer !== null, retry: false });
  const router = useRouter();
  const queryClient = useQueryClient();
  const block = useMutation({
    mutationFn: () => followsService.blockUser(user.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      showToast({ text: `You blocked ${user.name}` });
      router.push("/");
    },
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });
  const confirmBlock = () =>
    requireAuthThen(async () => {
      const confirmed = await requestConfirmation({
        title: `Block ${user.name}?`,
        description: "They won't be able to find your profile, see your posts or message you. They won't be told you blocked them.",
        confirmLabel: "Block",
        intent: "block",
      });
      if (confirmed) block.mutate();
    }, "Sign in to block accounts.");
  const hasPlans = (plansQuery.data ?? []).length > 0;
  const isSubscribed = (mySubscriptionsQuery.data ?? []).some((subscription) => subscription.creatorId === user.id && subscription.status === "active");
  return (
    <>
      {isSubscribed ? (
        <Button size="sm" variant="secondary" onClick={() => router.push("/subscriptions")}>
          Subscribed
        </Button>
      ) : hasPlans ? (
        <Button size="sm" variant="secondary" onClick={() => requireAuthThen(() => setIsSubscribeOpen(true), `Sign in to subscribe to ${user.name}.`)}>
          Subscribe
        </Button>
      ) : null}
      <ContentActionsMenu shareKind="profile" reportTargetType="user" targetId={user.id} canonicalPath={buildProfilePath(user.username)} extraDangerActions={[{ label: block.isPending ? "Blocking…" : `Block ${user.name}`, icon: <ProhibitIcon size={18} aria-hidden="true" />, onSelect: confirmBlock }]} />
      {hasPlans ? <SubscribeToCreatorDialog isOpen={isSubscribeOpen} onClose={() => setIsSubscribeOpen(false)} creatorId={user.id} creatorName={user.name} /> : null}
    </>
  );
}
