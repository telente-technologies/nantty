import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, TextInput, View } from "react-native";

import { ArrowLeft24Icon, Share24Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/errorState";
import { Text } from "@/components/ui/text";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { reportsService } from "@/services/reports.service";
import { spacesService, type SpaceDetails, type SpaceSummary, type CreateSpaceInput, type SpaceJoinGrant } from "@/services/spaces.service";
import { webAppLinks } from "@/config/webAppLinks.config";
import { openCreatorProgramOrSettings, useCreatorEntry } from "@/hooks/useCreatorStatus.hook";
import { useSpaceAudioConnection } from "./useSpaceAudioConnection.hook";
import { makeThemedStyles, useTheme } from "@/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SPACE_BLUE = "#2864D7";

export function SpacesScreen({ navigation, route }: MainScreenProps<"Spaces">) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const creatorEntry = useCreatorEntry();
  const canHostSpace = creatorEntry.route === "CreatorDashboard";
  const [spaceId, setSpaceId] = useState(route.params?.spaceId);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [audiencePolicy, setAudiencePolicy] = useState<CreateSpaceInput["audiencePolicy"]>("public");
  const [busy, setBusy] = useState(false);
  const [joinGrant, setJoinGrant] = useState<SpaceJoinGrant | null>(null);
  const [message, setMessage] = useState("");
  const listing = useQuery({ queryKey: ["spaces"], queryFn: () => spacesService.list() });
  const detail = useQuery({ queryKey: ["spaces", spaceId], queryFn: () => spacesService.detail(spaceId!), enabled: Boolean(spaceId) });
  const space = detail.data;
  const audio = useSpaceAudioConnection(spaceId ?? "", Boolean(spaceId && space?.state === "live" && joinGrant), joinGrant);
  const isHost = space?.viewerRole === "host";
  const canModerate = isHost || space?.viewerRole === "moderator";
  const isJoined = space?.viewerJoined || ["listener", "speaker", "host", "moderator"].includes(space?.viewerRole ?? "");

  useEffect(() => {
    setSpaceId(route.params?.spaceId);
    setJoinGrant(null);
  }, [route.params?.spaceId]);

  const refresh = async () => {
    await Promise.all([listing.refetch(), spaceId ? detail.refetch() : Promise.resolve()]);
  };

  const act = async (operation: () => Promise<unknown>, successMessage = "") => {
    setBusy(true);
    setMessage("");
    try {
      await operation();
      setMessage(successMessage);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That action couldn't be completed. Try again.");
    } finally { setBusy(false); }
  };

  const create = async () => {
    if (!title.trim()) { setMessage("Add a title for your Space."); return; }
    const schedule = scheduledAt.trim() ? new Date(scheduledAt.trim()) : null;
    if (scheduledAt.trim() && (!schedule || Number.isNaN(schedule.getTime()) || schedule.getTime() <= Date.now())) {
      setMessage("Enter a future date and time, including your timezone, such as 2026-11-02T18:30:00+01:00."); return;
    }
    setBusy(true);
    setMessage("");
    try {
      const created = await spacesService.create({ title: title.trim(), description: description.trim() || undefined, audiencePolicy, ...(schedule ? { scheduledAt: schedule.toISOString() } : {}) });
      setCreating(false);
      setTitle(""); setDescription(""); setScheduledAt("");
      setSpaceId(created.id);
      await listing.refetch();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Couldn't create this Space."); }
    finally { setBusy(false); }
  };

  const join = async (item: SpaceSummary) => {
    setBusy(true);
    setMessage("");
    try {
      const grant = await spacesService.join(item.id);
      setJoinGrant(grant);
      setSpaceId(item.id);
      await detail.refetch();
    }
    catch (error) { setMessage(error instanceof Error ? error.message : "Couldn't join this Space."); }
    finally { setBusy(false); }
  };

  const openRoom = async (item: SpaceSummary) => {
    if (spaceId !== item.id) setJoinGrant(null);
    setSpaceId(item.id);
    setMessage("");
  };

  const leaveSpace = async () => {
    if (!space) return;
    setBusy(true);
    setMessage("");
    try {
      await spacesService.leave(space.id);
      setJoinGrant(null);
      setMessage("You left the Space.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't leave this Space.");
    } finally { setBusy(false); }
  };

  const openHostFlow = () => {
    if (creatorEntry.isLoading) return;
    if (canHostSpace) setCreating(true);
    else openCreatorProgramOrSettings(navigation, creatorEntry.route);
  };

  const report = async (session: SpaceDetails) => {
    await act(() => reportsService.submitReportForContent({ targetType: "space", targetId: session.id, reason: "other", details: "Reported from Nantty Spaces." }), "Report sent to Nantty for review.");
  };

  const personRow = (person: SpaceDetails["host"], controls = false) => (
    <View key={person.id} style={styles.personRow}>
      <Avatar uri={person.avatarUrl ?? undefined} size={42} />
      <View style={styles.personCopy}><Text weight={600}>{person.name}</Text><Text size={12} color={colors.textMuted}>{person.role === "host" ? "Host" : person.role === "moderator" ? "Moderator" : "Speaker"}{person.muted ? " · muted" : ""}</Text></View>
      {controls && canModerate && person.role === "speaker" ? <View style={styles.moderation}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${person.muted ? "Unmute" : "Mute"} ${person.name}`} onPress={() => act(() => spacesService.muteSpeaker(space!.id, person.id))}><Text size={12} color={SPACE_BLUE}>Mute</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Move ${person.name} to listeners`} onPress={() => act(() => spacesService.demoteSpeaker(space!.id, person.id))}><Text size={12} color={SPACE_BLUE}>Audience</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${person.name}`} onPress={() => act(() => spacesService.removeSpeaker(space!.id, person.id))}><Text size={12} color={colors.error}>Remove</Text></Pressable>
      </View> : null}
    </View>
  );

  const actionButton = (label: string, onPress: () => void, variant: "primary" | "secondary" | "destructive" = "primary", disabled = busy) => <Button title={label} onPress={onPress} variant={variant === "destructive" ? "danger" : variant === "secondary" ? "outline" : "primary"} disabled={disabled} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" style={styles.back} onPress={() => spaceId || creating ? (setSpaceId(undefined), setCreating(false), setMessage("")) : navigation.goBack()}><ArrowLeft24Icon /></Pressable>
        <Text size={18} weight={700} accessibilityRole="header">Nantty Spaces</Text>
        {space ? <Pressable accessibilityRole="button" accessibilityLabel="Share this Space" style={styles.share} onPress={() => Share.share({ message: webAppLinks.space(space.id) }).catch(() => undefined)}><Share24Icon /></Pressable> : <View style={styles.share} />}
      </View>
      {message ? <Text accessibilityRole="alert" style={styles.notice}>{message}</Text> : null}

      {creating && canHostSpace ? <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text size={25} weight={700} accessibilityRole="header">Create a Space</Text>
        <Text color={colors.textMuted} style={styles.intro}>Start an audio conversation now or choose a time for people to join.</Text>
        <Text style={styles.label}>Title</Text><TextInput accessibilityLabel="Space title" maxLength={80} value={title} onChangeText={setTitle} placeholder="What are you talking about?" placeholderTextColor={colors.textSubtle} style={styles.input} />
        <Text style={styles.label}>Description (optional)</Text><TextInput accessibilityLabel="Space description" maxLength={500} multiline value={description} onChangeText={setDescription} placeholder="Add a little context" placeholderTextColor={colors.textSubtle} style={[styles.input, styles.multiline]} />
        <Text style={styles.label}>Schedule (optional)</Text><TextInput accessibilityLabel="Schedule date and time" value={scheduledAt} onChangeText={setScheduledAt} placeholder="2026-11-02T18:30:00+01:00" placeholderTextColor={colors.textSubtle} autoCapitalize="none" style={styles.input} />
        <Text style={styles.label}>Who can join?</Text>
        <View style={styles.audienceChoices}>
          {(["public", "followers"] as const).map((policy) => <Pressable key={policy} accessibilityRole="radio" accessibilityState={{ checked: audiencePolicy === policy }} onPress={() => setAudiencePolicy(policy)} style={[styles.audienceChoice, audiencePolicy === policy && styles.audienceChoiceSelected]}><Text color={audiencePolicy === policy ? SPACE_BLUE : colors.text}>{policy === "public" ? "Everyone" : "Followers"}</Text></Pressable>)}
        </View>
        <Text size={12} color={colors.textMuted}>Use a future date with timezone offset, or leave blank to start now.</Text>
        {actionButton(scheduledAt.trim() ? "Schedule Space" : "Start Space", create)}
      </ScrollView> : creating ? <ScrollView contentContainerStyle={styles.content}>
        <Text size={25} weight={700} accessibilityRole="header">Host a Space</Text>
        <Text color={colors.textMuted} style={styles.intro}>Spaces are hosted by approved creators. Anyone can listen to public Spaces.</Text>
        <Button title={creatorEntry.isLoading ? "Checking creator access…" : creatorEntry.label} onPress={() => openCreatorProgramOrSettings(navigation, creatorEntry.route)} disabled={creatorEntry.isLoading} />
      </ScrollView> : spaceId ? <ScrollView contentContainerStyle={styles.content}>
        {detail.isLoading ? <Text accessibilityLiveRegion="polite">Loading Space…</Text> : null}
        {detail.isError && !space ? <ErrorState error={detail.error} compact message="Couldn't load this Space." onRetry={() => detail.refetch()} retrying={detail.isRefetching} /> : null}
        {space ? <>
          <View style={styles.livePill}><View style={[styles.dot, { backgroundColor: space.state === "live" ? SPACE_BLUE : colors.textMuted }]} /><Text size={12} weight={600} color={SPACE_BLUE}>{space.state === "live" ? "SPACE · LIVE AUDIO" : space.state.toUpperCase()}</Text></View>
          <Text size={26} weight={700} lineHeight={32} accessibilityRole="header">{space.title}</Text>
          {space.description ? <Text color={colors.textMuted}>{space.description}</Text> : null}
          {space.state === "scheduled" && space.scheduledAt ? <Text color={SPACE_BLUE}>Starts {new Date(space.scheduledAt).toLocaleString()}</Text> : null}
          <View style={styles.roomPanel}>
            <View style={styles.wave} accessibilityLabel="Audio only Space" accessibilityRole="image"><View style={styles.waveBar} /><View style={[styles.waveBar, styles.waveTall]} /><View style={styles.waveBar} /><View style={[styles.waveBar, styles.waveShort]} /><View style={styles.waveBar} /></View>
            <Text weight={600}>{space.listenerCount} listening</Text>
            <Text size={12} color={colors.textMuted}>{audio.status === "connected" ? "Connected to live audio" : audio.status === "connecting" || audio.status === "reconnecting" ? "Connecting to live audio…" : "Audio conversation · camera is not used"}</Text>
          </View>
          {audio.error ? <Text accessibilityRole="alert" color={colors.error}>{audio.error}</Text> : null}
          {audio.status === "failed" || audio.status === "unavailable" ? actionButton("Retry audio", audio.retry, "secondary", false) : null}
          <Text size={16} weight={700} accessibilityRole="header">On stage</Text>
          {personRow(space.host)}{space.speakers.map((person) => personRow(person, true))}
          {space.pendingSpeakerRequests?.length ? <><Text size={16} weight={700} accessibilityRole="header" style={styles.sectionTitle}>Requests to speak</Text>{space.pendingSpeakerRequests.map((request) => <View key={request.id} style={styles.requestRow}><Text style={styles.personCopy}>{request.user.name}</Text><Pressable accessibilityRole="button" onPress={() => act(() => spacesService.approveSpeakerRequest(space.id, request.id))}><Text color={SPACE_BLUE}>Approve</Text></Pressable><Pressable accessibilityRole="button" onPress={() => act(() => spacesService.declineSpeakerRequest(space.id, request.id))}><Text color={colors.error}>Decline</Text></Pressable></View>)}</> : null}
          {space.state === "scheduled" && !isHost ? actionButton(space.viewerReminder ? "Remove reminder" : "Set reminder", () => act(() => space.viewerReminder ? spacesService.removeReminder(space.id) : spacesService.setReminder(space.id), space.viewerReminder ? "Reminder removed." : "Reminder set."), "secondary") : null}
          {space.state === "scheduled" && isHost ? actionButton("Start now", () => act(async () => {
            await spacesService.start(space.id);
            setJoinGrant(await spacesService.join(space.id));
          }), "primary") : null}
          {space.state === "live" && !isJoined ? actionButton("Join as listener", () => join(space)) : null}
          {space.state === "live" && isJoined && !joinGrant ? actionButton("Connect to audio", () => join(space), "secondary") : null}
          {space.state === "live" && isJoined && space.viewerRole === "listener" ? <>
            {actionButton(space.speakerRequestState === "pending" ? "Request sent" : "Request microphone", () => act(() => spacesService.requestToSpeak(space.id), "Your request was sent to the host."), "secondary", busy || space.speakerRequestState === "pending")}
          </> : null}
          {space.state === "live" && audio.canPublish ? actionButton(audio.isMuted ? "Unmute microphone" : "Mute microphone", () => { void audio.toggleMicrophone(); }, "secondary", audio.status !== "connected") : null}
          {space.state === "live" && isJoined && !isHost ? actionButton("Leave Space", leaveSpace, "destructive") : null}
          {space.state === "live" && isHost ? actionButton("End Space", () => act(() => spacesService.end(space.id), "Space ended."), "destructive") : null}
          {space.state === "scheduled" && isHost ? actionButton("Cancel Space", () => act(() => spacesService.cancel(space.id), "Space cancelled."), "destructive") : null}
          {space.state === "live" && !isHost ? <Pressable accessibilityRole="button" onPress={() => report(space)} style={styles.report}><Text color={colors.textMuted}>Report this Space</Text></Pressable> : null}
        </> : null}
      </ScrollView> : <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.discoveryHeading}><View><Text size={26} weight={700} accessibilityRole="header">Talk, listen, connect.</Text><Text color={colors.textMuted} style={styles.intro}>Join live audio conversations or find one coming up.</Text></View><Pressable accessibilityRole="button" accessibilityLabel={canHostSpace ? "Create a Space" : "Creator access required to host a Space"} accessibilityState={{ disabled: creatorEntry.isLoading }} onPress={openHostFlow} style={styles.createButton}><Text weight={600} color="#FFFFFF">{canHostSpace ? "Create" : "Host"}</Text></Pressable></View>
        {listing.isLoading ? <Text accessibilityLiveRegion="polite">Finding Spaces…</Text> : null}
        {listing.isError && !listing.data ? <ErrorState error={listing.error} compact message="Spaces couldn't load." onRetry={() => listing.refetch()} retrying={listing.isRefetching} /> : null}
        {listing.data?.data.length === 0 ? <View style={styles.empty}><Text size={18} weight={600} accessibilityRole="header">No Spaces right now</Text><Text color={colors.textMuted}>Join the conversation when a Space is live, or check back for upcoming rooms.</Text>{canHostSpace ? <Button title="Create a Space" onPress={openHostFlow} /> : null}</View> : null}
        {listing.data?.data.some((item) => item.state === "live") ? <><Text size={17} weight={700} accessibilityRole="header" style={styles.sectionTitle}>Live now</Text>{listing.data.data.filter((item) => item.state === "live").map((item) => <SpaceCard key={item.id} item={item} onOpen={() => openRoom(item)} onJoin={() => join(item)} />)}</> : null}
        {listing.data?.data.some((item) => item.state === "scheduled") ? <><Text size={17} weight={700} accessibilityRole="header" style={styles.sectionTitle}>Upcoming</Text>{listing.data.data.filter((item) => item.state === "scheduled").map((item) => <SpaceCard key={item.id} item={item} onOpen={() => openRoom(item)} onJoin={() => openRoom(item)} />)}</> : null}
      </ScrollView>}
    </View>
  );
}

function SpaceCard({ item, onOpen, onJoin }: { readonly item: SpaceSummary; readonly onOpen: () => void; readonly onJoin: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return <View style={styles.card}>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.title}, hosted by ${item.host.name}`} onPress={onOpen} style={styles.cardMain}>
      <Avatar uri={item.host.avatarUrl ?? undefined} size={44} />
      <View style={styles.cardCopy}><Text size={15} weight={600} numberOfLines={2}>{item.title}</Text><Text size={12} color={colors.textMuted}>{item.host.name} · {item.state === "live" ? `${item.listenerCount} listening` : item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : "Scheduled"}</Text></View>
    </Pressable>
    <Button title={item.state === "live" ? "Join" : "Details"} onPress={onJoin} height={36} variant="brand" />
  </View>;
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  back: { width: 44, height: 44, justifyContent: "center" }, share: { width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" },
  content: { padding: 20, paddingBottom: 32, gap: 14 }, intro: { marginTop: 6 }, discoveryHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  createButton: { backgroundColor: SPACE_BLUE, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }, sectionTitle: { marginTop: 12 }, audienceChoices: { flexDirection: "row", gap: 8 }, audienceChoice: { borderWidth: 1, borderColor: colors.divider, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 9 }, audienceChoiceSelected: { borderColor: SPACE_BLUE, backgroundColor: colors.primaryTint }, card: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.divider, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface }, cardMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }, cardCopy: { flex: 1, gap: 4 },
  empty: { paddingVertical: 48, alignItems: "center", gap: 12 }, label: { fontWeight: "600", marginTop: 10 }, input: { borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, color: colors.text, borderRadius: 10, padding: 13, fontSize: 15 }, multiline: { minHeight: 96, textAlignVertical: "top" }, notice: { marginHorizontal: 18, color: colors.error }, livePill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.primaryTint, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 }, dot: { width: 7, height: 7, borderRadius: 4 }, roomPanel: { minHeight: 170, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.divider, marginVertical: 6 }, wave: { flexDirection: "row", alignItems: "center", gap: 5, height: 42 }, waveBar: { width: 5, height: 22, borderRadius: 5, backgroundColor: SPACE_BLUE }, waveTall: { height: 38 }, waveShort: { height: 14 }, personRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52 }, personCopy: { flex: 1 }, moderation: { flexDirection: "row", gap: 10 }, requestRow: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 42 }, report: { alignSelf: "center", padding: 12 },
}));
