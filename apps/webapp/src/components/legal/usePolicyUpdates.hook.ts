"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { useSession } from "@/components/providers/sessionProvider";
import { privacyService } from "@/services/privacy.service";
import { legalService } from "@/services/legal.service";
import type { PolicyVersionSummary } from "@/types/policyUpdate.type";

const dismissedStorageKey = "nantty.webapp.dismissedPolicyBanners";
const acceptanceQueryKey = ["legal", "acceptances"] as const;

function readDismissedIds(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(dismissedStorageKey) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function usePolicyUpdates() {
  const { viewer } = useSession();
  const isSignedIn = viewer !== null;
  const queryClient = useQueryClient();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const versions = useQuery({ queryKey: ["legal", "current"], queryFn: legalService.fetchCurrentPolicyVersions, retry: false, staleTime: 60_000, enabled: isSignedIn });
  const acceptances = useQuery({ queryKey: acceptanceQueryKey, queryFn: legalService.fetchMyPolicyAcceptances, retry: false, staleTime: 60_000, enabled: isSignedIn });
  const acceptMutation = useMutation({
    mutationFn: (version: PolicyVersionSummary) => privacyService.updateMyConsents({ policyVersion: version.policyVersionId, policyVersionId: version.policyVersionId, consents: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: acceptanceQueryKey }),
  });

  useEffect(() => setDismissedIds(readDismissedIds()), []);

  const dismiss = useCallback((policyVersionId: string) => {
    setDismissedIds((current) => {
      const next = [...current, policyVersionId];
      try {
        window.localStorage.setItem(dismissedStorageKey, JSON.stringify(next));
      } catch {
        return next;
      }
      return next;
    });
  }, []);

  const accepted = new Set(acceptances.data?.acceptedPolicyVersionIds ?? []);
  const pending = (versions.data?.items ?? []).filter((version) => (version.documentKey === "terms" || version.documentKey === "privacy") && !accepted.has(version.policyVersionId));
  const blocking = pending.find((version) => version.isMaterialChange && Date.parse(version.effectiveAt) <= Date.now()) ?? null;
  const bannerVersions = pending.filter((version) => !dismissedIds.includes(version.policyVersionId));
  const acceptAllPending = async () => {
    for (const version of pending) await acceptMutation.mutateAsync(version);
  };
  return { isSignedIn, pending, blocking, acceptAllPending, bannerVersions, dismiss, accept: acceptMutation.mutateAsync, isAccepting: acceptMutation.isPending, acceptErrorMessage: acceptMutation.isError ? "We could not save that. Try again." : null };
}
