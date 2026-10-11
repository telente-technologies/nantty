import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chat37AltAltIcon, Flips34AltAltIcon, Home33AltIcon, Home33Icon, Plus28Icon, UserProfile45AltIcon } from "@/components/icons";
import { ProfileSwitcherSheet } from "@/components/profile/profileSwitcher";
import { Avatar } from "@/components/ui/avatar";
import { makeThemedStyles, useTheme } from "@/theme";
import { useActingProfileStore } from "@/store/actingProfile.store";
import { useAuthStore } from "@/store/auth.store";
import { useProfileSwitcherSheetStore } from "@/store/profileSwitcherSheet.store";
import { requireAuthThen } from "@/utils/requireAuth.util";

const LABELS: Record<string, string> = { Home: "Home", Clips: "Clips", Create: "Create", Chats: "Chats", Me: "Profile" };

export function TabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const isSignedIn = useAuthStore((s) => s.status === "signedIn");
  const signedInUserAvatarUrl = useAuthStore((s) => s.user?.avatarUrl ?? null);
  const actingProfileAvatarUrl = useActingProfileStore((s) => s.actingProfile?.avatarUrl ?? null);
  const avatarUrl = isSignedIn ? (actingProfileAvatarUrl ?? signedInUserAvatarUrl) : null;
  const openProfileSwitcherSheet = useProfileSwitcherSheetStore((s) => s.openProfileSwitcherSheet);
  const focusedRouteKey = state.routes[state.index]?.key;
  const focusedTabBarStyle = focusedRouteKey ? descriptors[focusedRouteKey]?.options.tabBarStyle : undefined;
  const isTabBarHiddenOnFocusedScreen =
    !!focusedTabBarStyle && typeof focusedTabBarStyle === "object" && "display" in focusedTabBarStyle && focusedTabBarStyle.display === "none";

  const renderTabIcon = (name: string, focused: boolean) => {
    switch (name) {
      case "Home":
        return focused ? <Home33Icon /> : <Home33AltIcon />;
      case "Clips":
        return <Flips34AltAltIcon color={focused ? colors.primary : undefined} />;
      case "Create":
        return (
          <View style={styles.create}>
            <Plus28Icon />
          </View>
        );
      case "Chats":
        return <Chat37AltAltIcon color={focused ? colors.primary : undefined} />;
      default:
        if (!avatarUrl) return <UserProfile45AltIcon color={focused ? colors.primary : undefined} />;
        return (
          <View style={[styles.avatarRing, focused && styles.avatarRingActive]}>
            <Avatar uri={avatarUrl} size={28} />
          </View>
        );
    }
  };

  if (isTabBarHiddenOnFocusedScreen) return null;

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const openTabOrCreateScreen = () => {
            if (route.name === "Create") {
              requireAuthThen(() => navigation.getParent()?.navigate("CreatePost", { mode: "post" }), undefined, "create posts, clips and lives");
              return;
            }
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={LABELS[route.name] ?? route.name}
              accessibilityState={{ selected: focused }}
              onPress={openTabOrCreateScreen}
              onLongPress={route.name === "Me" && isSignedIn ? openProfileSwitcherSheet : undefined}
              accessibilityHint={route.name === "Me" ? "Long press to switch profile" : undefined}
              hitSlop={8}
              style={styles.item}
            >
              {renderTabIcon(route.name, focused)}
            </Pressable>
          );
        })}
      </View>
      <ProfileSwitcherSheet />
    </View>
  );
}

const useStyles = makeThemedStyles((colors, scheme) => StyleSheet.create({
  wrap: {
    backgroundColor: scheme === "dark" ? "rgba(14,14,16,0.92)" : "rgba(255,255,255,0.92)",
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 8,
  },
  row: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  item: { minWidth: 45, height: 44, alignItems: "center", justifyContent: "center" },
  create: { width: 83, height: 44, borderRadius: 999, backgroundColor: colors.primarySolid, alignItems: "center", justifyContent: "center" },
  avatarRing: { borderRadius: 16, padding: 1, borderWidth: 1, borderColor: "transparent" },
  avatarRingActive: { borderColor: colors.primary },
}));
