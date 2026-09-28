import { parseBearerToken } from "@zudojs/auth";
import { UnauthorizedError } from "@zudojs/errors";
import type { HttpMiddlewareContext, HttpRouterContext } from "@zudojs/http";

import type { AccessTokenVerifier, Principal } from "../interfaces/index.js";

const PRINCIPAL = "principal";

export async function authenticateBearerToken(
  context: HttpMiddlewareContext,
  verifier: AccessTokenVerifier,
): Promise<Principal | undefined> {
  const token = parseBearerToken(context.request.getHeader("authorization"));
  if (token === null || token === undefined || token === "") return undefined;
  const principal = await verifier.verify(token);
  context.state.set(PRINCIPAL, principal);
  return principal;
}

export function findAuthenticatedPrincipal(ctx: HttpRouterContext): Principal | undefined {
  return ctx.state.get(PRINCIPAL) as Principal | undefined;
}

export function requireAuthenticatedPrincipal(ctx: HttpRouterContext): Principal {
  const principal = findAuthenticatedPrincipal(ctx);
  if (principal === undefined) throw new UnauthorizedError("Authentication required.");
  return principal;
}
