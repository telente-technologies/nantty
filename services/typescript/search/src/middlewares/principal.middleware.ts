import { timingSafeEqual } from "node:crypto";

import type { HttpRouterContext } from "@zudojs/http";

import { accountIdHeaderName, clientRegionHeaderName, internalTokenHeaderName } from "../constants/search.constant.js";
import { unauthorized } from "../errors/search.error.js";

const accountIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function findViewerId(context: HttpRouterContext): string | undefined {
  const accountId = context.request.getHeader(accountIdHeaderName)?.trim();
  return accountId !== undefined && accountIdPattern.test(accountId) ? accountId.toLowerCase() : undefined;
}

export function requireViewerId(context: HttpRouterContext): string {
  const viewerId = findViewerId(context);
  if (viewerId === undefined) throw unauthorized();
  return viewerId;
}

export function findClientRegion(context: HttpRouterContext): string | undefined {
  const region = context.request.getHeader(clientRegionHeaderName)?.trim().toUpperCase();
  return region !== undefined && /^[A-Z0-9-]{2,12}$/.test(region) ? region : undefined;
}

export function assertInternalToken(context: HttpRouterContext, expected: string): void {
  const provided = Buffer.from(context.request.getHeader(internalTokenHeaderName) ?? "");
  const wanted = Buffer.from(expected);
  if (expected === "" || provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) throw unauthorized();
}
