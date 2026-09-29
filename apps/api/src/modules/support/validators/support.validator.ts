import { schema, type Infer } from "@zudojs/schema";

import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";
import { CONTACT_REQUEST_KINDS, SUPPORT_TICKET_CATEGORIES, SUPPORT_TICKET_STATUSES } from "../models/support.model.js";

export const CreateTicketBodySchema = schema.object({
  category: schema.enum(SUPPORT_TICKET_CATEGORIES),
  subject: schema.string().min(4).max(140),
  message: schema.string().min(10).max(5000),
  attachmentMediaIds: schema.array(schema.string().uuid()).max(5).optional(),
});

export const TicketMessageBodySchema = schema.object({
  text: schema.string().min(1).max(5000),
  attachmentMediaIds: schema.array(schema.string().uuid()).max(5).optional(),
});

export const TicketParamsSchema = schema.object({ id: schema.string().uuid() });

export const UpdateTicketBodySchema = schema.object({
  status: schema.enum(SUPPORT_TICKET_STATUSES).optional(),
  assigneeId: schema.optional(schema.nullable(schema.string().uuid())),
});

export const ListTicketsQuerySchema = schema.object({
  status: schema.enum(SUPPORT_TICKET_STATUSES).optional(),
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});

export const ContactRequestBodySchema = schema.object({
  kind: schema.enum(CONTACT_REQUEST_KINDS),
  name: schema.string().min(1).max(120),
  email: schema.string().email().max(254),
  subject: schema.string().min(3).max(140),
  message: schema.string().min(10).max(5000),
});

export type CreateTicketBody = Infer<typeof CreateTicketBodySchema>;
export type TicketMessageBody = Infer<typeof TicketMessageBodySchema>;
export type UpdateTicketBody = Infer<typeof UpdateTicketBodySchema>;
export type ContactRequestBody = Infer<typeof ContactRequestBodySchema>;
