import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { useHydrateSignedInUser } from "@/components/profile/profileQueries.hook";
import { usersService } from "@/services/account/users.service";
import { useAuthStore } from "@/store/auth.store";
import { useThemePreferenceStore } from "@/store/themePreference.store";

export function AccountThemePreferenceSync() {
  useHydrateSignedInUser();
  const userId = useAuthStore((state) => state.status === "signedIn" ? state.user?.id : undefined);
  const query = useQuery({
    queryKey: ["users", userId, "settings", "theme"],
    enabled: Boolean(userId),
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const localChoiceVersion = useThemePreferenceStore.getState().localChoiceVersion;
      const settings = await usersService.fetchMyAccountSettings();
      return { userId, preference: settings.theme, localChoiceVersion };
    },
  });

  useEffect(() => {
    const result = query.data;
    if (!userId || result?.userId !== userId) return;
    useThemePreferenceStore.getState().applyAccountPreference(result.preference, result.localChoiceVersion);
  }, [query.data, userId]);

  return null;
}
