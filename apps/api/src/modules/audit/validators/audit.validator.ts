import { schema, type Infer } from "@zudojs/schema";

import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";

export const ListAuditEventsQuerySchema = schema.object({
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
  entityType: schema.string().max(60).optional(),
  entityId: schema.string().max(80).optional(),
  actorId: schema.string().uuid().optional(),
  action: schema.string().max(80).optional(),
});

export const AuditEventParamsSchema = schema.object({ id: schema.string().uuid() });

export type ListAuditEventsQueryInput = Infer<typeof ListAuditEventsQuerySchema>;
