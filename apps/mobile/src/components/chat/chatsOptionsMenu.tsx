import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles } from "@/theme";
import { FrameAwareModal } from "@/components/ui/frameAwareModal";

export interface ChatsOptionsMenuProps {
  readonly visible: boolean;
  readonly topOffset: number;
  readonly onClose: () => void;
  readonly onCreateGroup: () => void;
  readonly onCreateChannel: () => void;
  readonly onOpenSettings: () => void;
}

export function ChatsOptionsMenu({ visible, topOffset, onClose, onCreateGroup, onCreateChannel, onOpenSettings }: ChatsOptionsMenuProps) {
  const styles = useStyles();
  const menuItems = [
    { label: "New group", onPress: onCreateGroup },
    { label: "New channel", onPress: onCreateChannel },
    { label: "Chat settings", onPress: onOpenSettings },
  ];
  return (
    <FrameAwareModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close menu" style={styles.backdrop} onPress={onClose}>
        <View style={[styles.menu, { top: topOffset }]} accessibilityRole="menu">
          {menuItems.map((item) => (
            <Pressable
              key={item.label}
              accessibilityRole="menuitem"
              onPress={() => {
                onClose();
                item.onPress();
              }}
              style={styles.item}
            >
              <Text size={14} weight={500} lineHeight={16.8}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </FrameAwareModal>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  backdrop: { flex: 1 },
  menu: {
    position: "absolute",
    right: 12,
    minWidth: 180,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  item: { height: 44, paddingHorizontal: 16, justifyContent: "center" },
}));
