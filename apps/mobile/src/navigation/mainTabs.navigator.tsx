import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { HomeScreen } from "@/screens/home/home.screen";
import { ClipsScreen } from "@/screens/clips/clips.screen";
import { CreateScreen } from "@/screens/create/createPlaceholder.screen";
import { ChatsScreen } from "@/screens/messages/chats.screen";
import { MeScreen } from "@/screens/profile/myProfile.screen";
import { guestGateScreenLayout } from "@/components/auth/guestGate";
import { withScreenErrorBoundary } from "@/components/ui/errorBoundary";

import type { MainTabParamList } from "./navigation.types";
import { TabBar } from "./tabBar";

const Tab = createBottomTabNavigator<MainTabParamList>();
const tabScreenLayout = withScreenErrorBoundary(guestGateScreenLayout);

export function MainTabsNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} screenLayout={tabScreenLayout} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Clips" component={ClipsScreen} />
      <Tab.Screen name="Create" component={CreateScreen} />
      <Tab.Screen name="Chats" component={ChatsScreen} />
      <Tab.Screen name="Me" component={MeScreen} />
    </Tab.Navigator>
  );
}
