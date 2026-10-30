import { forbidden, notFound, unprocessable } from "../../../errors/social.error.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import { postIdParamsSchema, scheduledPostsQuerySchema, schedulePostBodySchema } from "../validators/posts.validator.js";

const maximumScheduleMs = 90 * 24 * 60 * 60_000;

function parseScheduleTime(value: string, now: Date): Date {
  const scheduledAt = new Date(value);
  if (!Number.isFinite(scheduledAt.getTime())) throw unprocessable("INVALID_SCHEDULE_TIME", "Choose a valid date and time, including its timezone.");
  if (scheduledAt.getTime() < now.getTime() + 60_000) throw unprocessable("SCHEDULE_TOO_SOON", "Schedule a post at least one minute in the future.");
  if (scheduledAt.getTime() > now.getTime() + maximumScheduleMs) throw unprocessable("SCHEDULE_TOO_FAR", "Posts can be scheduled up to 90 days ahead.");
  return scheduledAt;
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
  };
}
