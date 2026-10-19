import { isVoiceNoteSessionActive } from "@zudomart/chat-crypto";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { makeThemedStyles, useTheme } from "@/theme";
import { pickPhotosAndVideosFromLibrary, takePhotoWithSystemCamera } from "@/components/create/pickMedia.util";
import type { LocalMediaFile } from "@/services/media/mediaPreparation.service";
import type { MessageDocument, SharedLocation } from "@/types";
import type { MentionEntity } from "@/types/mention.type";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { isViewerSignedIn, requireAuthThen } from "@/utils/requireAuth.util";

import { ChatAttachmentMenu, type ChatAttachmentOption } from "./chatAttachmentMenu";
import { ChatLocationSheet } from "./chatLocationSheet";
import { ChatPollComposerSheet } from "./chatPollComposerSheet";
import { MessageComposerBar, type MessageComposerBarProps } from "./messageComposerBar";
import type { OutgoingPollDraft } from "./optimisticLocationAndPollSender.hook";
import { pickDocumentToSendInChat } from "./pickChatDocument.util";
import { VoiceNoteMicrophoneButton } from "./voiceNoteMicrophoneButton";
import { VoiceNoteRecordingPill } from "./voiceNoteRecordingPill";
import { type RecordedVoiceNote, useVoiceNoteRecorder } from "./voiceNoteRecorder.hook";

export interface ChatComposerWithVoiceNotesProps {
  readonly onSendText: (text: string, mentions?: readonly MentionEntity[]) => void;
  readonly mentionConversation?: MessageComposerBarProps["mentionConversation"];
  readonly onSendVoiceNote: (voiceNote: RecordedVoiceNote) => void;
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
  const reduceMotion = useReducedMotionPreference();
  const voiceRecorder = useVoiceNoteRecorder(onSendVoiceNote, reduceMotion);
  const [composerWidth, setComposerWidth] = useState(360);
  const [now, setNow] = useState(() => Date.now());
  const handsFreeOfferedUntilMs = voiceRecorder.session.phase === "idle" ? voiceRecorder.session.handsFreeOfferedUntilMs : 0;
  const isHandsFreeOffered = handsFreeOfferedUntilMs > now;

  useEffect(() => {
    if (handsFreeOfferedUntilMs <= Date.now()) return;
    const timer = setTimeout(() => setNow(Date.now()), handsFreeOfferedUntilMs - Date.now() + 20);
    return () => clearTimeout(timer);
  }, [handsFreeOfferedUntilMs]);

  const startVoiceNote = (mode?: "tap") => {
    if (!isViewerSignedIn()) {
      requireAuthThen(() => undefined, null, "send voice notes");
      return;
    }
    void voiceRecorder.press(mode);
  };
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
    if (picked.status === "rejected") showAlertWithButtons("File not sent", picked.reason, undefined, { intent: "attachment" });
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

  const voiceNoteBarOverlay = isVoiceNoteSessionActive(voiceRecorder.session) ? (
    <VoiceNoteRecordingPill
      session={voiceRecorder.session}
      previewFile={voiceRecorder.previewFile}
      availableWidth={composerWidth}
      reduceMotion={reduceMotion}
      onStop={voiceRecorder.stop}
      onStopAndSend={voiceRecorder.stopAndSend}
      onDiscard={voiceRecorder.cancel}
      onSendPreview={voiceRecorder.sendPreview}
    />
  ) : null;

  return (
    <View onLayout={(event) => setComposerWidth(event.nativeEvent.layout.width)}>
      {isHandsFreeOffered ? (
        <View style={styles.handsFreeHint} pointerEvents="none" accessibilityLiveRegion="polite">
          <Text size={13} weight={500} lineHeight={16} color={colors.textFaint} align="center" style={styles.handsFreeHintText}>
            Hold to record, or tap again to record hands-free
          </Text>
        </View>
      ) : null}
      <MessageComposerBar
        onSend={onSendText}
        mentionConversation={mentionConversation}
        onTypingChange={onTypingChange}
        onPressPlus={() => setIsAttachmentMenuOpen(true)}
        barOverlay={voiceNoteBarOverlay}
        microphoneButton={
          <VoiceNoteMicrophoneButton
            onHoldStart={() => startVoiceNote()}
            onDrag={voiceRecorder.drag}
            onRelease={voiceRecorder.release}
            onInterrupt={voiceRecorder.interrupt}
            onRecordHandsFree={() => startVoiceNote("tap")}
          />
        }
      />
      <ChatAttachmentMenu visible={isAttachmentMenuOpen} onClose={() => setIsAttachmentMenuOpen(false)} onSelect={selectAttachment} />
      <ChatLocationSheet
        visible={isLocationSheetOpen}
        onClose={() => setIsLocationSheetOpen(false)}
        onSendCurrentLocation={(location) => onSendLocation?.(location)}
        onStartLiveLocation={(location, durationMinutes) => onStartLiveLocation?.(location, durationMinutes)}
      />
      <ChatPollComposerSheet visible={isPollSheetOpen} onClose={() => setIsPollSheetOpen(false)} onSendPoll={(poll) => onSendPoll?.(poll)} />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  handsFreeHint: { position: "absolute", left: 16, right: 16, top: -30, zIndex: 1, alignItems: "center" },
  handsFreeHintText: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", backgroundColor: colors.elevated },
}));
