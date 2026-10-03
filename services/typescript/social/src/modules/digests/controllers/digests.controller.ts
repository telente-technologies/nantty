import { timingSafeEqual } from "node:crypto";

import { schema } from "@zudojs/schema";
import type { HttpRouterContext } from "@zudojs/http";

import { unauthorized } from "../../../errors/social.error.js";
import { json } from "../../../utils/http.util.js";
import type { Handler } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { DigestPage } from "../queries/listDigestPage/listDigestPage.handler.js";
import type { ListDigestPageQuery } from "../queries/listDigestPage/listDigestPage.query.js";

const paramsSchema = schema.object({ kind: schema.enum(["weekly", "followRequests", "messageRequests"]) });
const querySchema = schema.object({ cursor: schema.string().uuid().optional(), limit: schema.coerce.number().int().min(1).max(500).optional(), since: schema.string().max(40).optional() });

export function assertInternalToken(context: HttpRouterContext, expected: string): void {
  const provided = Buffer.from(context.request.getHeader("x-internal-token") ?? "");
  const wanted = Buffer.from(expected);
  if (expected === "" || provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) throw unauthorized();
}

export function createDigestsController(route: RouteFactory, internalToken: string, listDigestPage: Handler<ListDigestPageQuery, DigestPage>) {
  const handle = route({ authentication: "optional", params: paramsSchema, query: querySchema }, ({ params, query }) => {
    const parsedSince = query.since === undefined ? undefined : new Date(query.since);
    const since = parsedSince === undefined || Number.isNaN(parsedSince.getTime()) ? new Date(Date.now() - 86_400_000) : parsedSince;
    return listDigestPage({ kind: params.kind, cursor: query.cursor, limit: query.limit ?? 100, since });
  });
  return {
    list: async (context: HttpRouterContext) => {
      try {
        assertInternalToken(context, internalToken);
      } catch {
        return json(401, { message: "Invalid internal token.", code: "UNAUTHORIZED" });
      }
      return handle(context);
    },
  };
}
