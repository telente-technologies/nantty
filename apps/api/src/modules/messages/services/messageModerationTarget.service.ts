import type { ContentEnforcementAction, ModerationTargetDescription, ModerationTargetGateway } from "../../../interfaces/moderationTargets.interface.js";
import type { MessagesService } from "./messages.service.js";

const SUMMARY_LENGTH = 140;

export class MessageModerationTarget implements ModerationTargetGateway {
  public readonly targetType = "message" as const;

  public constructor(private readonly messagesService: MessagesService) {}

  public async describeTarget(messageId: string): Promise<ModerationTargetDescription | undefined> {
    const message = await this.messagesService.dependencies.messages.findById(messageId);
    if (message === undefined || message.kind === "system") return undefined;
    return { ownerUserId: message.senderId, summary: message.kind === "voice" ? "Voice note" : message.text.slice(0, SUMMARY_LENGTH) };
  }

  public async isReportableBy(messageId: string, userId: string): Promise<boolean> {
    const message = await this.messagesService.dependencies.messages.findById(messageId);
    if (message === undefined) return false;
    return this.messagesService.requireConversationAccess(message.conversationId, userId).then(() => true, () => false);
  }

  public async applyContentAction(messageId: string, action: ContentEnforcementAction, decidedAt: Date): Promise<boolean> {
    const { messages, conversations } = this.messagesService.dependencies;
    const message = await messages.findById(messageId);
    if (message === undefined) return false;
    await messages.setHiddenAt(messageId, action === "restore" ? null : decidedAt);
    const conversation = await conversations.findById(message.conversationId);
    if (conversation !== undefined && action !== "restore") await this.messagesService.broadcaster.announceMessageRemoved(conversation, messageId);
    return true;
  }
}
