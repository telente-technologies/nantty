import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import type { Page } from "../../../types/pagination.type.js";
import { json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest, mapPageItems, PageQuerySchema } from "../../../utils/pagination.util.js";
import { JoinWaitlistCommand } from "../commands/joinWaitlist/joinWaitlist.command.js";
import { convertWaitlistEntryToDto } from "../dtos/waitlist.dto.js";
import type { WaitlistEntryRecord } from "../models/waitlist.model.js";
import { CountWaitlistEntriesQuery } from "../queries/countWaitlistEntries/countWaitlistEntries.query.js";
import { ListWaitlistEntriesQuery } from "../queries/listWaitlistEntries/listWaitlistEntries.query.js";
import { JoinWaitlistBodySchema } from "../validators/waitlist.validator.js";

export class WaitlistController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly join = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = JoinWaitlistBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    await this.commands.execute<JoinWaitlistCommand, void>(new JoinWaitlistCommand(body.data));
    return json(202, { message: "Thanks! You're on the list." });
  };

  public readonly list = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = PageQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const page = await this.queries.execute<ListWaitlistEntriesQuery, Page<WaitlistEntryRecord>>(new ListWaitlistEntriesQuery(buildPageRequest(query.data)));
    return json(200, mapPageItems(page, convertWaitlistEntryToDto));
  };

  public readonly count = async (): Promise<HttpResponseContext> => {
    const total = await this.queries.execute<CountWaitlistEntriesQuery, number>(new CountWaitlistEntriesQuery());
    return json(200, { total });
  };
}
