import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles } from "@/theme";
import { FrameAwareModal } from "@/components/ui/frameAwareModal";
import { buildPopoverMenuSurface } from "@/components/ui/modalChrome.constant";

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
      <Pressable accessibilityRole="button" accessibilityLabel="Close menu" style={styles.backdrop} onPress={onClose}>
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

const useStyles = makeThemedStyles((colors, scheme) => StyleSheet.create({
  backdrop: { flex: 1 },
  menu: { position: "absolute", right: 12, ...buildPopoverMenuSurface(colors, scheme) },
  item: { minHeight: 48, paddingHorizontal: 16, justifyContent: "center" },
}));
