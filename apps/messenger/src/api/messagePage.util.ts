import { ApiError } from "./apiError";

export interface MessagePagePayload {
  readonly data: readonly unknown[];
  readonly nextCursor: string | null;
}

export function parseMessagePagePayload(value: unknown): MessagePagePayload {
  if (Array.isArray(value)) return { data: value, nextCursor: null };
  if (value === null || typeof value !== "object" || !Array.isArray((value as { data?: unknown }).data)) {
    throw new ApiError("Nantty returned an unexpected conversation response.", null, "INVALID_MESSAGE_RESPONSE");
  }
  const page = value as { readonly data: unknown[]; readonly nextCursor?: unknown };
  return { data: page.data, nextCursor: typeof page.nextCursor === "string" ? page.nextCursor : null };
}
