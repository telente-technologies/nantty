import { useMutation } from "@tanstack/react-query";

import { ChatCircle24Icon, UserCircle24Icon, Warning20Icon } from "@/components/icons";
import { ActionSheet, type ActionSheetOption } from "@/components/ui/actionSheet";
import { followsService } from "@/services/social/follows.service";
import { showToast } from "@/store/toast.store";
import type { ConnectionEntry } from "@/types/account.type";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { requireAuthAfterClosingModal } from "@/utils/requireAuth.util";

export interface ConnectionOptionsSheetProps {
  readonly entry: ConnectionEntry | null;
  readonly isBlockedTab: boolean;
  readonly onClose: () => void;
  readonly onOpenProfile: (userId: string) => void;
  readonly onMessage: (entry: ConnectionEntry) => void;
  readonly onRelationshipChanged: () => void;
}

export function ConnectionOptionsSheet({ entry, isBlockedTab, onClose, onOpenProfile, onMessage, onRelationshipChanged }: ConnectionOptionsSheetProps) {
  const block = useMutation({
    mutationFn: (target: ConnectionEntry) => (isBlockedTab ? followsService.unblockUser(target.id) : followsService.blockUser(target.id)),
    onSuccess: () => {
      showToast(isBlockedTab ? "Unblocked" : "Blocked");
      onRelationshipChanged();
    },
    onError: () => showToast(isBlockedTab ? "Couldn't unblock. Try again." : "Couldn't block. Try again."),
  });
  if (!entry) return null;
  const confirmBlock = () =>
    showAlertWithButtons(`Block ${entry.name}?`, "They won't be able to find your profile, see your posts or message you. They won't be told you blocked them.", [
      { text: "Cancel", style: "cancel" },
      { text: "Block", style: "destructive", onPress: () => block.mutate(entry) },
    ]);
  const options: ActionSheetOption[] = [
    { label: "View profile", icon: <UserCircle24Icon />, onPress: () => onOpenProfile(entry.id) },
    ...(isBlockedTab ? [] : [{ label: "Send message", icon: <ChatCircle24Icon />, onPress: () => requireAuthAfterClosingModal(onClose, () => onMessage(entry), "send messages") }]),
    {
      label: isBlockedTab ? `Unblock ${entry.name}` : `Block ${entry.name}`,
      icon: <Warning20Icon size={22} />,
      destructive: !isBlockedTab,
      onPress: () => requireAuthAfterClosingModal(onClose, isBlockedTab ? () => block.mutate(entry) : confirmBlock, "block accounts"),
    },
  ];
  return <ActionSheet visible onClose={onClose} options={options} title={`@${entry.username}`} />;
}
