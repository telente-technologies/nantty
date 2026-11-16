import { forbidden, notFound, unprocessable } from "../../../errors/social.error.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { MediaReferenceInput } from "../commands/createPost/createPost.command.js";
import type { MentionEntity } from "../../mentions/models/mention.model.js";
import { keepMentionsWithinText, prepareMentionsForWrite } from "../../mentions/services/mentionWrite.service.js";
import { prepareAudienceSettingsForPublishing } from "../services/postAudienceRules.service.js";
import { resolveOwnedPostMedia } from "../services/postMediaResolution.service.js";
import { assertProductsTaggable } from "../services/postProducts.service.js";
import { assertMediaFitsPostKind } from "../services/postRules.service.js";
import { selectTaggableUserIds } from "../services/postTagEligibility.service.js";
import { postIdParamsSchema, scheduledPostsQuerySchema, schedulePostBodySchema, updateScheduledPostContentBodySchema } from "../validators/posts.validator.js";

const maximumScheduleMs = 90 * 24 * 60 * 60_000;

function parseScheduleTime(value: string, now: Date): Date {
  const scheduledAt = new Date(value);
  if (!Number.isFinite(scheduledAt.getTime())) throw unprocessable("INVALID_SCHEDULE_TIME", "Choose a valid date and time, including its timezone.");
  if (scheduledAt.getTime() < now.getTime() + 60_000) throw unprocessable("SCHEDULE_TOO_SOON", "Schedule a post at least one minute in the future.");
  if (scheduledAt.getTime() > now.getTime() + maximumScheduleMs) throw unprocessable("SCHEDULE_TOO_FAR", "Posts can be scheduled up to 90 days ahead.");
  return scheduledAt;
}

function existingMentions(value: unknown): MentionEntity[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entity): entity is MentionEntity => typeof entity === "object" && entity !== null && "start" in entity && "length" in entity &&
    ("userId" in entity || ("type" in entity && entity.type === "all")));
}

