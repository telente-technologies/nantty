import type { LocalMessageDeliveryStatus } from "@/cache/messageHistory.type";
import type { Message } from "@/types";

import { DocumentBubble } from "./documentBubble";
import { LocationBubble } from "./locationBubble";
import { PollBubble } from "./pollBubble";

export const isRichMessage = (message: Message) =>
  (!!message.location && (message.kind === "location" || message.kind === "liveLocation")) ||
  (message.kind === "document" && !!message.document) ||
  (message.kind === "poll" && !!message.poll);

export interface RichMessageContentProps {
  readonly message: Message;
  readonly isMine: boolean;
  readonly deliveryStatus: LocalMessageDeliveryStatus;
  readonly isMediaExpired: boolean;
  readonly onRetryDocument?: () => void;
  readonly onDiscardDocument?: () => void;
}

export function RichMessageContent({ message, isMine, deliveryStatus, isMediaExpired, onRetryDocument, onDiscardDocument }: RichMessageContentProps) {
  if (message.kind === "document") {
    return <DocumentBubble message={message} deliveryStatus={deliveryStatus} isExpired={isMediaExpired} onRetry={onRetryDocument} onDiscard={onDiscardDocument} />;
  }
  if (message.kind === "poll") return <PollBubble message={message} deliveryStatus={deliveryStatus} />;
  return <LocationBubble message={message} isMine={isMine} />;
}
