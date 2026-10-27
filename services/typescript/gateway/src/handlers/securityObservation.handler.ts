import type { Logger } from "@nantty/fastify-platform";

import type { VerifiedPrincipal } from "../services/accessTokenVerifier.service.js";
import { classifyCompletedRequest, convertPathToRouteTemplate, isAdminPath, isTamperedConsumerToken, type ProbeSignal } from "../services/security/accessProbeClassifier.service.js";
import type { SecurityServices } from "../services/security/securityServices.service.js";

export interface ObservedRequest {
  readonly requestId: string;
  readonly path: string;
  readonly deviceId: string | undefined;
  readonly clientIp: string | undefined;
  readonly principal: VerifiedPrincipal | undefined;
}

export function observeProbeSignalInBackground(security: SecurityServices, logger: Logger, request: ObservedRequest, signal: ProbeSignal | undefined): void {
  if (signal === undefined) return;
  security.detector.observe({ signal, principal: request.principal, deviceId: request.deviceId, clientIp: request.clientIp, requestId: request.requestId })
    .then((reported) => {
      if (reported.length > 0) logger.warn("access violation threshold crossed", { kinds: reported, routeTemplate: signal.routeTemplate, accountId: request.principal?.accountId ?? null });
    })
    .catch((error: unknown) => logger.warn("access probe observation failed", { error: error instanceof Error ? error.message : String(error) }));
}

export function internalPathSignal(path: string): ProbeSignal {
  return { kind: "internalPath", routeTemplate: convertPathToRouteTemplate(path).template, resourceType: "internal" };
}

export function tamperedTokenSignal(path: string, token: string | undefined, principal: VerifiedPrincipal | undefined, consumerAudience: string): ProbeSignal | undefined {
  if (token === undefined || principal !== undefined || isAdminPath(path) || !isTamperedConsumerToken(token, consumerAudience)) return undefined;
  return { kind: "tamperedToken", routeTemplate: convertPathToRouteTemplate(path).template, resourceType: "accessToken" };
}

export function completedRequestSignal(path: string, status: number, principal: VerifiedPrincipal | undefined, body: Uint8Array): ProbeSignal | undefined {
  let responseCode: string | undefined;
  if (status === 422 && body.byteLength > 0 && body.byteLength < 4096) {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(body)) as { code?: unknown };
      if (typeof parsed.code === "string") responseCode = parsed.code;
    } catch {
      responseCode = undefined;
    }
  }
  return classifyCompletedRequest({ path, status, hasConsumerPrincipal: principal !== undefined, responseCode });
}
