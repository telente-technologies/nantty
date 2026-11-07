import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { GroupMemberPicker } from "@/components/chat/groupMemberPicker";
import { pickPhotosAndVideosFromLibrary } from "@/components/create/pickMedia.util";
import { Cancel20Icon, CameraBolt24Icon } from "@/components/icons";
import { UploadProgressBar } from "@/components/media/uploadProgressBar";
import { Button } from "@/components/ui/button";
import { KeyboardStickyFooter } from "@/components/ui/keyboardStickyFooter";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { channelsService } from "@/services/social/channels.service";
import { groupsService } from "@/services/social/groups.service";
import { enqueueLocalMediaForUpload, waitForUploadedMediaId } from "@/services/media/mediaUploadQueue.service";
import type { LocalMediaFile } from "@/services/media/mediaPreparation.service";
import type { UserSummary } from "@/types";
import { describeActionFailure } from "@/errors/errorExperience/describeError";
import { ApiError } from "@/errors/api.error";

const MAXIMUM_GROUP_NAME_LENGTH = 60;

export function NewGroupScreen({ navigation, route }: MainScreenProps<"NewGroup">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const isChannel = route.params.kind === "channel";
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPeople, setSelectedPeople] = useState<readonly UserSummary[]>([]);
  const [photo, setPhoto] = useState<{ previewUri: string; uploadJobId: string | null; file: LocalMediaFile } | null>(null);
  const [invitationFallbackRequired, setInvitationFallbackRequired] = useState(false);
  const [fallbackGroup, setFallbackGroup] = useState<{ id: string; title?: string | null } | null>(null);
  const [fallbackFailedPeople, setFallbackFailedPeople] = useState<readonly UserSummary[]>([]);
  const [fallbackSentCount, setFallbackSentCount] = useState(0);

  const openGroup = (group: { id: string; title?: string | null }) => {
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    navigation.replace("Chat", { conversationId: group.id, name: group.title ?? name.trim() });
  };

  const sendInvitations = async (conversationId: string, people: readonly UserSummary[]) => {
    const outcomes = await Promise.allSettled(people.map((person) => groupsService.createGroupInvitation(conversationId, person.id)));
    return {
      sentCount: outcomes.filter((outcome) => outcome.status === "fulfilled").length,
      failedPeople: people.filter((_person, index) => outcomes[index]?.status === "rejected"),
    };
  };

  const pickGroupPhotoAndStartUploading = async () => {
    const [pickedPhoto] = await pickPhotosAndVideosFromLibrary(1);
    if (!pickedPhoto || pickedPhoto.mediaType !== "image") return;
    const uploadJobId = isChannel ? await enqueueLocalMediaForUpload(pickedPhoto, "chat") : null;
    setPhoto({ previewUri: pickedPhoto.uri, uploadJobId, file: pickedPhoto });
  };

  const toggleSelectedPerson = (person: UserSummary) =>
    setSelectedPeople((current) =>
      current.some((selected) => selected.id === person.id) ? current.filter((selected) => selected.id !== person.id) : [...current, person],
    );

  const createConversation = useMutation({
    mutationFn: async () => {
      if (!isChannel) return groupsService.createGroupConversation({ name: name.trim(), memberIds: selectedPeople.map((person) => person.id), photo: photo?.file ?? null });
      const photoMediaId = photo?.uploadJobId ? await waitForUploadedMediaId(photo.uploadJobId) : undefined;
      return channelsService.createBroadcastChannel({ name: name.trim(), description: description.trim() || undefined, photoMediaId });
    },
    onSuccess: openGroup,
    onError: (error) => {
      if (error instanceof ApiError && error.code === "GROUP_INVITATION_REQUIRED") setInvitationFallbackRequired(true);
    },
  });
  const createGroupAndInvite = useMutation({
    mutationFn: async () => {
      // Create an owner-only group, then use the consent-based invitation endpoint.
      // The server remains authoritative; this fallback is offered only after its policy conflict.
      const conversation = await groupsService.createGroupConversation({ name: name.trim(), memberIds: [], photo: photo?.file ?? null });
      const invitations = await sendInvitations(conversation.id, selectedPeople);
      return { conversation, ...invitations };
    },
    onSuccess: ({ conversation, sentCount, failedPeople }) => {
      setFallbackSentCount((count) => count + sentCount);
      setFallbackFailedPeople(failedPeople);
      if (failedPeople.length === 0) openGroup(conversation);
      else setFallbackGroup({ id: conversation.id, title: conversation.title });
    },
  });
  const retryInvitations = useMutation({
    mutationFn: async () => {
      if (!fallbackGroup) return { sentCount: 0, failedPeople: fallbackFailedPeople };
      return sendInvitations(fallbackGroup.id, fallbackFailedPeople);
    },
    onSuccess: ({ sentCount, failedPeople }) => {
      setFallbackSentCount((count) => count + sentCount);
      setFallbackFailedPeople(failedPeople);
      if (failedPeople.length === 0 && fallbackGroup) openGroup(fallbackGroup);
    },
  });

  const canCreate = name.trim().length > 0 && (isChannel || selectedPeople.length > 0);

  return (
    <Screen background={colors.surface}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={() => navigation.goBack()}>
          <Cancel20Icon />
        </Pressable>
        <Text size={21} weight={500} lineHeight={25.2} letterSpacing={-0.42} accessibilityRole="header">
          {isChannel ? "New channel" : "New group"}
        </Text>
      </View>
      <View style={styles.body}>
        <View style={styles.identityRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isChannel ? "Add channel photo" : "Add group photo"}
            onPress={() => pickGroupPhotoAndStartUploading().catch(() => undefined)}
            style={styles.photo}
          >
            {photo ? <Image source={{ uri: photo.previewUri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <CameraBolt24Icon />}
          </Pressable>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={MAXIMUM_GROUP_NAME_LENGTH}
            placeholder={isChannel ? "Channel name" : "Group name"}
            placeholderTextColor={colors.textSubtle}
            accessibilityLabel={isChannel ? "Channel name" : "Group name"}
            selectionColor={colors.primary}
            style={styles.nameInput}
          />
        </View>
        {photo?.uploadJobId ? <UploadProgressBar jobId={photo.uploadJobId} /> : null}
        {isChannel ? (
          <TextInput
            value={description}
            onChangeText={setDescription}
            maxLength={200}
            multiline
            placeholder="What will you post? (optional)"
            placeholderTextColor={colors.textSubtle}
            accessibilityLabel="Channel description"
            selectionColor={colors.primary}
            style={styles.descriptionInput}
          />
        ) : (
          <GroupMemberPicker selectedPeople={selectedPeople} onToggleSelectedPerson={toggleSelectedPerson} />
        )}
      </View>
      <KeyboardStickyFooter style={styles.footer} backgroundColor={colors.surface}>
        {invitationFallbackRequired ? (
          <Text size={13} lineHeight={18} color={colors.textMuted}>
            Someone you selected only accepts group invitations. Create the group first and send each selected person an invitation; they must accept, and secure key handoff is still required before they can join or read group history.
          </Text>
        ) : createConversation.error ? (
          <Text size={13} lineHeight={16.9} color={colors.error}>
            {describeActionFailure(createConversation.error)}
          </Text>
        ) : null}
        {fallbackGroup && fallbackFailedPeople.length > 0 ? (
          <>
            <Text size={13} lineHeight={18} color={colors.error} accessibilityRole="alert">
              Group created; {fallbackSentCount} invitation{fallbackSentCount === 1 ? " was" : "s were"} sent, but {fallbackFailedPeople.length} could not be sent. Retry the remaining invitations or open the group to manage them later.
            </Text>
            <Button title="Retry failed invitations" loading={retryInvitations.isPending} disabled={retryInvitations.isPending} onPress={() => retryInvitations.mutate()} />
            <Button title="Open group" variant="subtle" onPress={() => openGroup(fallbackGroup)} />
          </>
        ) : null}
        {!fallbackGroup ? (
        <Button
          title={isChannel ? "Create channel" : invitationFallbackRequired ? "Create group and send invitations" : `Create group${selectedPeople.length > 0 ? ` (${selectedPeople.length + 1})` : ""}`}
          disabled={!canCreate || (invitationFallbackRequired && selectedPeople.length === 0)}
          loading={createConversation.isPending || createGroupAndInvite.isPending}
          onPress={() => invitationFallbackRequired ? createGroupAndInvite.mutate() : createConversation.mutate()}
        />
        ) : null}
        {createGroupAndInvite.error ? <Text size={13} lineHeight={17} color={colors.error} accessibilityRole="alert">{describeActionFailure(createGroupAndInvite.error, "Couldn't create the group. Try again.")}</Text> : null}
        {retryInvitations.error ? <Text size={13} lineHeight={17} color={colors.error} accessibilityRole="alert">{describeActionFailure(retryInvitations.error, "Couldn't retry these invitations. Try again.")}</Text> : null}
      </KeyboardStickyFooter>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  header: { height: 49, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 24 },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 12 },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  photo: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.skeleton, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  nameInput: {
    flex: 1,
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    fontFamily: fontFamily[500],
    fontSize: 16,
    letterSpacing: calculateDefaultLetterSpacing(16),
    color: colors.text,
  },
  descriptionInput: {
    minHeight: 88,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    textAlignVertical: "top",
    fontFamily: fontFamily[400],
    fontSize: 14,
    letterSpacing: calculateDefaultLetterSpacing(14),
    color: colors.text,
  },
}));
