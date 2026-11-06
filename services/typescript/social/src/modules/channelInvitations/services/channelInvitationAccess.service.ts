import { forbidden } from "../../../errors/social.error.js";
import type { MemberAccess } from "../../conversations/services/conversationAccess.service.js";

export function requireChannelAdmin(access: MemberAccess): void {
  if (access.conversation.kind !== "channel") throw forbidden("NOT_A_CHANNEL", "This action is only available for channels.");
  if (access.member.role !== "owner" && access.member.role !== "admin") {
    throw forbidden("NOT_CHANNEL_ADMIN", "Only channel owners and admins can manage invitation links.");
  }
}
