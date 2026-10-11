"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { messagesService } from "@/services/messages.service";

export function MessageStoreButton({ storeId, storeName, label = "Message" }: { readonly storeId: string; readonly storeName: string; readonly label?: string }) {
  const router = useRouter();
  const open = useMutation({
    mutationFn: () => messagesService.openStoreConversation(storeId),
    onSuccess: (conversation) => router.push(`/chats/${encodeURIComponent(conversation.id)}`),
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error) }),
  });
  return (
    <Button size="sm" variant="secondary" busy={open.isPending} onClick={() => requireAuthThen(() => { if (!open.isPending) open.mutate(); }, `Sign in to message ${storeName}.`)}>
      {label}
    </Button>
  );
}
