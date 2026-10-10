import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BookmarkSimple24Icon,
  BuildingStore20Icon,
  GearSix24Icon,
  Package24Icon,
  SealCheck20Icon,
  UserPlus24Icon,
  VideoCamera24Icon,
  Wallet24Icon,
} from "@/components/icons";
import { useFollowRequestsQuery } from "@/components/profile/followRequests.hook";
import { FrameAwareModal } from "@/components/ui/frameAwareModal";
import { buildPopoverMenuSurface } from "@/components/ui/modalChrome.constant";
import { Text } from "@/components/ui/text";
import { useCreatorEntry } from "@/hooks/useCreatorStatus.hook";
import type { MainStackParamList } from "@/navigation/navigation.types";
import { makeThemedStyles, useTheme } from "@/theme";
import type { User } from "@/types";

import { buildOwnProfileMenuItems, type OwnProfileMenuIcon } from "./ownProfileMenu.util";

const HEADER_HEIGHT = 48;
const MENU_EDGE = 12;
const MENU_WIDTH = 248;

export interface OwnProfileMenuProps {
  readonly visible: boolean;
  readonly profile: User;
  readonly onClose: () => void;
}

function MenuIcon({ name, color }: { name: OwnProfileMenuIcon; color: string }): ReactNode {
  switch (name) {
    case "seller": return <BuildingStore20Icon size={20} color={color} />;
    case "creator": return <VideoCamera24Icon size={20} color={color} />;
    case "followRequests": return <UserPlus24Icon size={20} color={color} />;
    case "saved": return <BookmarkSimple24Icon size={20} color={color} />;
    case "orders": return <Package24Icon size={20} color={color} />;
    case "wallet": return <Wallet24Icon size={20} color={color} />;
    case "verification": return <SealCheck20Icon size={20} />;
    case "settings": return <GearSix24Icon size={20} color={color} />;
  }
}

export function OwnProfileMenu({ visible, profile, onClose }: OwnProfileMenuProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const creatorEntry = useCreatorEntry();
  const followRequests = useFollowRequestsQuery().data;
  const items = buildOwnProfileMenuItems({
    profile,
    creatorEntry,
    pendingFollowRequests: followRequests?.data.length ?? 0,
    hasMoreFollowRequests: Boolean(followRequests?.nextCursor),
  });
  const top = insets.top + HEADER_HEIGHT;
  const maxHeight = Math.max(160, height - top - insets.bottom - MENU_EDGE);
  const menuWidth = Math.min(MENU_WIDTH, width - MENU_EDGE * 2);

  return (
    <FrameAwareModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close menu" style={styles.backdrop} onPress={onClose}>
        <View style={[styles.menu, { top, right: MENU_EDGE + insets.right, width: menuWidth, maxHeight }]} accessibilityRole="menu">
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            {items.map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="menuitem"
                accessibilityLabel={item.badge ? `${item.label}, ${item.badge} pending` : item.label}
                accessibilityState={{ disabled: Boolean(item.disabled) }}
                disabled={item.disabled}
                onPress={() => {
                  onClose();
                  navigation.navigate(item.route);
                }}
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed, item.disabled && styles.itemDisabled]}
              >
                <MenuIcon name={item.key} color={colors.text} />
                <Text size={14} weight={500} lineHeight={16.8} numberOfLines={1} style={styles.label}>
                  {item.label}
                </Text>
                {item.badge ? (
                  <View style={styles.badge}>
                    <Text size={11} weight={600} lineHeight={13} color={colors.onPrimary}>{item.badge}</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </FrameAwareModal>
  );
}

const useStyles = makeThemedStyles((colors, scheme) => StyleSheet.create({
  backdrop: { flex: 1 },
  menu: { position: "absolute", overflow: "hidden", ...buildPopoverMenuSurface(colors, scheme) },
  item: { minHeight: 48, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  itemPressed: { backgroundColor: colors.primaryTint },
  itemDisabled: { opacity: 0.5 },
  label: { flex: 1 },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
}));
