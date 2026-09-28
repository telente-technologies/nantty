import type { QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import type { Page } from "../../../types/pagination.type.js";
import { json, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest, mapPageItems } from "../../../utils/pagination.util.js";
import { convertAuditEventToDto } from "../dtos/audit.dto.js";
import type { AuditEventRecord } from "../models/audit.model.js";
import { GetAuditEventQuery } from "../queries/getAuditEvent/getAuditEvent.query.js";
import { ListAuditEventsQuery } from "../queries/listAuditEvents/listAuditEvents.query.js";
import { AuditEventParamsSchema, ListAuditEventsQuerySchema } from "../validators/audit.validator.js";

export class AuditController {
  public constructor(private readonly queries: QueryBus) {}

  public readonly list = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = ListAuditEventsQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const { limit, cursor, ...filter } = query.data;
    const page = await this.queries.execute<ListAuditEventsQuery, Page<AuditEventRecord>>(
      new ListAuditEventsQuery(filter, buildPageRequest({ ...(limit === undefined ? {} : { limit }), ...(cursor === undefined ? {} : { cursor }) })),
    );
    return json(200, mapPageItems(page, convertAuditEventToDto));
  };

  public readonly get = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = AuditEventParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const event = await this.queries.execute<GetAuditEventQuery, AuditEventRecord>(new GetAuditEventQuery(params.data.id));
    return json(200, convertAuditEventToDto(event));
  };
}
