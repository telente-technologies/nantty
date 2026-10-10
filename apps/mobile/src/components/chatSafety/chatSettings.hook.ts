import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { chatSafetyService } from "@/services/chat/chatSafety.service";
import type { ChatSettings } from "@/types";

const CHAT_SETTINGS_QUERY_KEY = ["chat", "settings"] as const;

export function useChatSettingsQuery() {
  return useQuery({ queryKey: CHAT_SETTINGS_QUERY_KEY, queryFn: chatSafetyService.fetchChatSettings });
}

export function useUpdateChatSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update: Partial<ChatSettings>) => chatSafetyService.updateChatSettings(update),
    onSuccess: (settings) => {
      queryClient.setQueryData(CHAT_SETTINGS_QUERY_KEY, settings);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
