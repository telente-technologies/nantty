import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { liveService } from "@/services/live.service";
import { spacesService, type SpaceJoinGrant } from "@/services/spaces.service";

export interface UseSpacesScreenQueriesOptions {
  readonly spaceId: string | undefined;
  readonly creating: boolean;
  readonly routeSpaceId: string | undefined;
  readonly routeCreate: boolean;
  readonly isSignedIn: boolean;
  readonly signedInUserId: string | null;
  readonly panel: "manage" | null;
  readonly inviteQuery: string;
  readonly grant: SpaceJoinGrant | null;
  readonly setSpaceId: (spaceId: string | undefined) => void;
  readonly setCreating: (creating: boolean) => void;
  readonly setGrant: (grant: SpaceJoinGrant | null) => void;
  readonly setPanel: (panel: "manage" | null) => void;
  readonly setAnnouncementId: (id: string | null) => void;
}

export function useSpacesScreenQueries({
  spaceId,
  creating,
  routeSpaceId,
  routeCreate,
  isSignedIn,
  signedInUserId,
  panel,
  inviteQuery,
  grant,
  setSpaceId,
  setCreating,
  setGrant,
  setPanel,
  setAnnouncementId,
}: UseSpacesScreenQueriesOptions) {
  const listing = useQuery({
    queryKey: ["spaces"],
    queryFn: () => spacesService.list(),
    refetchInterval: 30000,
  });
  const invitations = useInfiniteQuery({
    queryKey: ["spaces", "invitations", signedInUserId],
    queryFn: ({ pageParam }) => spacesService.listInvitations(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: isSignedIn && !!signedInUserId && !spaceId && !creating,
    refetchInterval: 30000,
  });
  const detail = useQuery({
    queryKey: ["spaces", spaceId],
    queryFn: () => spacesService.detail(spaceId!),
    enabled: !!spaceId,
    refetchInterval: 10000,
  });
  const refetchDetail = detail.refetch;
  const space = detail.data;
  const inviteSearch = useQuery({
    queryKey: ["spaces", spaceId, "invite-search", inviteQuery.trim()],
    queryFn: () => liveService.fetchPeopleToShareLiveWith(inviteQuery.trim()),
    enabled: panel === "manage" && space?.visibility === "invite_only" && inviteQuery.trim().length >= 2,
  });

  useEffect(() => {
    setSpaceId(routeSpaceId);
    setCreating(routeCreate);
    setGrant(null);
    setPanel(null);
  }, [routeSpaceId, routeCreate, setCreating, setGrant, setPanel, setSpaceId]);
  useEffect(() => {
    setAnnouncementId(null);
    return () => {
      if (spaceId) void spacesService.leave(spaceId).catch(() => undefined);
    };
  }, [spaceId, setAnnouncementId]);
  useEffect(() => {
    if (!spaceId || !grant || space?.state !== "live") return undefined;
    let cancelled = false;
    const renew = async () => {
      try {
        const fresh = await spacesService.join(spaceId);
        if (!cancelled && (fresh.role !== grant.role || fresh.canPublish !== grant.canPublish)) {
          setGrant(fresh);
        }
      } catch {
        if (!cancelled) void refetchDetail();
      }
    };
    if (space.viewerRole && space.viewerRole !== grant.role) void renew();
    const timer = setInterval(() => { void renew(); }, 45000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [spaceId, space?.state, space?.viewerRole, grant, setGrant, refetchDetail]);

  return {
    listing,
    invitations,
    detail,
    inviteSearch,
    space,
    host: space?.viewerRole === "host",
    joined: !!(space?.viewerJoined || grant),
    roleCurrent: !space?.viewerRole || space.viewerRole === grant?.role,
  };
}
