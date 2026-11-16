import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Alert, Share, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { webAppLinks } from "@/config/webAppLinks.config";
import {
  openCreatorProgramOrSettings,
  useCreatorEntry,
} from "@/hooks/useCreatorStatus.hook";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { reportsService } from "@/services/moderation/reports.service";
import { useShareToChat } from "@/components/chatSafety/shareToChat.hook";
import {
  spacesService,
  type SpaceVisibility,
  type SpaceSummary,
  type SpaceJoinGrant,
  type SpaceInviteRole,
  type SpaceInvitation,
} from "@/services/spaces.service";
import { useAuthStore } from "@/store/auth.store";
import { SpaceCoinDonationSheet } from "./spaceCoinDonationSheet";
import { completeSpaceCreation, type SpaceCreationCheckpoint } from "@/utils/spaceCreation.util";
import { useSpaceAudioConnection } from "./useSpaceAudioConnection.hook";
import { useSpacesStyles } from "./spaces.styles";
import { SpaceRoomControls } from "./spaceRoomControls";
import { SpaceManageSheet } from "./spaceManageSheet";
import { SpacesScreenBody } from "./spacesScreenBody";
import { SpacesScreenHeader } from "./spacesScreenHeader";
import { useSpacesScreenQueries } from "./useSpacesScreenQueries.hook";
import { useSpaceManageActions } from "./useSpaceManageActions.hook";

