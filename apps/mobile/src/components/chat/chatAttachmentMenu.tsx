import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Camera24Icon, Document24Icon, ImageSquare24Icon, MapPin24Icon, Poll24Icon } from "@/components/icons";
import { FrameAwareModal } from "@/components/ui/frameAwareModal";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

export type ChatAttachmentOption = "photos" | "camera" | "location" | "documents" | "poll";

interface AttachmentOptionRow {
  readonly option: ChatAttachmentOption;
  readonly label: string;
  readonly icon: ReactNode;
}

const OPTIONS: readonly AttachmentOptionRow[] = [
  { option: "photos", label: "Photos", icon: <ImageSquare24Icon /> },
  { option: "camera", label: "Camera", icon: <Camera24Icon /> },
  { option: "location", label: "Location", icon: <MapPin24Icon /> },
  { option: "documents", label: "Documents", icon: <Document24Icon /> },
  { option: "poll", label: "Poll", icon: <Poll24Icon /> },
];

export interface ChatAttachmentMenuProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onSelect: (option: ChatAttachmentOption) => void;
}

export function ChatAttachmentMenu({ visible, onClose, onSelect }: ChatAttachmentMenuProps) {
  const insets = useSafeAreaInsets();
  return (
    <FrameAwareModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close attachment menu" style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => undefined} style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]} accessibilityRole="menu">
          <View style={styles.handle} />
          {OPTIONS.map((row) => (
            <Pressable
              key={row.option}
              accessibilityRole="menuitem"
              accessibilityLabel={row.label}
              onPress={() => onSelect(row.option)}
              style={styles.row}
            >
              {row.icon}
              <Text size={15} lineHeight={19.5}>
                {row.label}
              </Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </FrameAwareModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: colors.divider, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, paddingVertical: 14 },
});
