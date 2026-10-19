"use client";

import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { boostsService } from "@/services/boosts.service";
import type { BoostDestinationType } from "@/types/boost.type";
import { draftFromBoost, emptyAdDraft } from "@/utils/adsHub.util";

import { CreateAdFlow } from "./createAdFlow";

const DESTINATION_TYPES: readonly BoostDestinationType[] = ["post", "product", "store", "profile"];
const TARGET_PATTERN = /^[A-Za-z0-9_.~-]{1,80}$/;

interface CreateAdEntryProps {
  readonly destinationType: string | null;
  readonly targetId: string | null;
  readonly fromBoostId: string | null;
  readonly isResubmission: boolean;
}

export function CreateAdEntry({ destinationType, targetId, fromBoostId, isResubmission }: CreateAdEntryProps) {
  const source = useQuery({ queryKey: ["ads", "boost", fromBoostId], queryFn: () => boostsService.fetchBoostById(fromBoostId!), enabled: Boolean(fromBoostId), retry: false });
  if (fromBoostId) {
    if (source.isLoading) return <ListRowsSkeleton label="Loading your ad" rows={4} />;
    if (source.isError || !source.data) return <ErrorState description="We couldn't load the ad to copy." error={source.error} onRetry={() => void source.refetch()} />;
    return <CreateAdFlow key={`from-${source.data.id}`} initialDraft={draftFromBoost(source.data)} isResubmission={isResubmission && source.data.status === "rejected"} />;
  }
  const knownType = DESTINATION_TYPES.find((type) => type === destinationType) ?? null;
  const destination = knownType && targetId && TARGET_PATTERN.test(targetId) ? { type: knownType, targetId } : null;
  return <CreateAdFlow key={destination ? `${destination.type}-${destination.targetId}` : "new"} initialDraft={emptyAdDraft(destination)} isResubmission={false} />;
}
