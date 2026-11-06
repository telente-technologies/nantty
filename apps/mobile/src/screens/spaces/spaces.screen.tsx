import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft24Icon,
  Broadcast24Icon,
  CalendarDots24Icon,
  ChatCircle24Icon,
  Coin24Icon,
  FileLock24Icon,
  GearSix24Icon,
  Headset24Icon,
  Microphone24Icon,
  MicrophoneSlash24Icon,
  Plus24Icon,
  Share24Icon,
  SignOut24Icon,
  Users24Icon,
} from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/errorState";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { KeyboardAwareForm } from "@/components/ui/keyboardAwareForm";
import { Text } from "@/components/ui/text";
import { webAppLinks } from "@/config/webAppLinks.config";
import {
  openCreatorProgramOrSettings,
  useCreatorEntry,
} from "@/hooks/useCreatorStatus.hook";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { reportsService } from "@/services/reports.service";
import { liveService } from "@/services/live.service";
import { useShareToChat } from "@/components/chatSafety/shareToChat.hook";
import {
  spacesService,
  type SpaceVisibility,
  type SpaceSummary,
  type SpaceJoinGrant,
  type SpacePerson,
  type SpaceInviteRole,
  type SpaceInvitation,
} from "@/services/spaces.service";
import { useAuthStore } from "@/store/auth.store";
import { spaceInvitationRoleLabel } from "@/utils/spaceInvitation.util";
import { makeThemedStyles, useTheme } from "@/theme";
import { SpaceSchedulePicker } from "./spaceSchedulePicker";
import { SpaceCoinDonationSheet } from "./spaceCoinDonationSheet";
import { completeSpaceCreation, type SpaceCreationCheckpoint } from "@/utils/spaceCreation.util";
import { useSpaceAudioConnection } from "./useSpaceAudioConnection.hook";

