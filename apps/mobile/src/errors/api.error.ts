import { describeLimitError } from "@/utils/limitErrors.util";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly suggestions?: readonly string[],
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(describeLimitError(code, details) ?? message);
  }
}