export function createScheduledPostsController(route: RouteFactory, context: HandlerContext) {
  return {
    list: route({ authentication: "required", query: scheduledPostsQuerySchema }, async ({ principal, query }) => {
      const limit = query.limit ?? 20;
      const rows = await context.database.client.post.findMany({
        where: { authorId: principal.accountId, deletedAt: null, publicationState: { in: ["scheduled", "failed"] } },
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }, { id: "asc" }],
        take: limit + 1,
        ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
        include: { media: { orderBy: { position: "asc" }, select: { mediaId: true, type: true, status: true, posterUrl: true } } },
      });
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      return { data: page.map((post) => ({
        id: post.id,
        text: post.text,
        createdAt: post.createdAt.toISOString(),
        scheduledAt: post.scheduledAt?.toISOString() ?? null,
        status: post.publicationState,
        failureReason: post.publicationFailureReason,
        media: post.media.map((media) => ({ id: media.mediaId, type: media.type, status: media.status, posterUrl: media.posterUrl })),
      })), nextCursor: hasMore ? page.at(-1)?.id ?? null : null };
    }),
    reschedule: route({ authentication: "required", params: postIdParamsSchema, body: schedulePostBodySchema }, async ({ principal, params, body }) => {
      const scheduledAt = parseScheduleTime(body.scheduledAt, context.clock.now());
      const post = await context.database.client.post.findFirst({
        where: { id: params.postId, authorId: principal.accountId, deletedAt: null, kind: "post", publicationState: { in: ["scheduled", "failed"] } },
        select: { authorProfileId: true },
      });
      if (post === null) throw notFound("SCHEDULED_POST_NOT_FOUND", "Scheduled post not found.");
      if (!(await context.premium.canSchedulePosts(principal.accountId, post.authorProfileId ?? undefined))) {
        throw forbidden("PAID_SCHEDULING_REQUIRED", "An active Blue or Gold subscription is required to reschedule posts.");
      }
      const result = await context.database.client.post.updateMany({
        where: { id: params.postId, authorId: principal.accountId, deletedAt: null, kind: "post", publicationState: { in: ["scheduled", "failed"] } },
        data: { publicationState: "scheduled", scheduledAt, publicationFailureReason: null },
      });
      if (result.count !== 1) throw notFound("SCHEDULED_POST_NOT_FOUND", "Scheduled post not found.");
      return { id: params.postId, scheduledAt: scheduledAt.toISOString(), status: "scheduled" as const };
    }),
    publishNow: route({ authentication: "required", params: postIdParamsSchema }, async ({ principal, params }) => {
      const now = context.clock.now();
      const result = await context.database.client.post.updateMany({
        where: { id: params.postId, authorId: principal.accountId, deletedAt: null, kind: "post", publicationState: { in: ["scheduled", "failed"] } },
        data: { publicationState: "scheduled", scheduledAt: now, publicationFailureReason: null },
      });
      if (result.count !== 1) throw notFound("SCHEDULED_POST_NOT_FOUND", "Scheduled post not found.");
      return { id: params.postId, scheduledAt: now.toISOString(), status: "publishing" as const };
    }),
    cancel: route({ authentication: "required", params: postIdParamsSchema, successStatus: 204 }, async ({ principal, params }) => {
      const result = await context.database.client.post.updateMany({
        where: { id: params.postId, authorId: principal.accountId, deletedAt: null, kind: "post", publicationState: { in: ["scheduled", "failed"] } },
        data: { publicationState: "cancelled", scheduledAt: null, scheduledTaggedUserIds: [], publicationFailureReason: null },
      });
      if (result.count !== 1) throw notFound("SCHEDULED_POST_NOT_FOUND", "Scheduled post not found.");
    }),
    editContent: route({ authentication: "required", params: postIdParamsSchema, body: updateScheduledPostContentBodySchema }, async ({ principal, params, body }) => {
      if (Object.values(body).every((value) => value === undefined)) {
        throw unprocessable("EMPTY_UPDATE", "Provide at least one field to update.");
      }
      const existing = await context.database.client.post.findFirst({
        where: { id: params.postId, authorId: principal.accountId, deletedAt: null, kind: "post", publicationState: { in: ["scheduled", "failed"] } },
      });
      if (existing === null) throw notFound("SCHEDULED_POST_NOT_FOUND", "Scheduled post not found.");
      if (!(await context.premium.canSchedulePosts(principal.accountId, existing.authorProfileId ?? undefined))) {
        throw forbidden("PAID_SCHEDULING_REQUIRED", "An active Blue or Gold subscription is required to edit scheduled posts.");
      }
      const nextText = body.text ?? existing.text;
      const existingMedia = body.mediaIds === undefined
        ? await context.database.client.postMedia.findMany({ where: { postId: existing.id }, orderBy: { position: "asc" } })
        : [];
      const resolvedMedia: MediaReferenceInput[] = body.mediaIds === undefined
        ? []
        : await resolveOwnedPostMedia(context, principal.accountId, body.mediaIds);
      const mediaForValidation = body.mediaIds === undefined
        ? existingMedia.map((item) => ({ id: item.mediaId, type: item.type, durationSeconds: item.durationSeconds ?? undefined, status: item.status }))
        : resolvedMedia.map((item) => ({ id: item.id, type: item.type, durationSeconds: item.durationSeconds, status: item.url == null ? "processing" as const : "ready" as const }));
      assertMediaFitsPostKind("post", nextText, mediaForValidation.map((item) => ({
        id: item.id,
        type: item.type,
        status: item.status === "failed" ? "failed" : item.status === "ready" ? "ready" : "processing",
      })));
      const nextVisibility = body.visibility ?? existing.visibility;
      const sensitiveLabels = await prepareAudienceSettingsForPublishing(context, principal.accountId, {
        visibility: nextVisibility,
        sensitiveLabels: body.sensitiveLabels ?? existing.authorSensitiveLabels,
      });
      const productIds = body.productIds === undefined ? existing.productIds : await assertProductsTaggable(context, body.productIds);
      const mentionResult = await prepareMentionsForWrite(context, {
        surface: "post",
        authorId: principal.accountId,
        text: nextText,
        entities: keepMentionsWithinText(body.mentions ?? existingMentions(existing.mentions), nextText),
      });
      const taggedUserIds = body.taggedUserIds === undefined ? undefined : await selectTaggableUserIds(context, principal.accountId, body.taggedUserIds);
      const updated = await context.database.transaction(async (transaction) => {
        if (body.mediaIds !== undefined) {
          await transaction.postMedia.deleteMany({ where: { postId: existing.id } });
          for (const [position, item] of resolvedMedia.entries()) {
            await transaction.postMedia.create({
              data: {
                postId: existing.id,
                mediaId: item.id,
                position,
                type: item.type,
                url: item.url ?? null,
                posterUrl: item.posterUrl ?? null,
                hlsUrl: item.hlsUrl ?? null,
                status: item.url === undefined || item.url === null ? "processing" : "ready",
                width: item.width ?? null,
                height: item.height ?? null,
                durationSeconds: item.durationSeconds ?? null,
                blurhash: item.blurhash ?? null,
              },
            });
          }
        }
        const locationData = body.location === undefined ? undefined
          : body.location === null ? Prisma.DbNull
            : { placeId: body.location.placeId, name: body.location.name, area: body.location.area ?? null };
        const result = await transaction.post.updateMany({
          where: { id: existing.id, authorId: principal.accountId, deletedAt: null, kind: "post", publicationState: { in: ["scheduled", "failed"] } },
          data: {
            text: nextText,
            audience: body.audience ?? existing.audience,
            visibility: nextVisibility,
            replyPolicy: body.replyPolicy ?? existing.replyPolicy,
            authorSensitiveLabels: sensitiveLabels,
            sensitiveLabels,
            mentions: mentionResult.entities as unknown as Prisma.InputJsonValue,
            topics: body.topics === undefined ? existing.topics : [...new Set(body.topics)],
            productIds,
            ...(locationData === undefined ? {} : { location: locationData }),
            ...(taggedUserIds === undefined ? {} : { scheduledTaggedUserIds: taggedUserIds }),
          },
        });
        if (result.count !== 1) throw notFound("SCHEDULED_POST_NOT_FOUND", "Scheduled post not found.");
        return transaction.post.findFirst({
          where: { id: existing.id },
          include: { media: { orderBy: { position: "asc" }, select: { mediaId: true, type: true, status: true, posterUrl: true } } },
        });
      });
      return {
        id: existing.id,
        text: updated?.text ?? nextText,
        scheduledAt: updated?.scheduledAt?.toISOString() ?? existing.scheduledAt?.toISOString() ?? null,
        status: updated?.publicationState ?? existing.publicationState,
        media: (updated?.media ?? []).map((media) => ({ id: media.mediaId, type: media.type, status: media.status, posterUrl: media.posterUrl })),
      };
    }),
  };
}
