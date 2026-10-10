import { useState } from "react";

import { ChatTeardropText24Icon, Share24Icon } from "@/components/icons";
import { ActionSheet } from "@/components/ui/actionSheet";
import type { SharedContentReference } from "@/types";
import { requireAuthThen } from "@/utils/requireAuth.util";

import { SendInChatSheet } from "./sendInChatSheet";

const SHEET_HANDOFF_MS = 350;

interface ShareOffer {
  readonly target: SharedContentReference;
  readonly shareElsewhere?: () => void;
}

export function useShareToChat() {
  const [reference, setReference] = useState<SharedContentReference | null>(null);
  const [offer, setOffer] = useState<ShareOffer | null>(null);
  const afterSheetCloses = (action: () => void) => setTimeout(action, SHEET_HANDOFF_MS);
  const options = offer
    ? [
        { label: "Send in chat", icon: <ChatTeardropText24Icon size={20} />, onPress: () => afterSheetCloses(() => requireAuthThen(() => setReference(offer.target), undefined, "send this in chat")) },
        ...(offer.shareElsewhere ? [{ label: "Share link", icon: <Share24Icon size={20} />, onPress: () => afterSheetCloses(() => offer.shareElsewhere?.()) }] : []),
      ]
    : [];
  const sendInChatElement = (
    <>
      <ActionSheet visible={!!offer} onClose={() => setOffer(null)} title="Share" options={options} />
      <SendInChatSheet reference={reference} onClose={() => setReference(null)} />
    </>
  );
  const offerSendInChat = (target: SharedContentReference, shareElsewhere?: () => void) => setOffer({ target, shareElsewhere });
  return { offerSendInChat, openSendInChat: setReference, sendInChatElement };
}
