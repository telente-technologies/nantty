import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { legalService } from "@/services/account/legal.service";
import { useAuthStore } from "@/store/auth.store";
import { usePolicyUpdateStore } from "@/store/policyUpdate.store";
import type { PolicyVersionSummary } from "@/types";

const ACCEPTANCES_QUERY_KEY = ["legal", "acceptances"] as const;
const BANNER_DOCUMENT_KEYS: readonly string[] = ["terms", "privacy"];

export function usePolicyUpdates() {
  const isSignedIn = useAuthStore((state) => state.status === "signedIn");
  const queryClient = useQueryClient();
  const dismissedIds = usePolicyUpdateStore((state) => state.dismissedPolicyVersionIds);
  const versions = useQuery({ queryKey: ["legal", "current"], queryFn: legalService.fetchCurrentPolicyVersions, enabled: isSignedIn, retry: false, staleTime: 60_000 });
  const acceptances = useQuery({ queryKey: ACCEPTANCES_QUERY_KEY, queryFn: legalService.fetchMyPolicyAcceptances, enabled: isSignedIn, retry: false, staleTime: 60_000 });
  const acceptMutation = useMutation({
    mutationFn: (version: PolicyVersionSummary) => legalService.acceptPolicyVersion(version),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACCEPTANCES_QUERY_KEY }),
  });
  const accepted = new Set(acceptances.data?.acceptedPolicyVersionIds ?? []);
  const pending = (versions.data?.items ?? []).filter((version) => BANNER_DOCUMENT_KEYS.includes(version.documentKey) && !accepted.has(version.policyVersionId));
  const acceptAllPending = async () => {
    for (const version of pending) await acceptMutation.mutateAsync(version);
  };
  return {
    isSignedIn,
    pending,
    acceptAllPending,
    blocking: pending.find((version) => version.isMaterialChange && Date.parse(version.effectiveAt) <= Date.now()) ?? null,
    bannerVersions: pending.filter((version) => !dismissedIds.includes(version.policyVersionId)),
    accept: acceptMutation.mutateAsync,
    isAccepting: acceptMutation.isPending,
    acceptErrorMessage: acceptMutation.isError ? "We couldn't save that. Try again." : null,
  };
}
