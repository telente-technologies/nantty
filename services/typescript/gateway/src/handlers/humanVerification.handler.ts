import { randomUUID } from "node:crypto";

import type { HttpRequestContext, HttpResponseContext } from "@zudojs/http";
import type { Logger } from "@zudojs/logger";

import { extractBearerTokenFromAuthorizationHeader, type AccessTokenVerifier } from "../services/accessTokenVerifier.service.js";
import type { RateLimitStore } from "../services/rateLimitStore.service.js";
import { truncateIpToPrefix } from "../services/security/accessProbeClassifier.service.js";
import { HumanVerificationUnavailableError } from "../services/security/humanVerificationProvider.service.js";
import type { SecurityServices } from "../services/security/securityServices.service.js";
import { json, unauthorizedResponseBody } from "../utils/http.util.js";

function readChallengeToken(body: unknown): string | undefined {
  const parsed = typeof body === "string" ? safeParse(body) : body instanceof Uint8Array ? safeParse(new TextDecoder().decode(body)) : body;
  const token = (parsed as { token?: unknown } | undefined)?.token;
  return typeof token === "string" && token.length > 0 && token.length <= 2048 ? token : undefined;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function handleHumanVerificationRequest(request: HttpRequestContext, security: SecurityServices, verifier: AccessTokenVerifier, rateLimits: RateLimitStore, logger: Logger): Promise<HttpResponseContext> {
  const token = extractBearerTokenFromAuthorizationHeader(request.getHeader("authorization"));
  const principal = token === undefined ? undefined : await verifier.verifyAccessTokenWithJwks(token);
  if (principal === undefined) return json(401, unauthorizedResponseBody);
  if (security.trust === undefined || security.states === undefined || security.gate === undefined || security.provider === undefined) {
    return json(503, { message: "Human verification is not configured.", code: "HUMAN_VERIFICATION_UNAVAILABLE" });
  }
  if (request.method.toUpperCase() === "GET") {
    const state = await security.states.read(principal.accountId);
    return json(200, { requirement: state.requirement, reason: state.reason ?? null, provider: security.provider.name });
  }
  if (request.method.toUpperCase() !== "POST") return json(405, { message: "Method not allowed.", code: "METHOD_NOT_ALLOWED" });
  for (const [key, limit] of [[`rl:hv:a:${principal.accountId}`, security.attemptsPerMinute], [`rl:hv:i:${request.remoteAddress ?? "unknown"}`, security.attemptsPerMinute * 3]] as const) {
    const decision = await rateLimits.hit(key, limit, 60);
    if (!decision.allowed) {
      const limited = json(429, { message: "Too many verification attempts. Try again shortly.", code: "RATE_LIMITED" }).clone();
      limited.setHeader("retry-after", String(decision.retryAfterSeconds));
      return limited;
    }
  }
  const challengeToken = readChallengeToken(request.body);
  if (challengeToken === undefined) return json(400, { message: "Send the verification token.", code: "VALIDATION_FAILED" });
  let verdict;
  try {
    verdict = await security.provider.verifyChallengeToken(challengeToken, request.remoteAddress, randomUUID());
  } catch (error) {
    logger.warn("human verification provider failed", { provider: security.provider.name, unavailable: error instanceof HumanVerificationUnavailableError });
    return json(503, { message: "Verification is unavailable right now. Try again.", code: "HUMAN_VERIFICATION_UNAVAILABLE" });
  }
  const state = await security.trust.reportChallengeOutcome({
    attemptId: randomUUID(), accountId: principal.accountId, sessionId: principal.sessionId, deviceId: (request.getHeader("x-device-id") ?? "").slice(0, 128),
    ipPrefix: truncateIpToPrefix(request.remoteAddress), passed: verdict.success, provider: security.provider.name, errorCodes: verdict.errorCodes,
  });
  security.states.forget(principal.accountId);
  if (state.suspended === true) return json(403, { message: "Your account has been suspended for security reasons. You can appeal from the suspension notice.", code: "ACCOUNT_SUSPENDED_SECURITY" });
  if (!verdict.success) {
    return json(400, { message: "We couldn't confirm that. Try again.", code: "HUMAN_VERIFICATION_FAILED", failuresInWindow: state.failuresInWindow ?? null, failuresAllowed: state.failuresAllowed ?? null });
  }
  await security.gate.grantPasses(principal.sessionId);
  return json(200, { verified: true, requirement: state.requirement, clearedUntil: state.clearedUntil ?? null });
}
