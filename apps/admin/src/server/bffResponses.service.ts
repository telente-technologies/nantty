import { NextResponse } from "next/server";

import type { ApiErrorBody } from "@/types/api.type";

export function respondWithBffError(status: number, code: string, message: string, extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ message, code, ...extra }, { status, headers: { "Cache-Control": "no-store", "x-request-id": crypto.randomUUID() } });
}

export function respondWithBackendError(status: number, error: ApiErrorBody | null, fallbackMessage: string): NextResponse {
  return respondWithBffError(status, error?.code ?? `HTTP_${status}`, error?.message ?? fallbackMessage, { ...(error?.issues ? { issues: error.issues } : {}), ...(error?.details ? { details: error.details } : {}) });
}

export function respondWithJson(payload: unknown, status = 200): NextResponse {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}
