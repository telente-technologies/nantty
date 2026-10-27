import type { Logger } from "@nantty/fastify-platform";

import { widgetRefreshFanoutJobType } from "../../../../constants/delivery.constant.js";
import type { JobQueue } from "../../../../interfaces/jobQueue.interface.js";
import type { PostNotificationSubscriberSource } from "../../../../interfaces/postNotificationSubscribers.interface.js";
import type { PushSender } from "../../../../interfaces/pushSender.interface.js";
import type { DeliveryRepository, DeviceTokenRepository } from "../../../../interfaces/repositories.interface.js";
import type { DomainEventEnvelope } from "../../../../types/domainEvent.type.js";
import { planWidgetRefresh, widgetRefreshDedupeKey, type WidgetRefreshTarget } from "../../services/widgetRefreshPlanner.service.js";

export interface WidgetRefreshFanoutJob {
  readonly eventId: string;
  readonly authorId: string;
  readonly cursor: string | null;
}

export interface WidgetRefreshDependencies {
  readonly deliveries: DeliveryRepository;
  readonly deviceTokens: DeviceTokenRepository;
  readonly pushSender: PushSender;
  readonly jobQueue: JobQueue;
  readonly jobsQueueUrl: string;
  readonly storyAudience: PostNotificationSubscriberSource | null;
  readonly batchSize: number;
  readonly maximumDirectRecipients: number;
  readonly logger: Logger;
  readonly now?: () => Date;
}

export class SendWidgetRefreshHandler {
  public constructor(private readonly deps: WidgetRefreshDependencies) {}

  public async refreshFromEvent(event: DomainEventEnvelope): Promise<number> {
    const plan = planWidgetRefresh(event, this.deps.maximumDirectRecipients);
    let sent = 0;
    for (const target of plan.targets) sent += await this.refresh(event.id, target);
    if (plan.storyAuthorId !== null && this.deps.storyAudience !== null) {
      await this.deps.jobQueue.send(this.deps.jobsQueueUrl, { type: widgetRefreshFanoutJobType, eventId: event.id, authorId: plan.storyAuthorId, cursor: null });
    }
    return sent;
  }

  public async runFanout(job: WidgetRefreshFanoutJob): Promise<number> {
    if (this.deps.storyAudience === null) return 0;
    const page = await this.deps.storyAudience.listPage(job.authorId, "posts", job.cursor, this.deps.batchSize);
    let sent = 0;
    for (const entry of page.data) if (entry.userId !== job.authorId) sent += await this.refresh(job.eventId, { userId: entry.userId, widget: "stories" });
    if (page.nextCursor !== null) await this.deps.jobQueue.send(this.deps.jobsQueueUrl, { type: widgetRefreshFanoutJobType, ...job, cursor: page.nextCursor });
    return sent;
  }

  private async refresh(eventId: string, target: WidgetRefreshTarget): Promise<number> {
    const now = (this.deps.now ?? (() => new Date()))();
    const claim = await this.deps.deliveries.claim({ dedupeKey: widgetRefreshDedupeKey(target, now), eventId, userId: target.userId, channel: "push", templateKey: null, mailKind: null });
    if (claim.alreadyProcessed) return 0;
    const tokens = await this.deps.deviceTokens.listTokens(target.userId);
    if (tokens.length === 0) {
      await this.deps.deliveries.finish(claim.id, "skipped", { skipReason: "no_device_tokens" });
      return 0;
    }
    try {
      await this.deps.pushSender.sendSilent(tokens, { type: "widgetRefresh", widgets: [target.widget] });
      await this.deps.deliveries.finish(claim.id, "sent", {});
      return 1;
    } catch (error) {
      this.deps.logger.warn("widget refresh push failed", { widget: target.widget, error: error instanceof Error ? error.message : String(error) });
      await this.deps.deliveries.finish(claim.id, "failed", { skipReason: "widget_refresh_failed" });
      return 0;
    }
  }
}

export function parseWidgetRefreshFanoutJob(job: Readonly<Record<string, unknown>>): WidgetRefreshFanoutJob | null {
  const eventId = job["eventId"];
  const authorId = job["authorId"];
  const cursor = job["cursor"];
  if (typeof eventId !== "string" || eventId === "" || typeof authorId !== "string" || authorId === "") return null;
  return { eventId, authorId, cursor: typeof cursor === "string" ? cursor : null };
}
