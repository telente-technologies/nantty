import { socialEventTypes } from "../../../events/eventTypes.event.js";
import type { EventActor } from "../../../events/actor.event.js";
import { appendDomainEventsToOutbox, type DomainEventInput } from "../../../events/outbox.event.js";
import type { Db } from "../../../types/database.type.js";
import { postTagRepository } from "../repositories/postTag.repository.js";

export interface PostTagWriteInput {
  readonly postId: string;
  readonly kind: string;
  readonly authorId: string;
  readonly actor: EventActor;
  readonly desiredUserIds: readonly string[];
  readonly now: Date;
}

export async function syncPostTags(db: Db, input: PostTagWriteInput): Promise<void> {
  const current = new Set(await postTagRepository.userIdsFor(db, input.postId));
  const desired = new Set(input.desiredUserIds);
  const added = [...desired].filter((id) => !current.has(id));
  const removed = [...current].filter((id) => !desired.has(id));
  if (removed.length > 0) await postTagRepository.removeMany(db, input.postId, removed);
  if (added.length === 0) return;
  await postTagRepository.addMany(db, input.postId, input.authorId, added);
  const url = input.kind === "clip" ? `/clips/${input.postId}` : `/post/${input.postId}`;
  const events: DomainEventInput[] = added.map((userId) => ({
    eventType: socialEventTypes.postTagged,
    subject: input.postId,
    occurredAt: input.now,
    data: { recipientUserId: userId, taggedUserId: userId, actor: input.actor, authorId: input.authorId, postId: input.postId, kind: input.kind, url },
  }));
  await appendDomainEventsToOutbox(db, events);
}
