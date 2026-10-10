import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { profileQueryKeys } from "@/components/profile/profileQueries.hook";
import { usersService } from "@/services/account/users.service";
import type { AccountSettings } from "@/types/account.type";

export function useAccountSettingsQuery() {
  return useQuery({ queryKey: profileQueryKeys.settings, queryFn: usersService.fetchMyAccountSettings });
}

export function useUpdateAccountSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update: Partial<AccountSettings>) => usersService.updateMyAccountSettings(update),
    onSuccess: (settings) => queryClient.setQueryData(profileQueryKeys.settings, settings),
  });
}
