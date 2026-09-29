import { useQuery } from "@tanstack/react-query";

import { creatorsService } from "@/services/creators.service";
import { useAuthStore } from "@/store/auth.store";

export const CREATOR_STATUS_QUERY_KEY = "creator-status";

export function useCreatorStatus() {
  const signedInUserId = useAuthStore((state) => state.user?.id ?? null);
  const isSignedIn = useAuthStore((state) => state.status === "signedIn");
  const creatorStatus = useQuery({
    queryKey: [CREATOR_STATUS_QUERY_KEY, signedInUserId],
    queryFn: creatorsService.fetchMyCreatorStatus,
    enabled: isSignedIn,
    staleTime: 5 * 60_000,
  });
  return {
    creatorStatus,
    canGoLive: creatorStatus.data?.canGoLive ?? false,
    isApprovedCreator: creatorStatus.data?.status === "approved",
    isCreatorStatusLoading: creatorStatus.isPending,
  };
}

interface NavigationThatCanOpenCreatorProgram {
  readonly getState: () => { readonly routeNames: readonly string[] } | undefined;
  readonly navigate: (...args: never[]) => void;
}

export const CREATOR_PROGRAM_ROUTE_NAME = "CreatorProgram";

export function openCreatorProgramOrSettings(navigation: NavigationThatCanOpenCreatorProgram) {
  const availableRouteNames = navigation.getState()?.routeNames ?? [];
  const destinationRouteName = availableRouteNames.includes(CREATOR_PROGRAM_ROUTE_NAME) ? CREATOR_PROGRAM_ROUTE_NAME : "Settings";
  (navigation.navigate as unknown as (routeName: string) => void)(destinationRouteName);
}
