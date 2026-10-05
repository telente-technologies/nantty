import { createHmac, timingSafeEqual } from "node:crypto";

import { createResponseContext, type HttpMiddleware, type HttpRequestContext } from "@zudojs/http";

export const identitySignatureHeaderName = "x-zudomart-identity-signature";
const signedIdentityHeaderNames = ["x-zudomart-account-id", "x-zudomart-session-id", "x-zudomart-age-bracket", "x-zudomart-viewer"] as const;
const maximumSignatureAgeSeconds = 60;

export function readGatewayIdentitySecretsFromEnvironment(problems: string[]): readonly string[] {
  const current = process.env["GATEWAY_IDENTITY_SECRET"]?.trim() ?? "";
  const previous = process.env["GATEWAY_IDENTITY_PREVIOUS_SECRET"]?.trim() ?? "";
  if (current.length < 32) problems.push("GATEWAY_IDENTITY_SECRET must be at least 32 characters");
  return [current, previous].filter((secret) => secret.length >= 32);
}

function buildSigningPayload(request: HttpRequestContext, issuedAt: string): string {
  const values = signedIdentityHeaderNames.map((name) => request.getHeader(name) ?? "");
  return ["v1", issuedAt, request.method.toUpperCase(), request.path, request.getHeader("x-request-id") ?? "", ...values].join("\n");
}

export function isGatewayIdentityAuthentic(request: HttpRequestContext, secrets: readonly string[], nowSeconds: number): boolean {
  const match = /^t=(\d{1,12}),v1=([0-9a-f]{64})$/.exec(request.getHeader(identitySignatureHeaderName)?.trim() ?? "");
  if (match === null || secrets.length === 0) return false;
  const [, issuedAt = "", presentedHex = ""] = match;
  if (Math.abs(nowSeconds - Number(issuedAt)) > maximumSignatureAgeSeconds) return false;
  const presented = Buffer.from(presentedHex, "hex");
  const payload = buildSigningPayload(request, issuedAt);
  return secrets.some((secret) => {
    const expected = createHmac("sha256", secret).update(payload).digest();
    return expected.length === presented.length && timingSafeEqual(expected, presented);
  });
}

export function createGatewayIdentityMiddleware(secrets: readonly string[], now: () => number = () => Date.now()): HttpMiddleware {
  return (context, next) => {
    const request = context.request;
    const carriesIdentity = signedIdentityHeaderNames.some((name) => request.getHeader(name) !== undefined) || request.getHeader(identitySignatureHeaderName) !== undefined;
    if (!carriesIdentity || isGatewayIdentityAuthentic(request, secrets, Math.floor(now() / 1000))) return next();
    return createResponseContext({ status: 401 }).json({ message: "The request did not come through the gateway.", code: "GATEWAY_IDENTITY_INVALID" });
  };
}
