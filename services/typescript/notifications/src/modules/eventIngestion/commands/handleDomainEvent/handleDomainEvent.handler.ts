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

export class HandleDomainEventHandler {
  public constructor(
    private readonly dispatcher: NotificationDispatcherService,
    private readonly policyPublished: PolicyPublishedPort,
    private readonly mappingContext: MappingContext,
    private readonly logger: Logger,
    private readonly supportInbox?: SupportInboxPort,
  ) {}

  public async execute(command: HandleDomainEventCommand): Promise<HandleDomainEventResult> {
    const { event } = command;
    if (event.type === "policyVersion.published") {
      await this.policyPublished.handlePolicyPublished(command);
      return { handled: true, intents: 0 };
    }
    if (event.data["notificationsMuted"] === true) return { handled: true, intents: 0, reason: "post_notifications_muted" };
    const mapping = eventMappings[event.type];
    if (mapping === undefined) return { handled: false, intents: 0, reason: "unhandled_event_type" };
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
}
