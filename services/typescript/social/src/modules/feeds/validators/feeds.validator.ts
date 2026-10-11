import { schema } from "@zudojs/schema";

export const feedQuerySchema = schema.object({
  cursor: schema.string().max(200).optional(),
  limit: schema.coerce.number().int().min(1).max(50).optional(),
  topicId: schema.string().min(1).max(64).optional(),
});
export const followingFeedQuerySchema = schema.object({ cursor: schema.string().uuid().optional(), limit: schema.coerce.number().int().min(1).max(50).optional() });
export const clipsQuerySchema = schema.object({
  tab: schema.enum(["forYou", "following"]).optional(),
  cursor: schema.string().max(200).optional(),
  limit: schema.coerce.number().int().min(1).max(50).optional(),
});
const feedbackKinds = ["notInterested", "hide", "like", "more", "less"] as const;
export type FeedbackKind = (typeof feedbackKinds)[number];
export const feedbackBodySchema = schema.object({
  postId: schema.string().uuid(),
  kind: schema.enum([...feedbackKinds]).optional(),
  type: schema.enum([...feedbackKinds, "not_interested"]).optional(),
});

export function resolveFeedbackKind(body: { readonly kind?: FeedbackKind | undefined; readonly type?: FeedbackKind | "not_interested" | undefined }): FeedbackKind | undefined {
  if (body.kind !== undefined) return body.kind;
  return body.type === "not_interested" ? "notInterested" : body.type;
}

export const feedInteractionBodySchema = schema.object({
  postId: schema.string().uuid(),
  kind: schema.enum(["view", "dwell", "watch", "link_click", "profile_click", "follow"]),
  dwellMs: schema.number().int().min(0).max(3_600_000).optional(),
  watchFraction: schema.number().min(0).max(1).optional(),
  watchMs: schema.number().int().min(0).max(3_600_000).optional(),
  loopCount: schema.number().int().min(0).max(100).optional(),
  durationMs: schema.number().int().min(0).max(3_600_000).optional(),
  position: schema.number().int().min(0).max(10_000).optional(),
  surface: schema.string().regex(/^[a-z_]{1,40}$/).optional(),
  rankingRequestId: schema.string().regex(/^[A-Za-z0-9_\-:.]{1,128}$/).optional(),
});

export const maximumInteractionsPerBatch = 50;
export const feedInteractionBatchBodySchema = schema.object({ events: schema.array(feedInteractionBodySchema).min(1).max(maximumInteractionsPerBatch) });
