import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { FrameAwareModal } from "@/components/ui/frameAwareModal";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { InboxFolder } from "@/types";

export const INBOX_FOLDER_LABELS: Record<InboxFolder, string> = { chats: "Chats", requests: "Requests", spam: "Spam" };

export interface InboxFolderMenuProps {
  readonly folder: InboxFolder;
  readonly topOffset: number;
  readonly onSelect: (folder: InboxFolder) => void;
  readonly titleSize?: number;
}

export function InboxFolderMenu({ folder, topOffset, onSelect, titleSize = 21 }: InboxFolderMenuProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${INBOX_FOLDER_LABELS[folder]}, change inbox folder`} accessibilityState={{ expanded: isOpen }} onPress={() => setIsOpen(true)} style={styles.title}>
        <Text size={titleSize} weight={500} lineHeight={titleSize * 1.2} letterSpacing={-0.42} accessibilityRole="header">{INBOX_FOLDER_LABELS[folder]}</Text>
        <Text size={14} lineHeight={18} color={colors.textMuted}>▾</Text>
      </Pressable>
      <FrameAwareModal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable accessibilityLabel="Close menu" style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <View style={[styles.menu, { top: topOffset }]} accessibilityRole="menu">
            {(Object.keys(INBOX_FOLDER_LABELS) as InboxFolder[]).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: option === folder }}
                onPress={() => {
                  setIsOpen(false);
                  onSelect(option);
                }}
                style={styles.item}
              >
                <Text size={14} weight={option === folder ? 600 : 500} lineHeight={16.8}>{INBOX_FOLDER_LABELS[option]}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </FrameAwareModal>
    </>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  title: { flexDirection: "row", alignItems: "center", gap: 6 },
  backdrop: { flex: 1 },
  menu: { position: "absolute", left: 52, minWidth: 160, borderRadius: 12, backgroundColor: colors.surface, paddingVertical: 4, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 },
  item: { paddingHorizontal: 16, paddingVertical: 12 },
}));
