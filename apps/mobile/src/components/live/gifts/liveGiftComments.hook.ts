import { useState } from "react";

import type { LiveComment, UserSummary } from "@/types";

import { useLiveGiftCatalog } from "./liveGiftCatalog.hook";
import { useLiveGiftSentEvents } from "./liveGiftEventStream.hook";

const MAXIMUM_GIFT_COMMENTS = 40;

export function useLiveGiftComments(liveId: string, recipients: readonly UserSummary[]) {
  const [giftComments, setGiftComments] = useState<readonly LiveComment[]>([]);
  const { giftsById } = useLiveGiftCatalog();
  useLiveGiftSentEvents(liveId, (event) => {
    const giftName = giftsById.get(event.giftId)?.name ?? "a gift";
    const recipient = recipients.find((user) => user.id === event.receiverUserId) ?? recipients[0];
    const commentId = `gift_${event.sender.id}_${event.comboId}`;
    const comment: LiveComment = {
      id: commentId,
      author: { id: event.sender.id, name: event.sender.name, username: event.sender.id, avatarUrl: event.sender.avatarUrl, verified: false },
      text: `sent ${giftName}${event.comboCount > 1 ? ` ×${event.comboCount}` : ""}${recipient ? ` to @${recipient.username}` : ""}`,
      kind: "gift",
    };
    setGiftComments((existing) => [...existing.filter((item) => item.id !== commentId), comment].slice(-MAXIMUM_GIFT_COMMENTS));
  });
  return giftComments;
}
