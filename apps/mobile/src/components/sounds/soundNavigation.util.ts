import type { NavigationProp, ParamListBase } from "@react-navigation/native";

import type { ID } from "@/types";

export function openUserProfileOrMyProfile(navigation: NavigationProp<ParamListBase>, userId: ID, signedInUserId: ID | null | undefined) {
  if (signedInUserId && userId === signedInUserId) navigation.navigate("Tabs", { screen: "Me" });
  else navigation.navigate("UserProfile", { userId });
}

export function openSoundScreen(navigation: NavigationProp<ParamListBase>, soundId: ID) {
  navigation.navigate("Sound", { soundId });
}
