import { useQuery } from "@tanstack/react-query";

import { useCreatorApplicationQuery } from "@/components/creator/creatorQueries.hook";
import { creatorsService } from "@/services/creators/creators.service";
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

export type CreatorEntryRoute = "CreatorDashboard" | "CreatorApplicationStatus" | "CreatorProgram";

export function useCreatorEntry() {
  const { creatorStatus, isCreatorStatusLoading } = useCreatorStatus();
  const application = useCreatorApplicationQuery();
  const personalAccountStatus = creatorStatus.data?.status ?? "none";
  const applicationStatus = application.data?.status ?? null;
  const effectiveStatus = personalAccountStatus === "none" ? applicationStatus ?? "none" : personalAccountStatus;
  const route: CreatorEntryRoute =
    effectiveStatus === "approved"
      ? "CreatorDashboard"
      : effectiveStatus === "pending" || effectiveStatus === "rejected"
        ? "CreatorApplicationStatus"
        : "CreatorProgram";
  const label = route === "CreatorDashboard" ? "Creator tools" : route === "CreatorApplicationStatus" ? "Creator application status" : "Switch to creator account";
  return { route, label, isLoading: isCreatorStatusLoading || application.isPending };
}

interface NavigationThatCanOpenCreatorProgram {
  readonly getState: () => { readonly routeNames: readonly string[] } | undefined;
  readonly navigate: (...args: never[]) => void;
}

export const CREATOR_PROGRAM_ROUTE_NAME = "CreatorProgram";

export function openCreatorProgramOrSettings(navigation: NavigationThatCanOpenCreatorProgram, destination: CreatorEntryRoute = CREATOR_PROGRAM_ROUTE_NAME) {
  const availableRouteNames = navigation.getState()?.routeNames ?? [];
  const destinationRouteName = availableRouteNames.includes(destination)
    ? destination
    : availableRouteNames.includes(CREATOR_PROGRAM_ROUTE_NAME)
      ? CREATOR_PROGRAM_ROUTE_NAME
      : "Settings";
  (navigation.navigate as unknown as (routeName: string) => void)(destinationRouteName);
}
