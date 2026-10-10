import { Pressable, StyleSheet, View } from "react-native";

import { GearSix24Icon, Share24Icon, Users24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
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
  const { colors } = useTheme();
  const menuItems = [
    { label: "New group", onPress: onCreateGroup, icon: <Users24Icon size={20} color={colors.textMuted} /> },
    { label: "New channel", onPress: onCreateChannel, icon: <Share24Icon size={20} color={colors.textMuted} /> },
    { label: "Chat settings", onPress: onOpenSettings, icon: <GearSix24Icon size={20} color={colors.textMuted} /> },
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
              {item.icon}
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
  item: { minHeight: 48, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12, justifyContent: "flex-start" },
}));