export function SpacesScreen({ navigation, route }: MainScreenProps<"Spaces">) {
  const styles = useSpacesStyles();
  const insets = useSafeAreaInsets();
  const creator = useCreatorEntry();
  const client = useQueryClient();
  const isSignedIn = useAuthStore((state) => state.status === "signedIn");
  const signedInUserId = useAuthStore((state) => state.user?.id ?? null);
  const { offerSendInChat, openSendInChat, sendInChatElement } = useShareToChat();
  const [spaceId, setSpaceId] = useState(route.params?.spaceId);
  const [creating, setCreating] = useState(route.params?.create === true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [audiencePolicy, setAudiencePolicy] = useState<SpaceVisibility>("public");
  const [coinDonationsEnabled, setCoinDonationsEnabled] = useState(true);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteRole, setInviteRole] = useState<SpaceInviteRole>("listener");
  const [inviteTitle, setInviteTitle] = useState("");
  const [pendingAnnouncementRetry, setPendingAnnouncementRetry] = useState(false);
  const [busy, setBusy] = useState(false);
  const [invitationActionId, setInvitationActionId] = useState<string | null>(null);
  const [invitationActionError, setInvitationActionError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [grant, setGrant] = useState<SpaceJoinGrant | null>(null);
  const [panel, setPanel] = useState<"manage" | null>(null);
  const [giftPickerOpen, setGiftPickerOpen] = useState(false);
  const [announcementId, setAnnouncementId] = useState<string | null>(null);
  const creation = useRef<SpaceCreationCheckpoint<SpaceSummary>>({key:generateIdempotencyKey()});
  const {
    listing,
    invitations,
    detail,
    inviteSearch,
    space,
    host,
    joined,
  } = useSpacesScreenQueries({
    spaceId,
    creating,
    routeSpaceId: route.params?.spaceId,
    routeCreate: route.params?.create === true,
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
  });
  const roleCurrent = !space?.viewerRole || space.viewerRole === grant?.role;
  const audio = useSpaceAudioConnection(
    spaceId ?? "",
    !!(grant && !grant.demo && space?.state === "live" && roleCurrent),
    grant,
  );
  const act = async (fn: () => Promise<unknown>, success = "") => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await fn();
      setMessage(success);
      await client.invalidateQueries({ queryKey: ["spaces"] });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Couldn't complete this action. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const open = (item: SpaceSummary) => {
    setGrant(null);
    setMessage("");
    setSpaceId(item.id);
  };
  const respondToInvitation = async (invitation: SpaceInvitation, accept: boolean) => {
    if (!isSignedIn || !signedInUserId || invitationActionId) return;
    setInvitationActionId(invitation.invitationId);
    setInvitationActionError(null);
    try {
      if (accept) await spacesService.acceptInvitation(invitation.spaceId, invitation.invitationId);
      else await spacesService.declineInvitation(invitation.spaceId, invitation.invitationId);
      await client.invalidateQueries({ queryKey: ["spaces", "invitations", signedInUserId] });
      if (accept) open(invitation.space);
    } catch (error) {
      setInvitationActionError(error instanceof Error ? error.message : "Couldn't respond to this invitation. Try again.");
    } finally {
      setInvitationActionId(null);
    }
  };
  const join = () =>
    act(async () => setGrant(await spacesService.join(spaceId!)));
  const leave = () =>
    act(async () => {
      await spacesService.leave(spaceId!);
      setGrant(null);
    }, "You left the Space.");
  const create = () =>
    act(async () => {
      if (!title.trim()) throw new Error("Add a title for your Space.");
      if (!creation.current.space && scheduledAt && new Date(scheduledAt).getTime() <= Date.now())
        throw new Error("Choose a future date and time.");
      const input = {
        title: title.trim(),
        description: description.trim() || undefined,
        audiencePolicy,
        giftsEnabled: coinDonationsEnabled,
        ...(scheduledAt ? { scheduledAt } : {}),
      };
      let created: SpaceSummary;
      try {
        if (audiencePolicy === "invite_only") {
          created = creation.current.space ?? await spacesService.create(input, creation.current.key);
          creation.current.space = created;
        } else {
          created = await completeSpaceCreation(
            creation.current,
            () => spacesService.create(input, creation.current.key),
            (item) => spacesService.announce(item.id, item.title, webAppLinks.space(item.id)),
            (item, postId) => spacesService.attachAnnouncement(item.id, postId),
          );
        }
      } catch (error) {
        if (creation.current.space && audiencePolicy !== "invite_only") {
          setPendingAnnouncementRetry(true);
          throw new Error("Your Space was created, but its announcement is not finished. Retry to continue.", { cause: error });
        }
        throw error;
      }
      await client.invalidateQueries({queryKey:["feed"]});
      creation.current={key:generateIdempotencyKey()};
      setPendingAnnouncementRetry(false);
      setCreating(false);
      setSpaceId(created.id);
      setTitle("");
      setDescription("");
      setScheduledAt("");
      setAudiencePolicy("public");
    });
  const announce = () =>
    act(async () => {
      if (!space) return;
      const postId =
        announcementId ??
        (
          await spacesService.announce(
            space.id,
            space.title,
            webAppLinks.space(space.id),
          )
        ).id;
      setAnnouncementId(postId);
      await spacesService.attachAnnouncement(space.id, postId);
      await client.invalidateQueries({ queryKey: ["feed"] });
    }, "Announcement posted. Your conversation continues in its comments.");
  const end = () =>
    Alert.alert(
      space?.state === "live" ? "End this Space?" : "Cancel this Space?",
      space?.state === "live"
        ? "This ends the conversation for everyone."
        : "People will no longer be able to join at the scheduled time.",
      [
        { text: "Keep Space", style: "cancel" },
        {
          text: space?.state === "live" ? "End Space" : "Cancel Space",
          style: "destructive",
          onPress: () => {
            void act(async () => {
              if (space?.state === "live") await spacesService.end(space.id);
              else await spacesService.cancel(spaceId!);
              setGrant(null);
              setPanel(null);
            });
          },
        },
      ],
    );
  const onBack = () => {
    if (spaceId || creating) {
      setGrant(null);
      setSpaceId(undefined);
      setCreating(false);
      setMessage("");
    } else navigation.goBack();
  };
  const manageActions = useSpaceManageActions({
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
  });
  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <SpacesScreenHeader
        styles={styles}
        space={space}
        host={!!host}
        onBack={onBack}
        onCreate={() => setCreating(true)}
        onShare={(item) => {
          if (item.visibility === "invite_only") {
            openSendInChat({ kind: "space", id: item.id });
            return;
          }
          offerSendInChat(
            { kind: "space", id: item.id },
            () => { void Share.share({ message: webAppLinks.space(item.id) }).catch(() => undefined); },
          );
        }}
      />
      <SpacesScreenBody
        styles={styles}
        message={message}
        creating={creating}
        hasSpaceId={!!spaceId}
        creationProps={{
          creatorAccess: {
            allowed: creator.route === "CreatorDashboard",
            loading: creator.isLoading,
            label: creator.label,
          },
          title,
          onTitleChange: setTitle,
          description,
          onDescriptionChange: setDescription,
          scheduledAt,
          onScheduledAtChange: setScheduledAt,
          audiencePolicy,
          onAudiencePolicyChange: setAudiencePolicy,
          coinDonationsEnabled,
          onCoinDonationsEnabledChange: setCoinDonationsEnabled,
          pendingAnnouncementRetry,
          busy,
          onCreatorAccess: () => openCreatorProgramOrSettings(navigation, creator.route),
          onCreate: create,
        }}
        roomProps={{
          space,
          loading: detail.isLoading,
          error: detail.isError ? detail.error : null,
          refetching: detail.isRefetching,
          host: !!host,
          joined,
          grant,
          audio,
          announcementId,
          busy,
          onRetry: () => { void detail.refetch(); },
          onManage: () => setPanel("manage"),
          onOpenAnnouncement: (postId) => navigation.navigate("PostDetail", { postId }),
          onAnnounce: announce,
          onShareInvite: () => { if (space) openSendInChat({ kind: "space", id: space.id }); },
          onReport: () => {
            if (!space) return;
            Alert.alert("Report this Space?", "Send this Space to Nantty for review.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Report",
                onPress: () => {
                  void act(
                    () => reportsService.submitReportForContent({
                      targetType: "space",
                      targetId: space.id,
                      reason: "other",
                      details: "Reported from Spaces.",
                    }),
                    "Report sent for review.",
                  );
                },
              },
            ]);
          },
        }}
        directoryProps={{
          isSignedIn,
          invitations: invitations.data?.pages.flatMap((page) => page.data) ?? [],
          invitationsLoading: invitations.isLoading,
          invitationsRefetching: invitations.isRefetching,
          invitationsError: invitations.isError
            ? invitations.error instanceof Error ? invitations.error.message : "Couldn't load your invitations."
            : null,
          invitationActionError,
          pendingInvitationId: invitationActionId,
          hasMoreInvitations: invitations.hasNextPage,
          loadingMoreInvitations: invitations.isFetchingNextPage,
          onOpenInvitation: open,
          onRespondToInvitation: (invitation, accept) => { void respondToInvitation(invitation, accept); },
          onRetryInvitations: () => { void invitations.refetch(); },
          onLoadMoreInvitations: () => { void invitations.fetchNextPage(); },
          spaces: listing.data?.data ?? [],
          spacesLoading: listing.isLoading,
          spacesError: listing.isError ? listing.error : null,
          spacesRefetching: listing.isRefetching,
          onRetrySpaces: () => { void listing.refetch(); },
          onOpenSpace: open,
        }}
      />
      {space ? (
        <SpaceRoomControls
          styles={styles}
          space={space}
          host={!!host}
          busy={busy}
          grant={grant}
          audio={audio}
          onJoin={join}
          onRequestToSpeak={() => act(
            () => spacesService.requestToSpeak(space.id),
            "Your request was sent to the host.",
          )}
          onDonate={() => setGiftPickerOpen(true)}
          onExit={host ? end : leave}
          onStart={() => act(async () => {
            await spacesService.start(space.id);
            setGrant(await spacesService.join(space.id));
          })}
        />
      ) : null}
      {space && giftPickerOpen ? (
        <SpaceCoinDonationSheet
          spaceId={space.id}
          host={space.host}
          visible={giftPickerOpen}
          onClose={() => setGiftPickerOpen(false)}
        />
      ) : null}
      <SpaceManageSheet
        styles={styles}
        visible={panel !== null}
        space={space}
        host={!!host}
        busy={busy}
        inviteQuery={inviteQuery}
        inviteRole={inviteRole}
        inviteTitle={inviteTitle}
        invitees={inviteSearch.data ?? []}
        searching={inviteSearch.isLoading}
        searchError={inviteSearch.isError}
        onRetrySearch={() => { void inviteSearch.refetch(); }}
        {...manageActions}
      />
      {sendInChatElement}
    </View>
  );
}
