import { useMemo } from "react";
import type { SpaceDetails, SpaceInviteRole } from "@/services/spaces.service";
import { spacesService } from "@/services/spaces.service";
import type { UserSummary } from "@/types";
import type { SpaceManageSheetProps } from "./spaceManageSheet";

type ManageActions = Pick<
  SpaceManageSheetProps,
  | "onClose"
  | "onQueryChange"
  | "onRoleChange"
  | "onTitleChange"
  | "onInvite"
  | "onShareInvite"
  | "onAnnounce"
  | "onToggleDonations"
  | "onApproveRequest"
  | "onDeclineRequest"
  | "onMuteSpeaker"
  | "onDemoteSpeaker"
  | "onRemoveSpeaker"
  | "onEnd"
>;

type ActionRunner = (operation: () => Promise<unknown>, success?: string) => Promise<void>;

interface UseSpaceManageActionsOptions {
  readonly space: SpaceDetails | undefined;
  readonly inviteRole: SpaceInviteRole;
  readonly inviteTitle: string;
  readonly setInviteQuery: (query: string) => void;
  readonly setInviteRole: (role: SpaceInviteRole) => void;
  readonly setInviteTitle: (title: string) => void;
  readonly act: ActionRunner;
  readonly openSendInChat: (item: { kind: "space"; id: string }) => void;
  readonly setPanel: (panel: "manage" | null) => void;
  readonly announce: () => Promise<void>;
  readonly end: () => void;
}

export function useSpaceManageActions({
  space,
  inviteRole,
  inviteTitle,
  setInviteQuery,
  setInviteRole,
  setInviteTitle,
  act,
  openSendInChat,
  setPanel,
  announce,
  end,
}: UseSpaceManageActionsOptions): ManageActions {
  return useMemo(() => ({
    onClose: () => setPanel(null),
    onQueryChange: setInviteQuery,
    onRoleChange: setInviteRole,
    onTitleChange: setInviteTitle,
    onInvite: (person: UserSummary) => {
      if (!space) return;
      void act(
        () => spacesService.invite(
          space.id,
          person.id,
          inviteRole,
          inviteRole === "listener" ? undefined : inviteTitle,
        ),
        `Invited @${person.username} as ${inviteRole === "cohost" ? "co-host" : inviteRole}.`,
      );
    },
    onShareInvite: () => {
      if (space) openSendInChat({ kind: "space", id: space.id });
    },
    onAnnounce: announce,
    onToggleDonations: () => {
      if (!space) return;
      void act(
        () => spacesService.setCoinDonations(space.id, !space.giftsEnabled),
        !space.giftsEnabled ? "Coin support is on." : "Coin support is off.",
      );
    },
    onApproveRequest: (requestId: string) => {
      if (space) void act(() => spacesService.approveSpeakerRequest(space.id, requestId));
    },
    onDeclineRequest: (requestId: string) => {
      if (space) void act(() => spacesService.declineSpeakerRequest(space.id, requestId));
    },
    onMuteSpeaker: (userId: string) => {
      if (space) void act(() => spacesService.muteSpeaker(space.id, userId));
    },
    onDemoteSpeaker: (userId: string) => {
      if (space) void act(() => spacesService.demoteSpeaker(space.id, userId));
    },
    onRemoveSpeaker: (userId: string) => {
      if (space) void act(() => spacesService.removeSpeaker(space.id, userId));
    },
    onEnd: end,
  }), [space, inviteRole, inviteTitle, setInviteQuery, setInviteRole, setInviteTitle, act, openSendInChat, setPanel, announce, end]);
}
