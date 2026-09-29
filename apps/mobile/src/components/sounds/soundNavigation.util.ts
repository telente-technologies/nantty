import type { NavigationProp } from "@react-navigation/native";

import type { MainStackParamList } from "@/navigation/navigation.types";
import type { ID } from "@/types";

type NavigatorThatCanOpenMainScreens = Pick<NavigationProp<MainStackParamList>, "navigate">;

export function openUserProfileOrMyProfile(navigation: NavigatorThatCanOpenMainScreens, userId: ID, signedInUserId: ID | null | undefined) {
  if (signedInUserId && userId === signedInUserId) navigation.navigate("Tabs", { screen: "Me" });
  else navigation.navigate("UserProfile", { userId });
}

export function openSoundScreen(navigation: NavigatorThatCanOpenMainScreens, soundId: ID) {
  navigation.navigate("Sound", { soundId });
}
