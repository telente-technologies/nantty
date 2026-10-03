import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { ReactNode } from "react";

import { HomeScreen } from "@/screens/home/home.screen";
import { ClipsScreen } from "@/screens/clips/clips.screen";
import { CreateScreen } from "@/screens/create/createPlaceholder.screen";
import { ChatsScreen } from "@/screens/messages/chats.screen";
import { MeScreen } from "@/screens/profile/myProfile.screen";
import { guestGateScreenLayout } from "@/components/auth/guestGate";
import { ForcedColorSchemeScope } from "@/theme";

import type { MainTabParamList } from "./navigation.types";
import { TabBar } from "./tabBar";

const Tab = createBottomTabNavigator<MainTabParamList>();
const keepReelsOnDarkFirstPalette = ({ children }: { children: ReactNode }) => <ForcedColorSchemeScope scheme="light">{children}</ForcedColorSchemeScope>;

export function MainTabsNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} screenLayout={guestGateScreenLayout} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Clips" component={ClipsScreen} layout={keepReelsOnDarkFirstPalette} />
      <Tab.Screen name="Create" component={CreateScreen} />
      <Tab.Screen name="Chats" component={ChatsScreen} />
      <Tab.Screen name="Me" component={MeScreen} />
    </Tab.Navigator>
  );
}
