import { UnauthorizedError } from "@zudojs/errors";
import type { HttpMiddleware } from "@zudojs/http";

export type WebhookVerifier = (rawBody: Uint8Array, header: (name: string) => string | undefined) => boolean | Promise<boolean>;

export function readRawRequestBody(body: unknown): Uint8Array {
  if (body instanceof Uint8Array) return body;
  if (typeof body === "string") return new TextEncoder().encode(body);
  return new Uint8Array();
}

export function createWebhookSignatureVerificationMiddleware(verifiers: Readonly<Record<string, WebhookVerifier>>): HttpMiddleware {
  return async (context, next) => {
    const provider = context.request.getParam("provider") ?? "";
    const verifier = Object.hasOwn(verifiers, provider) ? verifiers[provider] : undefined;
    const valid =
      verifier !== undefined &&
      (await verifier(readRawRequestBody(context.request.body), (name) => context.request.getHeader(name)));
    if (!valid) throw new UnauthorizedError("Invalid webhook signature.");
    return next();
  };
}
