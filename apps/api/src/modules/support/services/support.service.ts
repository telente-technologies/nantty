import type { EventBus } from "@zudojs/events";

import { notFound, unprocessable } from "../../../errors/domain.error.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { MediaLibrary } from "../../../interfaces/mediaLibrary.interface.js";
import type { Principal } from "../../../interfaces/principal.interface.js";
import type { SupportInbox } from "../../../interfaces/supportInbox.interface.js";
import type { UserDirectory } from "../../../interfaces/userDirectory.interface.js";
import type { AppLogger } from "../../../loggers/app.logger.js";
import type { FieldCipher } from "../../../utils/crypto.util.js";
import type { SupportTicketDetailDto, SupportTicketMessageDto } from "../dtos/support.dto.js";
import { convertTicketToSummary } from "../dtos/support.dto.js";
import type { SupportMessageRecord, SupportTicketRecord } from "../models/support.model.js";
import type { ContactRequestsRepository, SupportTicketsRepository } from "../repositories/support.repository.js";

export interface SupportDependencies {
  readonly tickets: SupportTicketsRepository;
  readonly contactRequests: ContactRequestsRepository;
  readonly userDirectory: UserDirectory;
  readonly mediaLibrary: MediaLibrary;
  readonly supportInbox: SupportInbox;
  readonly audit: AuditRecorder;
  readonly events: EventBus;
  readonly cipher: FieldCipher;
  readonly clock: Clock;
  readonly logger: AppLogger;
}

const SUPPORT_TEAM_NAME = "Zudomart Support";

export class SupportService {
  public constructor(public readonly dependencies: SupportDependencies) {}

  public async requireTicketForViewer(ticketId: string, principal: Principal, asAgent: boolean): Promise<SupportTicketRecord> {
    const ticket = await this.dependencies.tickets.findTicket(ticketId);
    if (ticket === undefined) throw notFound("Support ticket");
    if (!asAgent && ticket.requesterId !== principal.userId) throw notFound("Support ticket");
    return ticket;
  }

  public async assertAttachmentsBelongTo(mediaIds: readonly string[], ownerId: string): Promise<void> {
    if (mediaIds.length === 0) return;
    const items = await this.dependencies.mediaLibrary.findMediaByIds(mediaIds);
    const usable = items.filter((item) => item.ownerId === ownerId && item.status !== "failed");
    if (usable.length !== new Set(mediaIds).size) throw unprocessable("Attach only files you uploaded.");
  }

  public async notifySupportTeamSafely(subject: string, text: string, topic: "support_ticket" | "contact" | "legal" | "copyright", replyTo?: string): Promise<void> {
    try {
      await this.dependencies.supportInbox.notifySupportTeam({ topic, subject, text, ...(replyTo === undefined ? {} : { replyTo }) });
    } catch (error) {
      this.dependencies.logger.warn("The support team email failed", { topic, error: error instanceof Error ? error.message : String(error) });
    }
  }

  public async presentTicket(ticket: SupportTicketRecord, viewerId: string): Promise<SupportTicketDetailDto> {
    const messages = await this.dependencies.tickets.listMessages(ticket.id);
    return { ...convertTicketToSummary(ticket), messages: await this.presentMessages(messages, viewerId) };
  }

  public async presentMessages(messages: readonly SupportMessageRecord[], viewerId: string): Promise<readonly SupportTicketMessageDto[]> {
    const { userDirectory, mediaLibrary } = this.dependencies;
    const authorIds = [...new Set(messages.filter((message) => !message.fromSupport).map((message) => message.authorId))];
    const [authors, media] = await Promise.all([
      userDirectory.findUserSummaries(authorIds),
      mediaLibrary.findMediaByIds([...new Set(messages.flatMap((message) => message.attachmentMediaIds))]),
    ]);
    const urls = new Map(media.map((item) => [item.id, item.url]));
    return messages.map((message) => {
      const author = authors.find((candidate) => candidate.id === message.authorId);
      const attachments = message.attachmentMediaIds.map((id) => ({ id, url: urls.get(id) ?? null }));
      return {
        id: message.id,
        fromSupport: message.fromSupport,
        authorName: message.fromSupport ? SUPPORT_TEAM_NAME : message.authorId === viewerId ? "You" : (author?.name ?? "Customer"),
        text: message.text,
        attachments,
        attachmentUrls: attachments.flatMap((attachment) => (attachment.url === null ? [] : [attachment.url])),
        createdAt: message.createdAt.toISOString(),
      };
    });
  }
}
