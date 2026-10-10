import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Dialog } from "@/components/ui/dialog";
import { messagesService } from "@/services/chat/messages.service";
import type { Conversation } from "@/types";

export interface ChatBlockDialogProps {
  readonly visible: boolean;
  readonly conversation: Conversation;
  readonly onClose: () => void;
  readonly onBlocked: () => void;
}

export function ChatBlockDialog({ visible, conversation, onClose, onBlocked }: ChatBlockDialogProps) {
  const queryClient = useQueryClient();
  const block = useMutation({
    mutationFn: () => messagesService.blockConversationPeer(conversation.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversation"] });
      queryClient.invalidateQueries({ queryKey: ["users", "me", "blocked"] });
      onClose();
      onBlocked();
    },
  });
  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      tone="destructive"
      title={`Block ${conversation.peer.name}?`}
      message="They won't be able to message you. You can unblock them in chat settings. They won't be told you blocked them."
      actions={[
        { label: "Block", style: "destructive", loading: block.isPending, onPress: () => block.mutate() },
        { label: "Cancel", style: "secondary", onPress: onClose },
      ]}
    />
  );
}
