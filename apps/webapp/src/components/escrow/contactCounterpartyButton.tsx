"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { messagesService } from "@/services/messages.service";

export function ContactCounterpartyButton({ userId, label }: { readonly userId: string; readonly label: string }) {
  const router = useRouter();
  const startConversation = useMutation({
    mutationFn: () => messagesService.startConversationWithUser(userId),
    onSuccess: (conversation) => router.push(`/chats/${encodeURIComponent(conversation.id)}`),
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error) }),
  });
  return (
    <Button variant="secondary" busy={startConversation.isPending} onClick={() => { if (!startConversation.isPending) startConversation.mutate(); }}>
      {label}
    </Button>
  );
}
