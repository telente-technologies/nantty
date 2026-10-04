import { schema } from "@zudojs/schema";

import { helpTopicOrigins, helpTopicStatuses } from "../../../enums/helpTopic.enum.js";
import { badRequest } from "../../../errors/support.error.js";
import { slugPattern } from "../../../utils/slug.util.js";

const uppercase = <T extends readonly string[]>(values: T) => values.map((value) => value.toUpperCase()) as unknown as readonly [string, ...string[]];

export const voteBodySchema = schema.object({ helpful: schema.boolean() });
export const publicTopicQuerySchema = schema.object({ q: schema.string().max(120).optional(), category: schema.string().max(80).optional(), limit: schema.coerce.number().int().min(1).max(50).optional() });
export const categoryBodySchema = schema.object({
  slug: schema.string().min(2).max(60).regex(slugPattern), title: schema.string().trim().min(2).max(80), description: schema.string().trim().max(300).optional(),
  iconName: schema.string().max(40).regex(/^[A-Za-z0-9]+$/).optional(), position: schema.number().int().min(0).max(1000).optional(),
});
export const topicBodySchema = schema.object({
  categoryId: schema.string().uuid(), slug: schema.string().min(2).max(90).regex(slugPattern).optional(), title: schema.string().trim().min(5).max(140),
  summary: schema.string().trim().max(300).optional(), bodyMarkdown: schema.string().min(20).max(40_000), tags: schema.array(schema.string().trim().min(1).max(40)).max(12).optional(),
  relatedTopicIds: schema.array(schema.string().uuid()).max(8).optional(), status: schema.enum(["DRAFT", "PUBLISHED"] as const).optional(), changeNote: schema.string().max(200).optional(),
});
export const mergeBodySchema = schema.object({ targetTopicId: schema.string().uuid() });
export const settingsBodySchema = schema.object({ autoFaqRequiresReview: schema.boolean() });
export const adminTopicQuerySchema = schema.object({
  status: schema.enum(uppercase(helpTopicStatuses)).optional(), origin: schema.enum(uppercase(helpTopicOrigins)).optional(), categoryId: schema.string().uuid().optional(), search: schema.string().max(120).optional(),
});

export function assertSafeMarkdown(markdown: string): void {
  if (/<\s*(script|iframe|object|embed|style)\b|javascript:|data:text\/html|on\w+\s*=/i.test(markdown)) throw badRequest("UNSAFE_MARKDOWN", "Markdown cannot contain scripts, embedded frames or inline event handlers.");
}