export function SpacesScreen({ navigation, route }: MainScreenProps<"Spaces">) {
  const styles = useStyles();
  const { colors } = useTheme();
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
  const space = detail.data;
  const host = space?.viewerRole === "host";
  const inviteSearch = useQuery({
    queryKey: ["spaces", spaceId, "invite-search", inviteQuery.trim()],
    queryFn: () => liveService.fetchPeopleToShareLiveWith(inviteQuery.trim()),
    enabled: panel === "manage" && space?.visibility === "invite_only" && inviteQuery.trim().length >= 2,
  });
  const joined = !!(space?.viewerJoined || grant);
  const roleCurrent = !space?.viewerRole || space.viewerRole === grant?.role;
  const audio = useSpaceAudioConnection(
    spaceId ?? "",
    !!(grant && !grant.demo && space?.state === "live" && roleCurrent),
    grant,
  );
  useEffect(() => {
    setSpaceId(route.params?.spaceId);
    setCreating(route.params?.create === true);
    setGrant(null);
    setPanel(null);
  }, [route.params?.spaceId, route.params?.create]);
  useEffect(() => {
    setAnnouncementId(null);
    return () => {
      if (spaceId) void spacesService.leave(spaceId).catch(() => undefined);
    };
  }, [spaceId]);
  useEffect(() => {
    if (!spaceId || !grant || space?.state !== "live") return;
    let cancelled = false;
    const renew = async () => {
      try {
        const fresh = await spacesService.join(spaceId);
        if (
          !cancelled &&
          (fresh.role !== grant.role || fresh.canPublish !== grant.canPublish)
        )
          setGrant(fresh);
      } catch {
        if (!cancelled) void detail.refetch();
      }
    };
    if (space.viewerRole && space.viewerRole !== grant.role) void renew();
    const timer = setInterval(() => {
      void renew();
    }, 45000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [spaceId, space?.state, space?.viewerRole, grant]);
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
  const person = (person: SpacePerson) => (
    <View key={person.id} style={styles.stagePerson}>
      <View
        style={[styles.avatarRing, person.role === "host" && styles.hostRing]}
      >
        <Avatar uri={person.avatarUrl ?? undefined} size={64} />
      </View>
      <Text size={14} weight={600} numberOfLines={1}>
        {person.name || "Space host"}
      </Text>
      <Text size={12} color={colors.textMuted}>
        {person.role === "host"
          ? "Host"
          : person.muted
            ? "Speaker · muted"
            : "Speaker"}
      </Text>
    </View>
  );
  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
        >
          <ArrowLeft24Icon />
        </Pressable>
        <View accessibilityRole="header" accessibilityLabel="Spaces">
          <Headset24Icon size={22} color={colors.text} />
        </View>
        {space ? (
          space.visibility !== "invite_only" || host ? (
            <Pressable
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={space.visibility === "invite_only" ? "Share private Space in chat" : "Share Space"}
              onPress={() => {
                if (space.visibility === "invite_only") {
                  openSendInChat({ kind: "space", id: space.id });
                  return;
                }
                offerSendInChat(
                  { kind: "space", id: space.id },
                  () => { void Share.share({ message: webAppLinks.space(space.id) }).catch(() => undefined); },
                );
              }}
            >
              <Share24Icon />
            </Pressable>
          ) : <View style={styles.iconButton} />
        ) : (
          <Pressable
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Create a Space"
            onPress={() => setCreating(true)}
          >
            <Plus24Icon color={colors.text} />
          </Pressable>
        )}
      </View>
      <KeyboardAwareForm
        style={styles.scroll}
        contentContainerStyle={styles.content}
        safeAreaHandledByParent
      >
        {message ? (
          <Text accessibilityRole="alert" style={styles.notice}>
            {message}
          </Text>
        ) : null}
        {creating ? (
          <View style={styles.form}>
            <View style={styles.composerHeading}>
              <Broadcast24Icon color={colors.primary} />
              <Text size={24} weight={700}>Create a Space</Text>
            </View>
            <Text color={colors.textMuted}>
              Creators host. Everyone can listen. Make room for your next idea.
            </Text>
            {creator.route !== "CreatorDashboard" ? (
              <Button
                title={
                  creator.isLoading ? "Checking creator access…" : creator.label
                }
                disabled={creator.isLoading}
                onPress={() =>
                  openCreatorProgramOrSettings(navigation, creator.route)
                }
              />
            ) : (
              <>
                <Text weight={600}>What are you talking about?</Text>
                <TextInput
                  accessibilityLabel="Space title"
                  placeholder="Give your Space a title"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  maxLength={80}
                />
                <Text weight={600}>A little context (optional)</Text>
                <TextInput
                  accessibilityLabel="Space description"
                  multiline
                  placeholder="What can people look forward to?"
                  placeholderTextColor={colors.textSubtle}
                  style={[styles.input, styles.multiline]}
                  value={description}
                  onChangeText={setDescription}
                  maxLength={500}
                />
                <SpaceSchedulePicker
                  value={scheduledAt}
                  onChange={setScheduledAt}
                />
                <Text weight={600}>Who can join?</Text>
                <View style={styles.audienceChoices}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: audiencePolicy === "public" }}
                    onPress={() => setAudiencePolicy("public")}
                    style={[styles.audienceChoice, audiencePolicy === "public" && styles.audienceChoiceSelected]}
                  >
                    <Broadcast24Icon size={19} color={audiencePolicy === "public" ? colors.primary : colors.textMuted} />
                    <View style={styles.audienceCopy}>
                      <Text weight={600}>Public</Text>
                      <Text size={12} color={colors.textMuted}>Anyone can find and listen</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: audiencePolicy === "invite_only" }}
                    onPress={() => setAudiencePolicy("invite_only")}
                    style={[styles.audienceChoice, audiencePolicy === "invite_only" && styles.audienceChoiceSelected]}
                  >
                    <FileLock24Icon size={19} color={audiencePolicy === "invite_only" ? colors.primary : colors.textMuted} />
                    <View style={styles.audienceCopy}>
                      <Text weight={600}>Invite only</Text>
                      <Text size={12} color={colors.textMuted}>Only people you invite can listen</Text>
                    </View>
                  </Pressable>
                </View>
                <Text size={13} color={colors.textMuted}>
                  Audio only. Your camera stays off.
                </Text>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: coinDonationsEnabled }}
                  onPress={() => setCoinDonationsEnabled((enabled) => !enabled)}
                  style={styles.audienceChoice}
                >
                  <Coin24Icon size={19} color={coinDonationsEnabled ? colors.primary : colors.textMuted} />
                  <View style={styles.audienceCopy}>
                    <Text weight={600}>Allow coin support</Text>
                    <Text size={12} color={colors.textMuted}>Listeners can support you with coins. You can turn this off while the Space is live.</Text>
                  </View>
                  <Text weight={600}>{coinDonationsEnabled ? "On" : "Off"}</Text>
                </Pressable>
                <Button
                  title={pendingAnnouncementRetry ? "Retry" : scheduledAt ? "Schedule" : "Go live"}
                  accessibilityLabel={pendingAnnouncementRetry ? "Retry Space announcement" : scheduledAt ? "Schedule Space" : "Start Space"}
                  icon={pendingAnnouncementRetry ? <ChatCircle24Icon size={20} color={colors.onPrimary} /> : scheduledAt ? <CalendarDots24Icon size={20} color={colors.onPrimary} /> : <Broadcast24Icon size={20} color={colors.onPrimary} />}
                  disabled={busy || !title.trim()}
                  loading={busy}
                  onPress={create}
                />
              </>
            )}
          </View>
        ) : spaceId ? (
          <>
            {detail.isLoading ? (
              <Text accessibilityLiveRegion="polite">Opening Space…</Text>
            ) : null}
            {detail.isError ? (
              <ErrorState
                error={detail.error}
                compact
                message="Couldn't load this Space."
                onRetry={() => detail.refetch()}
                retrying={detail.isRefetching}
              />
            ) : null}
            {space ? (
              <>
                <View style={styles.statusRow}>
                  <Text size={12} weight={700} color={colors.primary}>
                    {space.state === "live"
                      ? "LIVE AUDIO"
                      : space.state.toUpperCase()}
                  </Text>
                  {host && ["live", "scheduled"].includes(space.state) ? (
                    <Button
                      title="Manage"
                      variant="subtle"
                      icon={<GearSix24Icon size={18} color={colors.text} />}
                      onPress={() => setPanel("manage")}
                    />
                  ) : null}
                </View>
                <Text size={28} weight={700} lineHeight={34}>
                  {space.title}
                </Text>
                {space.description ? (
                  <Text color={colors.textMuted}>{space.description}</Text>
                ) : null}
                {space.state === "scheduled" && space.scheduledAt ? (
                  <View style={styles.scheduleCard}>
                    <Text size={13} color={colors.textMuted}>
                      SAVE THE DATE
                    </Text>
                    <Text size={20} weight={600}>
                      {new Date(space.scheduledAt).toLocaleDateString(
                        undefined,
                        { weekday: "long", month: "long", day: "numeric" },
                      )}
                    </Text>
                    <Text color={colors.primary} weight={600}>
                      {new Date(space.scheduledAt).toLocaleTimeString(
                        undefined,
                        { hour: "numeric", minute: "2-digit" },
                      )}{" "}
                      · your local time
                    </Text>
                  </View>
                ) : null}
                <View style={styles.stage}>
                  <View style={styles.stageHeading}>
                    <Text weight={600}>On stage</Text>
                    <View style={styles.listenerCount}>
                      <Users24Icon size={16} color={colors.textMuted} />
                      <Text size={12} color={colors.textMuted}>{space.listenerCount}</Text>
                    </View>
                  </View>
                  <View style={styles.stageGrid}>
                    {person(space.host)}
                    {space.speakers
                      .filter((item) => item.id !== space.host.id)
                      .map(person)}
                  </View>
                  <Text
                    size={12}
                    color={colors.textMuted}
                    style={styles.audioStatus}
                  >
                    {grant?.demo
                      ? "Preview room · no live audio"
                      : audio.status === "connected"
                        ? "You're connected"
                        : audio.status === "connecting" ||
                            audio.status === "reconnecting"
                          ? "Connecting to audio…"
                          : "Audio only · settle in and listen"}
                  </Text>
                </View>
                {audio.error ? (
                  <Text accessibilityRole="alert" color={colors.error}>
                    {audio.error}
                  </Text>
                ) : null}
                {["failed", "unavailable"].includes(audio.status) ? (
                  <Button
                    title="Reconnect audio"
                    variant="outline"
                      icon={<Headset24Icon size={18} color={colors.text} />}
                    onPress={audio.retry}
                  />
                ) : null}
                <View style={styles.conversationCard}>
                  <Text weight={600}>{space.visibility === "invite_only" ? "Share this invitation" : "Keep the conversation going"}</Text>
                  <Text size={13} color={colors.textMuted}>
                    {space.visibility === "invite_only" ? "Only invited people can preview and open this Space." : "Questions and replies stay together on the announcement post."}
                  </Text>
                  {space.announcementPostId || announcementId ? (
                    <Button
                      title="Open announcement and comments"
                      variant="outline"
                      icon={<ChatCircle24Icon size={18} color={colors.text} />}
                      onPress={() =>
                        navigation.navigate("PostDetail", {
                          postId: (space.announcementPostId || announcementId)!,
                        })
                      }
                    />
                  ) : host && space.visibility !== "invite_only" ? (
                    <Button
                      title="Post announcement"
                      variant="outline"
                      icon={<ChatCircle24Icon size={18} color={colors.text} />}
                      disabled={busy}
                      onPress={announce}
                    />
                  ) : host ? (
                    <Button
                      title="Share invite in chat"
                      variant="outline"
                      icon={<Share24Icon size={18} color={colors.text} />}
                      onPress={() => openSendInChat({ kind: "space", id: space.id })}
                    />
                  ) : (
                    <Text size={12} color={colors.textMuted}>
                      {space.visibility === "invite_only" ? "This Space is invite only." : "Look for the host’s announcement in your feed."}
                    </Text>
                  )}
                </View>
                {space.state === "live" && joined && !host ? (
                  <View style={styles.roomLinks}>
                    <Button
                      title="Report Space"
                      variant="subtle"
                      onPress={() =>
                        Alert.alert(
                          "Report this Space?",
                          "Send this Space to Nantty for review.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Report",
                              onPress: () => {
                                void act(
                                  () =>
                                    reportsService.submitReportForContent({
                                      targetType: "space",
                                      targetId: space.id,
                                      reason: "other",
                                      details: "Reported from Spaces.",
                                    }),
                                  "Report sent for review.",
                                );
                              },
                            },
                          ],
                        )
                      }
                    />
                  </View>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <>
            {isSignedIn ? (
              <View style={styles.listSection}>
                <Text size={18} weight={700}>Your invitations</Text>
                {invitations.isLoading ? <Text accessibilityLiveRegion="polite">Loading invitations…</Text> : null}
                {invitations.isError ? (
                  <View>
                    <Text accessibilityRole="alert" color={colors.error}>{invitations.error instanceof Error ? invitations.error.message : "Couldn't load your invitations."}</Text>
                    <Button title="Retry invitations" variant="subtle" onPress={() => { void invitations.refetch(); }} loading={invitations.isRefetching} />
                  </View>
                ) : null}
                {invitationActionError ? <Text accessibilityRole="alert" color={colors.error}>{invitationActionError}</Text> : null}
                {!invitations.isLoading && !invitations.isError && (invitations.data?.pages.flatMap((page) => page.data).length ?? 0) === 0 ? (
                  <Text color={colors.textMuted}>No pending Space invitations.</Text>
                ) : null}
                {invitations.data?.pages.flatMap((page) => page.data).map((invitation) => {
                  const pending = invitationActionId === invitation.invitationId;
                  const inviter = invitation.space.host.name || (invitation.space.host.username ? `@${invitation.space.host.username}` : "A Nantty member");
                  const invitationRole = spaceInvitationRoleLabel(invitation.role);
                  const invitedDate = Number.isNaN(Date.parse(invitation.invitedAt))
                    ? null
                    : new Date(invitation.invitedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
                  return (
                    <View key={`${invitation.spaceId}:${invitation.invitationId}`} style={styles.invitationCard}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open invited Space ${invitation.space.title}`}
                        onPress={() => open(invitation.space)}
                      >
                        <View style={styles.cardTop}>
                          <Avatar uri={invitation.space.host.avatarUrl ?? undefined} size={42} />
                          <View style={styles.cardCopy}>
                            <Text size={13} weight={600}>Invited by {inviter}</Text>
                            <Text size={12} color={colors.textMuted}>{invitationRole}{invitation.title ? ` · ${invitation.title}` : ""}</Text>
                          </View>
                        </View>
                        <Text size={17} weight={700}>{invitation.space.title}</Text>
                        {invitation.space.description ? <Text size={13} color={colors.textMuted} numberOfLines={2}>{invitation.space.description}</Text> : null}
                        <Text size={12} color={colors.primary}>Open Space details</Text>
                        {invitedDate ? <Text size={11} color={colors.textMuted}>Invited {invitedDate}</Text> : null}
                      </Pressable>
                      <View style={styles.invitationActions}>
                        <Button title={pending ? "Accepting…" : "Accept"} height={40} disabled={!!invitationActionId} loading={pending} onPress={() => { void respondToInvitation(invitation, true); }} style={styles.invitationAction} />
                        <Button title={pending ? "Please wait" : "Decline"} variant="subtle" height={40} disabled={!!invitationActionId} onPress={() => { void respondToInvitation(invitation, false); }} style={styles.invitationAction} />
                      </View>
                    </View>
                  );
                })}
                {invitations.hasNextPage ? (
                  <Button title="Load more invitations" variant="subtle" disabled={invitations.isFetchingNextPage} loading={invitations.isFetchingNextPage} onPress={() => { void invitations.fetchNextPage(); }} />
                ) : null}
              </View>
            ) : null}
            <Text size={13} weight={600} color={colors.textMuted}>LIVE AUDIO · PUBLIC CONVERSATIONS</Text>
            {listing.isLoading ? <Text>Finding Spaces…</Text> : null}
            {listing.isError ? (
              <ErrorState
                error={listing.error}
                compact
                onRetry={() => listing.refetch()}
                retrying={listing.isRefetching}
              />
            ) : null}
            {listing.data?.data.length === 0 ? (
              <View style={styles.empty}>
                <Text size={20} weight={600}>
                  A little quiet for now
                </Text>
                <Text color={colors.textMuted}>
                  Start a conversation or check back soon.
                </Text>
              </View>
            ) : null}
            {(["live", "scheduled"] as const).map((state) => (
              <View key={state} style={styles.listSection}>
                <Text size={18} weight={700}>
                  {state === "live" ? "Live now" : "Coming up"}
                </Text>
                {listing.data?.data
                  .filter((item) => item.state === state)
                  .map((item) => (
                    <Pressable
                      key={item.id}
                      style={styles.discoveryCard}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.title}, ${state === "live" ? "join live Space" : "view scheduled Space"}`}
                      onPress={() => open(item)}
                    >
                      <View style={styles.cardTop}>
                        <Avatar
                          uri={item.host.avatarUrl ?? undefined}
                          size={42}
                        />
                        <View style={styles.cardCopy}>
                          <Text size={13} weight={600}>
                            {item.host.name}
                          </Text>
                          <Text size={12} color={colors.textMuted}>
                            {state === "live"
                              ? `${item.listenerCount} listening`
                              : item.scheduledAt
                                ? new Date(item.scheduledAt).toLocaleString(
                                    undefined,
                                    {
                                      month: "short",
                                      day: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                    },
                                  )
                                : "Scheduled"}
                          </Text>
                        </View>
                        <View style={[styles.statePill, state === "live" && styles.livePill]}>
                          {state === "live" ? <Broadcast24Icon size={15} color={colors.error} /> : <CalendarDots24Icon size={15} color={colors.textMuted} />}
                          <Text size={11} weight={700} color={state === "live" ? colors.error : colors.textMuted}>{state === "live" ? "LIVE" : "SCHEDULED"}</Text>
                        </View>
                      </View>
                      <Text size={18} weight={700}>
                        {item.title}
                      </Text>
                      {item.description ? <Text size={14} color={colors.textMuted} numberOfLines={2}>{item.description}</Text> : null}
                      <View style={styles.discoveryFooter}>
                        <View style={styles.listenerCount}>
                          {state === "live" ? <Headset24Icon size={17} color={colors.textMuted} /> : <CalendarDots24Icon size={17} color={colors.textMuted} />}
                          <Text size={12} color={colors.textMuted}>{state === "live" ? `${item.listenerCount} listening` : item.scheduledAt ? new Date(item.scheduledAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Scheduled"}</Text>
                        </View>
                        <View style={styles.joinIcon} accessibilityElementsHidden>
                          {state === "live" ? <Headset24Icon color={colors.onPrimary} /> : <CalendarDots24Icon color={colors.onPrimary} />}
                        </View>
                      </View>
                    </Pressable>
                  ))}
              </View>
            ))}
          </>
        )}
      </KeyboardAwareForm>
      {space ? (
        <View style={styles.bottomBar}>
          <View style={styles.bottomInner}>
            {space.state === "live" ? (
              <>
                {!grant ? (
                  <Button
                    title={host ? "Connect" : "Join"}
                    accessibilityLabel={host ? "Connect host audio" : "Join as listener"}
                    icon={<Headset24Icon size={20} color={colors.onPrimary} />}
                    disabled={busy}
                    loading={busy}
                    onPress={join}
                    style={styles.control}
                  />
                ) : (
                  <>
                    {audio.canPublish ? (
                      <Button
                        title={audio.isMuted ? "Unmute" : "Mute"}
                        accessibilityLabel={audio.isMuted ? "Unmute microphone" : "Mute microphone"}
                        icon={audio.isMuted ? <Microphone24Icon size={20} color={colors.onPrimary} /> : <MicrophoneSlash24Icon size={20} color={colors.onPrimary} />}
                        disabled={audio.status !== "connected"}
                        onPress={() => {
                          void audio.toggleMicrophone();
                        }}
                        style={styles.control}
                      />
                    ) : (
                      <Button
                        title={
                          space.speakerRequestState === "pending"
                            ? "Requested"
                            : "Ask to speak"
                        }
                        variant="outline"
                        icon={<Microphone24Icon size={18} color={colors.text} />}
                        disabled={
                          busy ||
                          space.speakerRequestState === "pending" ||
                          grant.demo
                        }
                        onPress={() =>
                          act(
                            () => spacesService.requestToSpeak(space.id),
                            "Your request was sent to the host.",
                          )
                        }
                        style={styles.control}
                      />
                    )}
                    {!host && space.giftsEnabled ? (
                      <Button
                        title="Support host"
                        accessibilityLabel={`Donate coins to ${space.host.name}`}
                        variant="outline"
                        icon={<Coin24Icon size={18} color={colors.text} />}
                        onPress={() => setGiftPickerOpen(true)}
                        style={styles.control}
                      />
                    ) : null}
                    <Button
                      title={host ? "End" : "Leave"}
                      accessibilityLabel={host ? "End Space" : "Leave Space"}
                      variant={host ? "danger" : "outline"}
                      icon={host ? <Broadcast24Icon size={18} color={colors.error} /> : <SignOut24Icon size={18} color={colors.text} />}
                      disabled={busy}
                      onPress={host ? end : leave}
                      style={styles.exitControl}
                    />
                  </>
                )}
              </>
            ) : space.state === "scheduled" && host ? (
              <Button
                title="Start now"
                icon={<Broadcast24Icon size={20} color={colors.onPrimary} />}
                disabled={busy}
                onPress={() =>
                  act(async () => {
                    await spacesService.start(space.id);
                    setGrant(await spacesService.join(space.id));
                  })
                }
                style={styles.control}
              />
            ) : (
              <Text color={colors.textMuted}>
                {space.state === "scheduled"
                  ? "Come back when the conversation starts."
                  : "This Space is closed."}
              </Text>
            )}
          </View>
        </View>
      ) : null}
      {space && giftPickerOpen ? (
        <SpaceCoinDonationSheet
          spaceId={space.id}
          host={space.host}
          visible={giftPickerOpen}
          onClose={() => setGiftPickerOpen(false)}
        />
      ) : null}
      <BottomSheet
        visible={panel !== null}
        onClose={() => setPanel(null)}
        title="Manage Space"
        scrollable
        style={styles.manageSheet}
      >
            <View style={styles.panelBody}>
              {space && host ? (
                <>
                  {space.visibility === "invite_only" ? (
                    <>
                      <Text weight={700}>Invite listeners</Text>
                      <TextInput
                        accessibilityLabel="Search people to invite"
                        placeholder="Search by name or username"
                        placeholderTextColor={colors.textSubtle}
                        style={styles.input}
                        value={inviteQuery}
                        onChangeText={setInviteQuery}
                        autoCapitalize="none"
                      />
                      <Text weight={600}>Invite as</Text>
                      <View style={styles.manageRow} accessibilityRole="radiogroup" accessibilityLabel="Invitation role">
                        {([
                          ["listener", "Listener"],
                          ["speaker", "Speaker"],
                          ["cohost", "Co-host"],
                        ] as const).map(([role, label]) => (
                          <Pressable
                            key={role}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: inviteRole === role }}
                            onPress={() => setInviteRole(role)}
                            style={[styles.inviteRole, inviteRole === role && styles.inviteRoleSelected]}
                          >
                            <Text weight={inviteRole === role ? 700 : 500}>{label}</Text>
                          </Pressable>
                        ))}
                      </View>
                      {inviteRole !== "listener" ? (
                        <TextInput
                          accessibilityLabel="Optional stage title"
                          placeholder="Optional stage title"
                          placeholderTextColor={colors.textSubtle}
                          style={styles.input}
                          value={inviteTitle}
                          onChangeText={(value) => setInviteTitle(value.slice(0, 60))}
                          maxLength={60}
                        />
                      ) : null}
                      {inviteSearch.isLoading ? <Text color={colors.textMuted}>Searching…</Text> : null}
                      {inviteSearch.isError ? <Button title="Retry search" variant="subtle" onPress={() => { void inviteSearch.refetch(); }} /> : null}
                      {inviteSearch.data?.map((person) => (
                        <View style={styles.inviteRow} key={person.id}>
                          <Avatar uri={person.avatarUrl ?? undefined} size={38} />
                          <View style={styles.cardCopy}>
                            <Text weight={600} numberOfLines={1}>{person.name}</Text>
                            <Text size={12} color={colors.textMuted} numberOfLines={1}>@{person.username}</Text>
                          </View>
                          <Button
                            title="Invite"
                            variant="outline"
                            icon={<Users24Icon size={16} color={colors.text} />}
                            disabled={busy}
                            onPress={() => act(() => spacesService.invite(space.id, person.id, inviteRole, inviteRole === "listener" ? undefined : inviteTitle), `Invited @${person.username} as ${inviteRole === "cohost" ? "co-host" : inviteRole}.`)}
                          />
                        </View>
                      ))}
                      <Button
                        title="Share invite in chat"
                        variant="outline"
                        icon={<Share24Icon size={18} color={colors.text} />}
                        onPress={() => openSendInChat({ kind: "space", id: space.id })}
                      />
                    </>
                  ) : null}
                  {!space.announcementPostId && space.visibility !== "invite_only" ? (
                    <Button
                      title="Post announcement"
                      variant="outline"
                      disabled={busy}
                      onPress={announce}
                    />
                  ) : null}
                  <Pressable
                    accessibilityRole="switch"
                    accessibilityState={{ checked: space.giftsEnabled }}
                    disabled={busy}
                    onPress={() => act(() => spacesService.setCoinDonations(space.id, !space.giftsEnabled), !space.giftsEnabled ? "Coin support is on." : "Coin support is off.")}
                    style={styles.audienceChoice}
                  >
                    <Coin24Icon size={19} color={space.giftsEnabled ? colors.primary : colors.textMuted} />
                    <View style={styles.audienceCopy}>
                      <Text weight={600}>Allow coin support</Text>
                      <Text size={12} color={colors.textMuted}>Listeners can support the host with coins.</Text>
                    </View>
                    <Text weight={600}>{space.giftsEnabled ? "On" : "Off"}</Text>
                  </Pressable>
                  <Text weight={700}>Microphone requests</Text>
                  {space.pendingSpeakerRequests?.length ? (
                    space.pendingSpeakerRequests.map((request) => (
                      <View key={request.id} style={styles.manageRow}>
                        <Text style={styles.cardCopy}>{request.user.name}</Text>
                        <Button
                          title="Approve"
                          variant="outline"
                          disabled={busy}
                          onPress={() =>
                            act(() =>
                              spacesService.approveSpeakerRequest(
                                space.id,
                                request.id,
                              ),
                            )
                          }
                        />
                        <Button
                          title="Decline"
                          variant="subtle"
                          disabled={busy}
                          onPress={() =>
                            act(() =>
                              spacesService.declineSpeakerRequest(
                                space.id,
                                request.id,
                              ),
                            )
                          }
                        />
                      </View>
                    ))
                  ) : (
                    <Text color={colors.textMuted}>No requests yet.</Text>
                  )}
                  {space.speakers.map((speaker) => (
                    <View key={speaker.id} style={styles.manageSpeaker}>
                      <Text weight={600}>{speaker.name}</Text>
                      <View style={styles.roomLinks}>
                        <Button
                          title="Mute"
                          variant="outline"
                          disabled={busy}
                          onPress={() =>
                            act(() =>
                              spacesService.muteSpeaker(space.id, speaker.id),
                            )
                          }
                        />
                        <Button
                          title="Move to listeners"
                          variant="outline"
                          disabled={busy}
                          onPress={() =>
                            act(() =>
                              spacesService.demoteSpeaker(space.id, speaker.id),
                            )
                          }
                        />
                        <Button
                          title="Remove"
                          variant="subtle"
                          disabled={busy}
                          onPress={() =>
                            act(() =>
                              spacesService.removeSpeaker(space.id, speaker.id),
                            )
                          }
                        />
                      </View>
                    </View>
                  ))}
                  <Button
                    title={
                      space.state === "live" ? "End Space" : "Cancel Space"
                    }
                    variant="danger"
                    disabled={busy}
                    onPress={end}
                  />
                </>
              ) : null}
            </View>
      </BottomSheet>
      {sendInChatElement}
    </View>
  );
}
const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      width: "100%",
      maxWidth: 800,
      alignSelf: "center",
      height: 56,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    iconButton: {
      width: 44,
      height: 44,
      justifyContent: "center",
      alignItems: "center",
    },
    scroll: { flex: 1 },
    content: {
      padding: 20,
      paddingBottom: 32,
      gap: 18,
      width: "100%",
      maxWidth: 760,
      alignSelf: "center",
    },
    form: { gap: 16 },
    audienceChoices: { gap: 9 },
    audienceChoice: { minHeight: 64, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.divider, borderRadius: 14, backgroundColor: colors.surface },
    audienceChoiceSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
    audienceCopy: { flex: 1, gap: 3 },
    composerHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
    input: {
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surface,
      minHeight: 52,
    },
    multiline: { minHeight: 100, textAlignVertical: "top" },
    notice: {
      borderLeftWidth: 3,
      borderColor: colors.primary,
      padding: 12,
      backgroundColor: colors.primaryTint,
    },
    statusRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      minHeight: 44,
    },
    stage: {
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 22,
      backgroundColor: colors.surface,
      padding: 18,
      gap: 20,
    },
    stageHeading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    listenerCount: { flexDirection: "row", alignItems: "center", gap: 6 },
    stageGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-start",
      rowGap: 24,
    },
    stagePerson: {
      width: "33.333%",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 4,
    },
    avatarRing: {
      padding: 4,
      borderWidth: 2,
      borderColor: colors.divider,
      borderRadius: 44,
    },
    hostRing: { borderColor: colors.primary },
    audioStatus: { textAlign: "center" },
    scheduleCard: {
      padding: 20,
      borderRadius: 18,
      backgroundColor: colors.primaryTint,
      gap: 8,
    },
    conversationCard: { gap: 12, paddingVertical: 8 },
    roomLinks: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    bottomBar: {
      borderTopWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    bottomInner: {
      width: "100%",
      maxWidth: 720,
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 48,
    },
    control: { flex: 1 },
    exitControl: { minWidth: 80 },
    listSection: { gap: 0, marginTop: 8 },
    invitationCard: {
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 18,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 12,
      marginTop: 10,
    },
    invitationActions: { flexDirection: "row", gap: 10 },
    invitationAction: { flex: 1 },
    discoveryCard: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.divider,
      paddingVertical: 16,
      gap: 12,
    },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    statePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, minHeight: 30, borderRadius: 15, backgroundColor: colors.chip },
    livePill: { backgroundColor: colors.surface },
    discoveryFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
    joinIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: colors.primarySolid },
    cardCopy: { flex: 1, gap: 4 },
    empty: { paddingVertical: 36, gap: 8 },
    manageSheet: { width: "100%", maxWidth: 640, alignSelf: "center" },
    panelBody: { gap: 18, paddingHorizontal: 16, paddingBottom: 20 },
    inviteRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 54 },
    inviteRole: { minHeight: 38, justifyContent: "center", paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.divider },
    inviteRoleSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
    manageRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
    },
    manageSpeaker: { gap: 10 },
  }),
);
