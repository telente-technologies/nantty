import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { GroupMemberPicker } from "@/components/chat/groupMemberPicker";
import { pickPhotosAndVideosFromLibrary } from "@/components/create/pickMedia.util";
import { Cancel20Icon, CameraBolt24Icon } from "@/components/icons";
import { UploadProgressBar } from "@/components/media/uploadProgressBar";
import { Button } from "@/components/ui/button";
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
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigation.replace("Chat", { conversationId: conversation.id, name: conversation.title ?? name.trim() });
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
        {createConversation.error ? (
          <Text size={13} lineHeight={16.9} color={colors.error}>
            {describeActionFailure(createConversation.error)}
          </Text>
        ) : null}
        <Button
          title={isChannel ? "Create channel" : `Create group${selectedPeople.length > 0 ? ` (${selectedPeople.length + 1})` : ""}`}
          disabled={!canCreate}
          loading={createConversation.isPending}
          onPress={() => createConversation.mutate()}
        />
      </View>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  header: { height: 49, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 24 },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, gap: 16 },
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
