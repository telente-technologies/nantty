import type { Logger } from "@zudojs/logger";

import { MissingEventFieldError } from "../../../../errors/notifications.error.js";
import { EventDataReader } from "../../../../utils/eventDataReader.util.js";
import type { NotificationDispatcherService } from "../../../delivery/services/notificationDispatcher.service.js";
import { eventMappings } from "../../mappings/eventMappingRegistry.js";
import type { MappingContext } from "../../mappings/mappingHelpers.js";
import type { HandleDomainEventCommand, HandleDomainEventResult } from "./handleDomainEvent.command.js";

export interface PolicyPublishedPort {
  handlePolicyPublished(command: HandleDomainEventCommand): Promise<void>;
}

export interface SupportInboxPort {
  notifyTicketCreated(event: HandleDomainEventCommand["event"]): Promise<readonly string[]>;
}

export interface PostNotificationFanoutPort {
  startFromEvent(event: HandleDomainEventCommand["event"]): Promise<boolean>;
}

export interface WidgetRefreshPort {
  refreshFromEvent(event: HandleDomainEventCommand["event"]): Promise<number>;
}

export interface RemovedContentPort {
  deleteForContent(contentId: string): Promise<number>;
}

const postNotificationEventTypes = new Set(["post.created", "live.started"]);

export class HandleDomainEventHandler {
  public constructor(
    private readonly dispatcher: NotificationDispatcherService,
    private readonly policyPublished: PolicyPublishedPort,
    private readonly mappingContext: MappingContext,
    private readonly logger: Logger,
    private readonly supportInbox?: SupportInboxPort,
    private readonly postNotifications?: PostNotificationFanoutPort,
    private readonly widgetRefresh?: WidgetRefreshPort,
    private readonly removedContent?: RemovedContentPort,
  ) {}

  public async execute(command: HandleDomainEventCommand): Promise<HandleDomainEventResult> {
    const { event } = command;
    if (event.type === "policyVersion.published") {
      await this.policyPublished.handlePolicyPublished(command);
      return { handled: true, intents: 0 };
    }
    await this.refreshWidgetsQuietly(event);
    if (event.type === "post.deleted") return this.forgetDeletedPost(event);
    if (event.data["notificationsMuted"] === true) return { handled: true, intents: 0, reason: "post_notifications_muted" };
    const fanoutStarted = postNotificationEventTypes.has(event.type) && this.postNotifications !== undefined ? await this.postNotifications.startFromEvent(event) : false;
    const mapping = eventMappings[event.type];
    if (mapping === undefined) return fanoutStarted ? { handled: true, intents: 0, reason: "post_notification_fanout" } : { handled: false, intents: 0, reason: "unhandled_event_type" };
    let intents;
    try {
      intents = mapping(event, new EventDataReader(event.data), this.mappingContext);
    } catch (error) {
      if (!(error instanceof MissingEventFieldError)) throw error;
      this.logger.warn("event dropped: incomplete payload", { eventId: event.id, type: event.type, field: error.fieldPath });
      return { handled: false, intents: 0, reason: "incomplete_event_data" };
    }
    for (const intent of intents) await this.dispatcher.dispatch(intent);
    if (event.type === "ticket.created") await this.supportInbox?.notifyTicketCreated(event);
    return { handled: true, intents: intents.length };
  }

  private async forgetDeletedPost(event: HandleDomainEventCommand["event"]): Promise<HandleDomainEventResult> {
    const postId = event.data["postId"];
    if (typeof postId !== "string" || postId === "" || this.removedContent === undefined) return { handled: false, intents: 0, reason: "unhandled_event_type" };
    await this.removedContent.deleteForContent(postId);
    return { handled: true, intents: 0, reason: "content_deleted" };
  }

  private async refreshWidgetsQuietly(event: HandleDomainEventCommand["event"]): Promise<void> {
    if (this.widgetRefresh === undefined) return;
    try {
      await this.widgetRefresh.refreshFromEvent(event);
    } catch (error) {
      this.logger.warn("widget refresh skipped", { eventId: event.id, type: event.type, error: error instanceof Error ? error.message : String(error) });
    }
  }
}
