import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chat37AltAltIcon, Flips34AltAltIcon, Home33AltIcon, Home33Icon, Plus28Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { colors } from "@/constants/colors.constant";
import { useAuthStore } from "@/store/auth.store";

const LABELS: Record<string, string> = { Home: "Home", Clips: "Clips", Create: "Create", Chats: "Chats", Me: "Profile" };

export function TabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const avatarUrl = useAuthStore((s) => s.user?.avatarUrl ?? null);
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
      <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const openTabOrCreateScreen = () => {
            if (route.name === "Create") {
              navigation.getParent()?.navigate("CreatePost", { mode: "post" });
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
              hitSlop={8}
              style={styles.item}
            >
              {renderTabIcon(route.name, focused)}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "rgba(255,255,255,0.92)",
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
  create: { width: 83, height: 44, borderRadius: 999, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  avatarRing: { borderRadius: 16, padding: 1, borderWidth: 1, borderColor: "transparent" },
  avatarRingActive: { borderColor: colors.primary },
});
