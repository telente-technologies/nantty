import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Cancel20Icon, PaperPlaneTilt24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { pickPhotosAndVideosFromLibrary, takePhotoWithSystemCamera } from "@/components/create/pickMedia.util";
import type { LocalMediaFile } from "@/services/mediaPreparation.service";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";

import { ChatAttachmentMenu, type ChatAttachmentOption } from "./chatAttachmentMenu";
import { MessageComposerBar } from "./messageComposerBar";
import { formatVoiceNoteDuration, useVoiceNoteRecorder } from "./voiceNoteRecorder.hook";

export interface ChatComposerWithVoiceNotesProps {
  readonly onSendText: (text: string) => void;
  readonly onSendVoiceNote: (voiceNote: LocalMediaFile) => void;
  readonly onSendImage?: (image: LocalMediaFile) => void;
  readonly onTypingChange?: (isTyping: boolean) => void;
}

const COMING_SOON_MESSAGES: Record<Exclude<ChatAttachmentOption, "photos" | "camera">, string> = {
  location: "Sharing your location in chat isn't available yet.",
  documents: "Sending documents in chat isn't available yet.",
  poll: "Polls in chat aren't available yet.",
};

export function ChatComposerWithVoiceNotes({ onSendText, onSendVoiceNote, onSendImage, onTypingChange }: ChatComposerWithVoiceNotesProps) {
  const voiceRecorder = useVoiceNoteRecorder(onSendVoiceNote);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);

  const sendPickedPhoto = async (pick: () => Promise<LocalMediaFile[]>) => {
    const picked = await pick();
    const photo = picked[0];
    if (photo) onSendImage?.(photo);
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
    showAlertWithButtons("Coming soon", COMING_SOON_MESSAGES[option], [{ text: "OK" }]);
  };

  if (!voiceRecorder.isRecording) {
    return (
      <>
        <MessageComposerBar
          onSend={onSendText}
          onTypingChange={onTypingChange}
          onPressPlus={() => setIsAttachmentMenuOpen(true)}
          onPressMicrophone={voiceRecorder.isPreparing ? undefined : () => voiceRecorder.startRecordingVoiceNote()}
        />
        <ChatAttachmentMenu visible={isAttachmentMenuOpen} onClose={() => setIsAttachmentMenuOpen(false)} onSelect={selectAttachment} />
      </>
    );
  }

  return (
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
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 60,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  status: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.live },
});
