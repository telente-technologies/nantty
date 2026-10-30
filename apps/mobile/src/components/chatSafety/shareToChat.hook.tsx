import * as Clipboard from "expo-clipboard";
import { useState } from "react";

import { ChatTeardropText24Icon, Link24Icon, ShareFat24Icon } from "@/components/icons";
import { ActionSheet } from "@/components/ui/actionSheet";
import { webAppLinks } from "@/config/webAppLinks.config";
import { showToast } from "@/store/toast.store";
import type { SharedContentReference } from "@/types";
import { requireAuthThen } from "@/utils/requireAuth.util";

import { SendInChatSheet } from "./sendInChatSheet";

const SHEET_HANDOFF_MS = 350;

export const shareUrlForReference = (target: SharedContentReference): string => {
  switch (target.kind) {
    case "product":
      return webAppLinks.product({ id: target.id });
    case "store":
      return webAppLinks.store(target.id);
    case "live":
      return webAppLinks.live(target.id);
    case "space":
      return webAppLinks.space(target.id);
    case "profile":
      return webAppLinks.profile(target.id);
    default:
      return webAppLinks.post(target.id);
  }
};

const copyLinkFor = (target: SharedContentReference) =>
  Clipboard.setStringAsync(shareUrlForReference(target))
    .then(() => showToast("Link copied", { tone: "success" }))
    .catch(() => showToast("Couldn't copy the link", { tone: "error" }));

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
        { label: "Copy link", icon: <Link24Icon size={20} />, onPress: () => void copyLinkFor(offer.target) },
        ...(offer.shareElsewhere ? [{ label: "Share link", icon: <ShareFat24Icon size={20} />, onPress: () => afterSheetCloses(() => offer.shareElsewhere?.()) }] : []),
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
