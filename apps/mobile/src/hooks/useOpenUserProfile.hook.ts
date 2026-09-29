import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useCallback } from "react";

import type { MainStackParamList } from "@/navigation/navigation.types";
import { useAuthStore } from "@/store/auth.store";

export function navigateToUserProfileOrMyProfile(navigation: NavigationProp<MainStackParamList>, userId: string, signedInUserId: string | null) {
  if (signedInUserId && userId === signedInUserId) navigation.navigate("Tabs", { screen: "Me" });
  else navigation.navigate("UserProfile", { userId });
}

export function useOpenUserProfile() {
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();
  const signedInUserId = useAuthStore((state) => state.user?.id ?? null);
  return useCallback((userId: string) => navigateToUserProfileOrMyProfile(navigation, userId, signedInUserId), [navigation, signedInUserId]);
}
