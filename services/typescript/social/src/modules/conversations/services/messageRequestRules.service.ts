import type { MessageRequestAudience } from "../../chatSettings/models/chatSettings.model.js";
import type { InboxFolderName } from "../models/conversation.model.js";

export interface MessageRoutingInput {
  readonly audience: MessageRequestAudience;
  readonly recipientFollowsSender: boolean;
  readonly senderFollowsRecipient: boolean;
  readonly blockedEitherWay: boolean;
  readonly senderFlaggedAsSpam: boolean;
}

export type MessageRoutingDecision =
  | { readonly kind: "refused"; readonly reason: "BLOCKED" | "REQUESTS_CLOSED" }
  | { readonly kind: "deliver"; readonly folder: InboxFolderName };

export function decideMessageRouting(input: MessageRoutingInput): MessageRoutingDecision {
  if (input.blockedEitherWay) return { kind: "refused", reason: "BLOCKED" };
  if (input.recipientFollowsSender) return { kind: "deliver", folder: "chats" };
  const mayRequest = input.audience === "everyone" || (input.audience === "followers" && input.senderFollowsRecipient);
  if (!mayRequest) return { kind: "refused", reason: "REQUESTS_CLOSED" };
  return { kind: "deliver", folder: input.senderFlaggedAsSpam ? "spam" : "requests" };
}

export function isRequestVisibleToRecipient(audience: MessageRequestAudience, recipientFollowsSender: boolean, senderFollowsRecipient: boolean): boolean {
  if (recipientFollowsSender) return true;
  if (audience === "everyone") return true;
  return audience === "followers" && senderFollowsRecipient;
}
