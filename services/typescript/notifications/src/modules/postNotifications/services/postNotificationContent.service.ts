import type { DomainEventEnvelope } from "../../../types/domainEvent.type.js";
import type { ActorSummary, NotificationIntent } from "../../../types/notification.type.js";
import type { PostNotificationScope } from "../../../interfaces/postNotificationSubscribers.interface.js";
import { EventDataReader } from "../../../utils/eventDataReader.util.js";

export interface PostNotificationContent {
  readonly kind: "post" | "clip" | "live";
  readonly targetId: string;
  readonly title: string | null;
  readonly author: ActorSummary & { readonly username: string };
}

export interface PostNotificationFanoutJob {
  readonly eventId: string;
  readonly scope: PostNotificationScope;
  readonly authorId: string;
  readonly cursor: string | null;
  readonly content: PostNotificationContent;
}

export type AuthorLookup = (accountId: string) => Promise<{ readonly username: string } | null>;

export async function planPostNotificationFanout(event: DomainEventEnvelope, lookupAuthor: AuthorLookup): Promise<PostNotificationFanoutJob | null> {
  const data = new EventDataReader(event.data);
  if (event.type === "post.created") {
    const kind = data.optionalText("kind");
    if (kind !== "post" && kind !== "clip") return null;
    if (data.bool("isVideoReply") || data.optionalText("visibility") !== "public" || data.optionalText("authorProfileId") !== undefined) return null;
    const authorId = data.optionalText("authorId");
    const postId = data.optionalText("postId");
    if (authorId === undefined || postId === undefined) return null;
    const author = await lookupAuthor(authorId);
    if (author === null || author.username === "") return null;
    return { eventId: event.id, scope: "posts", authorId, cursor: null, content: { kind, targetId: postId, title: null, author: { id: authorId, name: author.username, username: author.username } } };
  }
  if (event.type === "live.started") {
    if (data.optionalText("visibility") === "subscribers") return null;
    const hostId = data.optionalText("hostId");
    const liveId = data.optionalText("liveId");
    const handle = data.optionalText("hostHandle") ?? data.optionalObject("host")?.optionalText("username");
    if (hostId === undefined || liveId === undefined || handle === undefined) return null;
    const host = data.optionalObject("host");
    const avatarUrl = host?.optionalText("avatarUrl");
    return {
      eventId: event.id, scope: "lives", authorId: hostId, cursor: null,
      content: { kind: "live", targetId: liveId, title: data.text("title", ""), author: { id: hostId, name: data.text("hostName", handle), username: handle, ...(avatarUrl === undefined ? {} : { avatarUrl }) } },
    };
  }
  return null;
}

export function postNotificationIntent(job: PostNotificationFanoutJob, recipientUserId: string): NotificationIntent {
  const { content } = job;
  const handle = `@${content.author.username}`;
  if (content.kind === "live") {
    const body = content.title === null || content.title === "" ? "is live." : `is live: ${content.title}`;
    const data = { liveId: content.targetId, url: `/live/${content.targetId}` };
    return {
      eventId: job.eventId, recipientUserId, preferenceCategory: "live",
      inApp: { category: "social", title: handle, body, actor: content.author, data },
      push: { title: `${handle} is live`, body: content.title === null || content.title === "" ? "Tap to watch." : content.title, data },
    };
  }
  const url = content.kind === "clip" ? `/clips/${content.targetId}` : `/post/${content.targetId}`;
  const body = `posted a new ${content.kind}.`;
  const data = { url, postId: content.targetId };
  return {
    eventId: job.eventId, recipientUserId, preferenceCategory: "social",
    inApp: { category: "social", title: handle, body, actor: content.author, data },
    push: { title: `${handle} posted a new ${content.kind}`, body: content.kind === "clip" ? "Tap to watch." : "Tap to see it.", data },
  };
}
