import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import { conversationUpdatedEvent } from "../../../messages/services/chatRealtimeEvents.service.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { conversationRepository } from "../../repositories/conversation.repository.js";
import { requireConversationMember } from "../../services/conversationAccess.service.js";
import type { MuteConversationCommand, MuteDuration } from "./muteConversation.command.js";

const durationMilliseconds: Record<"8h" | "1w", number> = { "8h": 8 * 3_600_000, "1w": 7 * 86_400_000 };

export function resolveMuteUntil(duration: MuteDuration, now: Date): { readonly mutedUntil: Date | null; readonly mutedAlways: boolean } {
  if (duration === "off") return { mutedUntil: null, mutedAlways: false };
  if (duration === "always") return { mutedUntil: null, mutedAlways: true };
  return { mutedUntil: new Date(now.getTime() + durationMilliseconds[duration]), mutedAlways: false };
}

export function createMuteConversationHandler(context: HandlerContext): Handler<MuteConversationCommand, { readonly mutedUntil: string | null }> {
  return async ({ viewerId, conversationId, duration }) => {
    await requireConversationMember(context.database.client, conversationId, viewerId);
    const mute = resolveMuteUntil(duration, context.clock.now());
    await conversationRepository.updateMember(context.database.client, conversationId, viewerId, mute);
    await appendDomainEventsToOutbox(context.database.client, [conversationUpdatedEvent(conversationId, { mutedUntil: mute.mutedUntil?.toISOString() ?? null, mutedAlways: mute.mutedAlways }, context.clock.now(), { accountId: viewerId })]);
    return { mutedUntil: mute.mutedAlways ? "always" : (mute.mutedUntil?.toISOString() ?? null) };
  };
}
