import { socialEventTypes } from "../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../events/outbox.event.js";
import type { SensitiveLabel } from "../../../generated/prisma/client.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { computeEffectiveSensitiveLabels } from "./sensitiveContent.service.js";

export type SensitiveLabelChange =
  | { readonly source: "author"; readonly labels: readonly SensitiveLabel[] }
  | { readonly source: "moderation"; readonly labels: readonly SensitiveLabel[] }
  | { readonly source: "advisory"; readonly labels: readonly SensitiveLabel[] };

export async function applySensitiveLabelChange(context: HandlerContext, postId: string, change: SensitiveLabelChange, occurredAt: Date): Promise<boolean> {
  return context.database.transaction(async (db) => {
    const post = await db.post.findUnique({ where: { id: postId }, select: { authorId: true, kind: true, authorSensitiveLabels: true, moderationSensitiveLabels: true, advisorySensitiveLabels: true, sensitiveLabelsReviewed: true, sensitiveLabels: true } });
    if (post === null) return false;
    const author = change.source === "author" ? [...change.labels] : post.authorSensitiveLabels;
    const moderation = change.source === "moderation" ? [...change.labels] : post.moderationSensitiveLabels;
    const advisory = change.source === "advisory" ? [...change.labels] : post.advisorySensitiveLabels;
    const reviewed = change.source === "moderation" ? true : post.sensitiveLabelsReviewed;
    const effective = computeEffectiveSensitiveLabels({ author, moderation, advisory, reviewedByModeration: reviewed });
    await db.post.update({ where: { id: postId }, data: { authorSensitiveLabels: author, moderationSensitiveLabels: moderation, advisorySensitiveLabels: advisory, sensitiveLabelsReviewed: reviewed, sensitiveLabels: effective } });
    if (effective.join(",") !== post.sensitiveLabels.join(",")) {
      await appendDomainEventsToOutbox(db, [{ eventType: socialEventTypes.postUpdated, subject: postId, occurredAt, data: { postId, authorId: post.authorId, kind: post.kind, sensitiveLabels: effective, labelSource: change.source } }]);
    }
    return true;
  });
}
