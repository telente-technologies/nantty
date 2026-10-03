import { useState } from "react";

import type { SharedContentReference } from "@/types";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { requireAuthThen } from "@/utils/requireAuth.util";

import { SendInChatSheet } from "./sendInChatSheet";

export function useShareToChat() {
  const [reference, setReference] = useState<SharedContentReference | null>(null);
  const sendInChatElement = <SendInChatSheet reference={reference} onClose={() => setReference(null)} />;
  const offerSendInChat = (target: SharedContentReference, shareElsewhere?: () => void) =>
    showAlertWithButtons("Share", undefined, [
      { text: "Send in chat", onPress: () => requireAuthThen(() => setReference(target), undefined, "send this in chat") },
      ...(shareElsewhere ? [{ text: "Share link", onPress: shareElsewhere }] : []),
      { text: "Cancel", style: "cancel" as const },
    ]);
  return { offerSendInChat, openSendInChat: setReference, sendInChatElement };
}
