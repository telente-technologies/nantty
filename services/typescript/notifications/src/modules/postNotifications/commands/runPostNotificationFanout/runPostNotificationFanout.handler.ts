import { postNotificationDispatchConcurrency, postNotificationFanoutJobType } from "../../../../constants/delivery.constant.js";
import type { JobQueue } from "../../../../interfaces/jobQueue.interface.js";
import type { PostNotificationSubscriberSource } from "../../../../interfaces/postNotificationSubscribers.interface.js";
import type { NotificationDispatcherService } from "../../../delivery/services/notificationDispatcher.service.js";
import type { DomainEventEnvelope } from "../../../../types/domainEvent.type.js";
import { planPostNotificationFanout, postNotificationIntent, type AuthorLookup, type PostNotificationFanoutJob } from "../../services/postNotificationContent.service.js";

export interface RunPostNotificationFanoutDeps {
  readonly source: PostNotificationSubscriberSource;
  readonly dispatcher: Pick<NotificationDispatcherService, "dispatch">;
  readonly jobQueue: JobQueue;
  readonly jobsQueueUrl: string;
  readonly batchSize: number;
  readonly lookupAuthor: AuthorLookup;
}

export class RunPostNotificationFanoutHandler {
  public constructor(private readonly deps: RunPostNotificationFanoutDeps) {}

  public async startFromEvent(event: DomainEventEnvelope): Promise<boolean> {
    const job = await planPostNotificationFanout(event, this.deps.lookupAuthor);
    if (job === null) return false;
    await this.enqueue(job);
    return true;
  }

  public async enqueue(job: PostNotificationFanoutJob): Promise<void> {
    await this.deps.jobQueue.send(this.deps.jobsQueueUrl, { type: postNotificationFanoutJobType, ...job });
  }

  public async execute(job: PostNotificationFanoutJob): Promise<{ readonly recipients: number }> {
    const page = await this.deps.source.listPage(job.authorId, job.scope, job.cursor, this.deps.batchSize);
    const recipients = page.data.map((entry) => entry.userId).filter((userId) => userId !== job.authorId);
    for (let start = 0; start < recipients.length; start += postNotificationDispatchConcurrency) {
      await Promise.all(recipients.slice(start, start + postNotificationDispatchConcurrency).map((userId) => this.deps.dispatcher.dispatch(postNotificationIntent(job, userId))));
    }
    if (page.nextCursor !== null) await this.enqueue({ ...job, cursor: page.nextCursor });
    return { recipients: recipients.length };
  }
}

export function parsePostNotificationFanoutJob(job: Readonly<Record<string, unknown>>): PostNotificationFanoutJob | null {
  const content = job["content"] as Record<string, unknown> | null | undefined;
  const author = content?.["author"] as Record<string, unknown> | null | undefined;
  const text = (value: unknown) => typeof value === "string" && value !== "";
  if (!text(job["eventId"]) || !text(job["authorId"]) || (job["scope"] !== "posts" && job["scope"] !== "lives")) return null;
  if (content === null || content === undefined || !["post", "clip", "live"].includes(String(content["kind"])) || !text(content["targetId"])) return null;
  if (author === null || author === undefined || !text(author["id"]) || !text(author["username"])) return null;
  return job as unknown as PostNotificationFanoutJob;
}
