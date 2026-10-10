import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Cancel20Icon, PaperPlaneTilt24Icon } from "@/components/icons";
import { KeyboardSpacer } from "@/components/ui/keyboardSpacer";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { pickPhotosAndVideosFromLibrary, takePhotoWithSystemCamera } from "@/components/create/pickMedia.util";
import type { LocalMediaFile } from "@/services/media/mediaPreparation.service";
import type { MessageDocument, SharedLocation } from "@/types";
import type { MentionEntity } from "@/types/mention.type";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { requireAuthThen } from "@/utils/requireAuth.util";

import { ChatAttachmentMenu, type ChatAttachmentOption } from "./chatAttachmentMenu";
import { ChatLocationSheet } from "./chatLocationSheet";
import { ChatPollComposerSheet } from "./chatPollComposerSheet";
import { MessageComposerBar, type MessageComposerBarProps } from "./messageComposerBar";
import type { OutgoingPollDraft } from "./optimisticLocationAndPollSender.hook";
import { pickDocumentToSendInChat } from "./pickChatDocument.util";
import { formatVoiceNoteDuration, useVoiceNoteRecorder } from "./voiceNoteRecorder.hook";

export interface ChatComposerWithVoiceNotesProps {
  readonly onSendText: (text: string, mentions?: readonly MentionEntity[]) => void;
  readonly mentionConversation?: MessageComposerBarProps["mentionConversation"];
  readonly onSendVoiceNote: (voiceNote: LocalMediaFile) => void;
  readonly onSendImage?: (image: LocalMediaFile) => void;
  readonly onSendLocation?: (location: SharedLocation) => void;
  readonly onStartLiveLocation?: (location: SharedLocation, durationMinutes: number) => void;
  readonly onSendDocument?: (document: MessageDocument) => void;
  readonly onSendPoll?: (poll: OutgoingPollDraft) => void;
  readonly onTypingChange?: (isTyping: boolean) => void;
}

export function ChatComposerWithVoiceNotes({ onSendText, mentionConversation, onSendVoiceNote, onSendImage, onSendLocation, onStartLiveLocation, onSendDocument, onSendPoll, onTypingChange }: ChatComposerWithVoiceNotesProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const voiceRecorder = useVoiceNoteRecorder(onSendVoiceNote);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isLocationSheetOpen, setIsLocationSheetOpen] = useState(false);
  const [isPollSheetOpen, setIsPollSheetOpen] = useState(false);

  const sendPickedPhoto = async (pick: () => Promise<LocalMediaFile[]>) => {
    const picked = await pick();
    const photo = picked[0];
    if (photo) onSendImage?.(photo);
  };

  const pickAndSendDocument = async () => {
    const picked = await pickDocumentToSendInChat();
    if (picked.status === "rejected") showAlertWithButtons("File not sent", picked.reason);
    if (picked.status === "picked") onSendDocument?.(picked.document);
  };

  const selectAttachment = (option: ChatAttachmentOption) => {
    setIsAttachmentMenuOpen(false);
    if (option === "photos") {
      void sendPickedPhoto(() => pickPhotosAndVideosFromLibrary(1));
      return;
    }
    if (option === "camera") {
      void sendPickedPhoto(() => takePhotoWithSystemCamera());
      return;
    }
    if (option === "location") requireAuthThen(() => setIsLocationSheetOpen(true), null, "share your location");
    if (option === "documents") requireAuthThen(pickAndSendDocument, null, "send documents");
    if (option === "poll") requireAuthThen(() => setIsPollSheetOpen(true), null, "create a poll");
  };

  if (!voiceRecorder.isRecording) {
    return (
      <>
        <MessageComposerBar
          onSend={onSendText}
          mentionConversation={mentionConversation}
          onTypingChange={onTypingChange}
          onPressPlus={() => setIsAttachmentMenuOpen(true)}
          onPressMicrophone={voiceRecorder.isPreparing ? undefined : () => voiceRecorder.startRecordingVoiceNote()}
        />
        <ChatAttachmentMenu visible={isAttachmentMenuOpen} onClose={() => setIsAttachmentMenuOpen(false)} onSelect={selectAttachment} />
        <ChatLocationSheet
          visible={isLocationSheetOpen}
          onClose={() => setIsLocationSheetOpen(false)}
          onSendCurrentLocation={(location) => onSendLocation?.(location)}
          onStartLiveLocation={(location, durationMinutes) => onStartLiveLocation?.(location, durationMinutes)}
        />
        <ChatPollComposerSheet visible={isPollSheetOpen} onClose={() => setIsPollSheetOpen(false)} onSendPoll={(poll) => onSendPoll?.(poll)} />
      </>
    );
  }

  return (
    <View>
    <View style={styles.bar} accessibilityLiveRegion="polite">
      <Pressable accessibilityRole="button" accessibilityLabel="Cancel voice note" hitSlop={10} onPress={() => voiceRecorder.stopRecordingAndDiscard()}>
        <Cancel20Icon />
      </Pressable>
      <View style={styles.status}>
        <View style={styles.recordingDot} />
        <Text size={14} weight={500} lineHeight={16.8}>
          Recording {formatVoiceNoteDuration(voiceRecorder.recordedSeconds)}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Send voice note" hitSlop={10} onPress={() => voiceRecorder.stopRecordingAndSend()}>
        <PaperPlaneTilt24Icon color={colors.primary} />
      </Pressable>
    </View>
    <KeyboardSpacer style={styles.keyboardArea} />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  bar: {
    height: 60,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  keyboardArea: { backgroundColor: colors.surface },
  status: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.live },
}));
