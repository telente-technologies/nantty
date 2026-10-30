import { timingSafeEqual } from "node:crypto";

import type { HttpRouterContext } from "@nantty/fastify-platform";

import { accountIdHeaderName, internalTokenHeaderName } from "../constants/media.constant.js";
import { forbidden, unauthorized } from "../errors/media.error.js";
import type { Principal } from "../types/principal.type.js";

const accountIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requirePrincipal(context: HttpRouterContext): Principal {
  const accountId = context.request.getHeader(accountIdHeaderName)?.trim();
  if (accountId === undefined || !accountIdPattern.test(accountId)) throw unauthorized();
  return { accountId: accountId.toLowerCase() };
}

export function requireInternalCaller(context: HttpRouterContext, expectedToken: string): void {
  const presented = Buffer.from(context.request.getHeader(internalTokenHeaderName)?.trim() ?? "");
  const expected = Buffer.from(expectedToken);
  if (expectedToken === "" || presented.length !== expected.length || !timingSafeEqual(presented, expected)) throw forbidden("INTERNAL_ONLY", "This endpoint is for internal callers.");
}
