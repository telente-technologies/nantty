import { timingSafeEqual } from "node:crypto";

import type { HttpRouterContext } from "@nantty/fastify-platform";

import { accountIdHeaderName, internalTokenHeaderName } from "../constants/support.constant.js";
import { unauthorized } from "../errors/support.error.js";

const accountIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function findViewerAccountId(context: HttpRouterContext): string | undefined {
  const accountId = context.request.getHeader(accountIdHeaderName)?.trim();
  return accountId !== undefined && accountIdPattern.test(accountId) ? accountId.toLowerCase() : undefined;
}

export function requireViewerAccountId(context: HttpRouterContext): string {
  const accountId = findViewerAccountId(context);
  if (accountId === undefined) throw unauthorized();
  return accountId;
}

export function assertInternalToken(context: HttpRouterContext, expected: string): void {
  const provided = Buffer.from(context.request.getHeader(internalTokenHeaderName) ?? "");
  const wanted = Buffer.from(expected);
  if (expected === "" || provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) throw unauthorized();
}
