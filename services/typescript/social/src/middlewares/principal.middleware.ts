import type { HttpRouterContext } from "@nantty/fastify-platform";

import { accountIdHeaderName, ageBracketHeaderName } from "../constants/social.constant.js";
import { unauthorized } from "../errors/social.error.js";
import type { Principal, ViewerAgeBracket } from "../types/principal.type.js";

const accountIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readViewerAgeBracketFromGatewayHeader(value: string | undefined): ViewerAgeBracket {
  const normalised = value?.trim().toLowerCase();
  return normalised === "adult" || normalised === "minor" ? normalised : "unknown";
}

export function findPrincipal(context: HttpRouterContext): Principal | undefined {
  const accountId = context.request.getHeader(accountIdHeaderName)?.trim();
  if (accountId === undefined || !accountIdPattern.test(accountId)) return undefined;
  return { accountId: accountId.toLowerCase(), ageBracket: readViewerAgeBracketFromGatewayHeader(context.request.getHeader(ageBracketHeaderName)) };
}

export function requirePrincipal(context: HttpRouterContext): Principal {
  const principal = findPrincipal(context);
  if (principal === undefined) throw unauthorized();
  return principal;
}
