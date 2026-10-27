import { createResponseContext, type HttpResponseContext } from "@nantty/fastify-platform";

export function json(status: number, data: unknown): HttpResponseContext {
  return createResponseContext({ status }).json(data);
}

export function convertRequestBodyToBytes(body: unknown): Uint8Array | undefined {
  if (body === undefined || body === null) return undefined;
  if (body instanceof Uint8Array) return body;
  if (typeof body === "string") return new TextEncoder().encode(body);
  return new TextEncoder().encode(JSON.stringify(body));
}

export const unauthorizedResponseBody = { message: "Sign in to continue.", code: "UNAUTHENTICATED" } as const;
