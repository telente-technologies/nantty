import { schema } from "@nantty/fastify-platform";

import { linkedReferenceKinds, ticketCategories, ticketChannels, ticketPriorities, ticketStatuses } from "../../../enums/ticket.enum.js";

const uppercase = <T extends readonly string[]>(values: T) => values.map((value) => value.toUpperCase()) as unknown as readonly [string, ...string[]];

export const linkedReferenceSchema = schema.object({ kind: schema.enum(linkedReferenceKinds), id: schema.string().min(1).max(80), label: schema.string().min(1).max(120) });

export const createTicketBodySchema = schema.object({
  category: schema.enum(ticketCategories),
  subject: schema.string().trim().min(4).max(120),
  message: schema.string().trim().min(10).max(5000),
  attachmentUrls: schema.array(schema.string().max(2048)).max(5).optional(),
  linkedReference: schema.optional(schema.nullable(linkedReferenceSchema)),
  channel: schema.enum(ticketChannels).optional(),
});

export const customerReplyBodySchema = schema.object({ text: schema.string().trim().min(1).max(5000), attachmentUrls: schema.array(schema.string().max(2048)).max(5).optional() });
export const rateTicketBodySchema = schema.object({ score: schema.number().int().min(1).max(5), comment: schema.optional(schema.nullable(schema.string().trim().max(1000))) });
export const ticketIdSchema = schema.string().uuid();

export const staffReplyBodySchema = schema.object({
  body: schema.string().trim().min(2).max(5000),
  isInternalNote: schema.boolean().optional(),
  statusAfterReply: schema.enum(uppercase(ticketStatuses)).optional(),
});
export const staffStatusBodySchema = schema.object({ status: schema.enum(uppercase(ticketStatuses)), reason: schema.string().trim().max(500).optional() });
export const staffAssignBodySchema = schema.object({ assigneeId: schema.string().min(1).max(64).nullable(), reason: schema.string().trim().max(500).optional() });
export const staffQueueQuerySchema = schema.object({
  status: schema.string().max(80).optional(),
  priority: schema.enum(uppercase(ticketPriorities)).optional(),
  category: schema.enum(uppercase(ticketCategories)).optional(),
  assignee: schema.enum(["me", "unassigned", "all"] as const).optional(),
  search: schema.string().max(120).optional(),
});
export const macroBodySchema = schema.object({ title: schema.string().trim().min(3).max(80), body: schema.string().trim().min(10).max(3000), category: schema.optional(schema.nullable(schema.enum(uppercase(ticketCategories)))) });
export const chatMessageBodySchema = schema.object({ body: schema.string().trim().min(1).max(2000) });
