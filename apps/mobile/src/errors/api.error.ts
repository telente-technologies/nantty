import { describeLimitError } from "@/utils/limitErrors.util";

export interface ApiErrorMeta {
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;
}

export class ApiError extends Error {
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;

  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly suggestions?: readonly string[],
    readonly details?: Readonly<Record<string, unknown>>,
    meta: ApiErrorMeta = {},
  ) {
    super(describeLimitError(code, details) ?? message);
    this.requestId = meta.requestId;
    this.retryAfterSeconds = meta.retryAfterSeconds;
  }
}
